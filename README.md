# Kudos System - Internal Web App

A feature for recognizing and appreciating colleagues through public kudos submissions and a shared feed.

## Project Structure

```
kudos/
├── backend/              # Node.js/Express API server
├── frontend/             # React application
├── database/             # Database migrations and setup scripts
├── FEATURE_SPECIFICATION.md
└── README.md
```

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- PostgreSQL 13+
- Redis 7+

### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm run migrate
npm run dev
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Technology Stack

**Backend:**
- Node.js 18+
- Express.js
- PostgreSQL 13+
- Redis 7+
- Axios

**Frontend:**
- React 18+
- Vite
- Tailwind CSS
- Axios

## Features

- ✅ Submit kudos to colleagues
- ✅ View public kudos feed
- ✅ In-app notifications
- ✅ Personal kudos history
- ✅ Report inappropriate content
- ✅ Admin moderation dashboard

## Documentation

See `FEATURE_SPECIFICATION.md` for detailed requirements and design documentation.

## Development Status

Implementation in progress - Phase 1: Foundation
