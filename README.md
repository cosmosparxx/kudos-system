# Kudos System - Internal Web App

A small internal recognition feature that lets authenticated employees give kudos to colleagues and review a shared recent feed. Users can report inappropriate content and administrators can moderate it.

## Project Structure

```text
kudos/
├── backend/                 # Node.js/Express API
├── frontend/                # React/Vite dashboard
├── database/                # Database setup guide
├── FEATURE_SPECIFICATION.md # Original detailed draft
├── SPECIFICATION.md         # Final approved v1.0 specification
└── README.md
```

## Prerequisites

- Node.js 18+
- npm
- PostgreSQL 13+
- Redis 7+

## Run locally

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Set DB and JWT values in .env
npm run migrate
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend defaults to `/api/v1` and Vite proxies `/api` to `http://localhost:3000` during development.

## Main Features

- Submit kudos to another employee
- Optional anonymous kudos
- Recent public feed with search and pagination
- In-app notifications
- Report inappropriate kudos
- Admin flagged-content queue
- Admin hide/soft-delete moderation
- Redis caching and per-user rate limiting
- Server-side message sanitisation

## API Health Check

```bash
curl http://localhost:3000/api/v1/health
```

## Documentation

- `SPECIFICATION.md` — final approved v1.0 scope and technical design
- `FEATURE_SPECIFICATION.md` — original detailed specification draft
- `DEVELOPMENT.md` — local development notes
- `database/SETUP.md` — PostgreSQL setup
