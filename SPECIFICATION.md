# Kudos System Specification

**Status:** Approved
**Version:** 1.0
**Date:** 2026-09-01

## 1. Overview

The Kudos System is an internal employee-portal feature that allows authenticated users to publicly recognise colleagues. Users can search for a colleague, write a short appreciation message, and submit it. Recent kudos appear in a dashboard feed. Users can report inappropriate content and administrators can hide or soft-delete reported kudos.

## 2. User Stories

### US-001: Submit Kudos
**As a** user, **I want to** select a colleague and write an appreciation message, **so that** I can recognise their contribution.

**Acceptance criteria**
- The sender must be authenticated.
- The recipient must be an existing user and cannot be the sender.
- Recipient search excludes the current user.
- The message is 10–500 characters.
- The user receives a success or error response.
- Anonymous submission is supported by the v1 implementation.

### US-002: View Recent Kudos
**As a** user, **I want to** see recently submitted kudos, **so that** I can celebrate team achievements.

**Acceptance criteria**
- The feed is newest-first.
- Hidden and soft-deleted kudos are excluded from the public feed.
- Each entry shows recipient, sender (or Anonymous), message, and timestamp.
- The feed supports pagination and recipient-name search.
- The API supports a maximum page size of 50.

### US-003: Report Inappropriate Kudos
**As a** user, **I want to** report inappropriate kudos, **so that** administrators can review them.

**Acceptance criteria**
- Each feed entry has a report action.
- A report includes a reason: offensive, spam, harassment, irrelevant, or other.
- Optional report details may be supplied.
- A user cannot report the same kudos more than once.
- Reporting does not immediately remove the kudos.

### US-004: Moderate Inappropriate Kudos
**As an** administrator, **I want to** hide or delete inappropriate kudos, **so that** they no longer appear in the public feed.

**Acceptance criteria**
- Admin endpoints require authentication and an `admin` role in the database.
- Administrators can view flagged kudos.
- Administrators can hide a kudos using `is_visible = false`.
- Administrators can soft-delete a kudos using `deleted_at` and hide it from the feed.
- Moderation actions record administrator, action, reason, and timestamp.
- Feed caches are invalidated after moderation.

### US-005: Receive In-App Notification
**As a** user, **I want to** receive an in-app notification when I receive kudos, **so that** I know I have been recognised.

**Acceptance criteria**
- A notification record is created when kudos are submitted.
- Notification creation failure does not fail the kudos submission.
- Authenticated users can retrieve their notifications and unread count.
- Notifications can be marked as read.

## 3. Functional Requirements

- **FR-001 Authentication:** Protected operations use the existing JWT bearer-token authentication mechanism.
- **FR-002 Validation:** Joi validates request bodies, query parameters, and UUID route parameters.
- **FR-003 Message safety:** User messages are sanitised server-side to remove HTML/control characters and rendered as text on the frontend. Simple `**bold**`, `*italic*`, and line breaks are supported without `dangerouslySetInnerHTML`.
- **FR-004 Rate limiting:** Kudos submission is limited to 50 per user per UTC day using Redis. If Redis is unavailable, submission fails closed with HTTP 503 rather than bypassing the abuse-control requirement.
- **FR-005 Feed caching:** Recent feed responses are cached in Redis for five minutes and invalidated after submission, hiding, deletion, or flagging.
- **FR-006 Soft deletion:** User and admin deletion sets `deleted_at` and does not physically remove the kudos record.
- **FR-007 Moderation:** Flagged kudos remain available to administrators for review. Hidden/deleted content is excluded from the public feed.

## 4. Non-Functional Requirements

- **Security:** Parameterised SQL queries, Helmet, restricted CORS, JWT authentication, role-based admin authorisation, CSRF origin checks for browser state-changing requests, server-side sanitisation, and rate limiting.
- **Performance:** Feed queries use indexes and Redis caching; API pagination prevents unbounded result sets.
- **Availability:** Notification failures are isolated from the primary kudos submission path.
- **Accessibility:** The frontend uses labels, keyboard-accessible controls, semantic buttons, visible status/error messages, and responsive layouts.
- **Responsive design:** The dashboard is usable on desktop and mobile-sized screens.
- **Observability:** Backend errors and important operations are logged through Winston.

## 5. Technical Design

### 5.1 Architecture

```text
React + Vite frontend
        |
        | HTTP/JSON + Bearer JWT
        v
Node.js + Express API
   |             |
   v             v
PostgreSQL      Redis
   |             |
   +-- kudos    +-- feed cache / rate limits
   +-- users
   +-- kudos_flags
   +-- notifications
   +-- notification_preferences
   +-- moderation_audit_logs
```

### 5.2 Technology Stack

- Frontend: React 18, TypeScript, Vite, Tailwind CSS, Axios
- Backend: Node.js 18+, Express, TypeScript
- Database: PostgreSQL 13+
- Cache/rate limiting: Redis 7+
- Validation: Joi
- Authentication: JWT bearer tokens
- Logging: Winston

## 6. Database Design

### `users`
- `id` UUID primary key
- `name`, `email`, `avatar_url`, `department`
- `role` (`user` or `admin`)
- timestamps

### `kudos`
- `id` UUID primary key
- `sender_id` and `recipient_id` foreign keys to `users`
- `message` with 10–500 character database constraint
- `is_anonymous` boolean
- `created_at`, `updated_at`
- `deleted_at` nullable for soft deletion
- `is_flagged` boolean
- **`is_visible` boolean DEFAULT TRUE** for moderation visibility
- `flag_count` integer
- constraint preventing sender = recipient

Indexes support recipient history, sender history, chronological feed, flagged records, and visibility filtering.

### `kudos_flags`
Stores one report per user per kudos with reason, optional details, and timestamp. A unique `(kudos_id, user_id)` constraint prevents duplicate reports.

### `notifications`
Stores in-app notifications with user, kudos, read state, and timestamps.

### `notification_preferences`
Stores optional notification preferences for future email/preference features.

### `moderation_audit_logs`
Stores moderation `kudos_id`, `admin_user_id`, action (`hide`/`delete`), reason, and timestamp.

## 7. API

Base path: `/api/v1/kudos`

| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| POST | `/submit` | User | Submit kudos |
| GET | `/feed` | Public/read | Paginated recent feed |
| GET | `/me/received` | User | Received history |
| GET | `/me/sent` | User | Sent history |
| GET | `/users/search` | User | Search colleagues |
| POST | `/:kudos_id/flag` | User | Report kudos |
| DELETE | `/:kudos_id` | User | Delete own kudos within 24 hours |
| GET | `/notifications` | User | Retrieve notifications |
| GET | `/notifications/unread-count` | User | Retrieve unread count |
| POST | `/notifications/:id/read` | User | Mark notification read |
| GET | `/admin/flagged` | Admin | Review flagged kudos |
| POST | `/admin/:kudos_id/hide` | Admin | Hide kudos |
| POST | `/admin/:kudos_id/delete` | Admin | Soft-delete kudos |

## 8. Frontend Design

The dashboard contains:

1. **Kudos form** — colleague search, 10–500 character message, character counter, anonymous option, validation, and submission feedback.
2. **Kudos feed** — newest-first cards, recipient search, pagination, timestamps, and report action.
3. **Report modal** — moderation reason selection and submission.
4. **Notification indicator** — unread count with periodic polling.
5. **Admin moderation section** — flagged kudos list with hide/delete actions. Server-side role checks remain authoritative.

## 9. Implementation and Verification Plan

1. Run PostgreSQL and Redis locally.
2. Install backend and frontend dependencies with `npm install`.
3. Configure `.env` from `.env.example`.
4. Run `npm run migrate` from `backend`.
5. Start the backend with `npm run dev` and frontend with `npm run dev`.
6. Verify health endpoint and critical user flows.
7. Verify normal users cannot access admin endpoints.
8. Verify hidden/deleted kudos disappear from the public feed.
9. Verify malicious HTML is not executed/rendered as HTML.
10. Verify the 50/day rate limit and safe Redis failure behaviour.

## 10. Approval

This document is the final approved v1.0 specification for the submitted implementation. Optional features such as email notifications, badges, leaderboards, Slack integration, and department-specific feeds are outside the v1.0 scope.
