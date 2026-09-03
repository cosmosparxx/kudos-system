# Development Guide - Kudos System

## Getting Started

### System Requirements
- Node.js 18+
- npm or yarn
- PostgreSQL 13+
- Redis 7+
- Git

### Installation Steps

#### 1. Clone or Initialize Project
```bash
cd kudos
```

#### 2. Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Edit .env with your configuration
nano .env

# Install and run database migrations
npm run migrate
```

**Backend .env Configuration:**
```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=kudos_db
REDIS_HOST=localhost
REDIS_PORT=6379
FRONTEND_URL=http://localhost:5173
JWT_SECRET=your-secret-key-change-in-production
```

#### 3. Frontend Setup

```bash
cd ../frontend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

**Frontend .env Configuration:**
```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

#### 4. Database Setup

See [database/SETUP.md](../database/SETUP.md) for detailed instructions.

Quick setup:
```bash
# Create database
createdb kudos_db

# Create user (optional)
psql -U postgres -c "CREATE USER kudos_user WITH PASSWORD 'password';"
```

#### 5. Redis Setup

**macOS (with Homebrew):**
```bash
brew install redis
brew services start redis
```

**Linux:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis-server
```

**Windows:**
- Download from https://github.com/microsoftarchive/redis/releases
- Or use Windows Subsystem for Linux (WSL)

## Running the Application

### Terminal 1: Backend Server
```bash
cd backend
npm run dev
```

The API will be available at `http://localhost:3000/api/v1`

### Terminal 2: Frontend Development Server
```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Verify Everything is Working

1. **API Health Check:**
   ```bash
   curl http://localhost:3000/api/v1/health
   ```
   Expected response: `{"status":"ok","timestamp":"..."}`

2. **Frontend:** Open http://localhost:5173 in your browser

## Project Structure

```
backend/
├── src/
│   ├── index.ts                 # Express app entry
│   ├── database/
│   │   ├── db.ts               # Database connection
│   │   ├── migrate.ts           # Migrations
│   │   └── rollback.ts          # Rollback migrations
│   ├── cache/
│   │   └── redis.ts             # Redis operations
│   ├── utils/
│   │   ├── logger.ts            # Logging
│   │   └── validation.ts        # Joi schemas
│   ├── routes/                  # API endpoints
│   ├── services/                # Business logic
│   └── middleware/              # Authentication, CSRF and rate limiting
├── package.json
├── tsconfig.json
└── .env.example

frontend/
├── src/
│   ├── main.tsx                 # React entry
│   ├── App.tsx                  # Main component
│   ├── index.css                # Global styles
│   ├── pages/
│   │   └── Dashboard.tsx        # Main dashboard
│   ├── components/              # Reusable components (when expanded)
│   ├── utils/
│   │   └── api.ts               # API client
│   └── types/                   # TypeScript types (when expanded)
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
└── postcss.config.js
```

## Available Scripts

### Backend
```bash
npm run dev              # Start development server with hot reload
npm run build            # Build TypeScript
npm start                # Run compiled JavaScript
npm run migrate          # Run database migrations
npm run migrate:rollback # Rollback migrations
npm run lint             # Lint code
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
```

### Frontend
```bash
npm run dev     # Start development server
npm run build   # Build for production
npm run lint    # Lint code
npm run preview # Preview production build
```

## Database Migrations

Migrations are automatically tracked in the `migrations` table.

### Create a New Migration

1. Add migration to `backend/src/database/migrate.ts`
2. Follow the existing pattern in the `migrations` array
3. Run `npm run migrate`

### Rollback Migrations

Create `backend/src/database/rollback.ts` with the reverse operations:

```typescript
// Example rollback
const rollback = async () => {
  await query('DROP TABLE IF EXISTS kudos CASCADE;');
  // Add more rollback statements
};
```

## API Documentation

See [FEATURE_SPECIFICATION.md](../FEATURE_SPECIFICATION.md) Section 7 for full API endpoint documentation.

### Key Endpoints
- `POST /api/v1/kudos/submit` - Create new kudos
- `GET /api/v1/kudos/feed` - Get recent kudos
- `GET /api/v1/kudos/me/received` - Get received kudos
- `GET /api/v1/kudos/me/sent` - Get sent kudos
- `POST /api/v1/kudos/{id}/flag` - Report inappropriate kudos
- `GET /api/v1/users/search` - Search users

## Authentication (To Be Implemented)

Authentication will use JWT tokens. Middleware to be added to:
- Verify JWT on protected routes
- Attach user info to request
- Handle unauthorized access

## Testing

### Run Backend Tests
```bash
cd backend
npm test
npm run test:watch
```

### Run Frontend Tests
```bash
cd frontend
npm test
npm run test:watch
```

## Debugging

### Backend Debugging in VS Code

Add to `.vscode/launch.json`:
```json
{
  "type": "node",
  "request": "launch",
  "name": "Launch Backend",
  "program": "${workspaceFolder}/backend/dist/index.js",
  "preLaunchTask": "npm: build",
  "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"]
}
```

### Frontend Debugging

Chrome DevTools debugging is built into Vite. Open DevTools in browser.

## Common Issues

### Port Already in Use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Kill process on port 5173
lsof -ti:5173 | xargs kill -9
```

### Database Connection Errors
- Verify PostgreSQL is running: `psql -U postgres -l`
- Check .env credentials
- Ensure database exists: `createdb kudos_db`

### Redis Connection Errors
- Verify Redis is running: `redis-cli ping`
- Check host and port in .env

### TypeScript Errors
```bash
# Clear build cache
rm -rf dist node_modules
npm install
npm run build
```

## Building for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
# Serve dist folder with a production server
```

## Environment Variables

See `.env.example` files in backend and frontend directories.

**Critical for production:**
- Change `JWT_SECRET` to a strong random value
- Set `NODE_ENV=production`
- Use strong database password
- Configure appropriate CORS origins
- Set up Redis with password

## Next Steps

1. Complete Phase 1 foundation tasks
2. Implement authentication middleware
3. Create rate limiting for kudos (50 per user per day)
4. Build user service with search
5. Implement core API endpoints
6. Create React components

See [FEATURE_SPECIFICATION.md](../FEATURE_SPECIFICATION.md) Section 9 for complete implementation plan.

## Support

Refer to `FEATURE_SPECIFICATION.md` for detailed requirements and design documentation.
