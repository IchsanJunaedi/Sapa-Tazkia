# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**SAPA-TAZKIA** is an AI-powered academic assistant for university students. It uses RAG (Retrieval-Augmented Generation) to answer academic questions and provides grade/transcript management. Users can authenticate via NIM+password or Google OAuth.

## Development Commands

### Backend (`/backend`)
```bash
npm run dev          # Start with nodemon (development)
npm start            # Production server
npm run db:push      # Apply Prisma schema changes
npm run db:studio    # Open Prisma Studio GUI
npm run seed         # Seed database
npm run reset:redis  # Clear Redis cache
npm run lint         # ESLint check
npm run lint:fix     # Auto-fix lint issues
```

### Frontend (`/frontend`)
```bash
npm start            # Dev server on port 3000
npm run build        # Production build
npm test             # Run test suite
```

### Infrastructure (Docker)
```bash
docker-compose up -d           # Start all services (MySQL:3308, Redis:6379, Qdrant:6333)
docker-compose down            # Stop services
docker-compose logs -f <svc>   # Stream logs for a service
```

## Architecture

### Stack
- **Backend**: Node.js/Express (entry: `backend/src/app.js`)
- **Frontend**: React 19 + Tailwind CSS + React Router v6 (entry: `frontend/src/App.js`)
- **Database**: MySQL via Prisma ORM
- **Vector DB**: Qdrant (for RAG embeddings)
- **Cache/Sessions**: Redis
- **AI**: OpenAI API (gpt-4o-mini + text-embedding-3-small)

### Backend Layer Structure
```
controllers/  → HTTP request/response handling
services/     → Business logic (call from controllers only)
middleware/   → authMiddleware, rateLimitMiddleware, validationMiddleware
routes/       → Route definitions (import controllers, apply middleware)
config/       → prismaClient singleton, swagger, rateLimitConfig
```

### Authentication Flow
1. **NIM+password** or **Google OAuth** (Passport.js) → JWT token issued
2. JWT validated by `authMiddleware.js` → `requireAuth` or `optionalAuth`
3. Google OAuth uses Redis-backed express-session for callback state
4. Frontend stores JWT in context (`AuthContext.js`) and sends as Bearer token

### RAG Pipeline
1. Documents ingested → embedded via OpenAI text-embedding-3-small → stored in Qdrant
2. User query → cosine similarity search in Qdrant → top chunks retrieved
3. Chunks + query sent to GPT → response returned
4. Trigger manual ingestion: `POST /api/ai/ingest-now`

### Rate Limiting
Multi-layer: IP → Guest → User → Premium tiers, token bucket algorithm, persisted in Redis + logged to MySQL. Config in `backend/src/config/rateLimitConfig.js`.

### Guest vs Authenticated Chat
- Guests use `POST /api/guest/chat` with a session ID (no auth required)
- Authenticated users use `POST /api/ai/chat` with JWT
- Both routes ultimately call the same RAG + OpenAI pipeline

### Key API Routes
| Prefix | Controller |
|--------|-----------|
| `/api/auth` | authController.js |
| `/api/ai` | aiController.js |
| `/api/guest` | guestController.js |
| `/api/academic` | academicController.js |
| `/api/admin` | adminController.js |
| `/api/rate-limit` | rateLimitController.js |

Swagger docs available at `GET /api/docs` when backend is running.

### Frontend Routing
Protected routes wrap with `<ProtectedRoute>` from `components/common/ProtectedRoute.jsx`. Admin routes use `adminOnly={true}` prop.

```
/                  → LandingPage (public)
/login             → LoginPage (public)
/auth/callback     → AuthCallback (Google OAuth)
/about-you         → Profile setup (protected)
/academic          → Grades & transcript (protected)
/chat, /chat/:id   → AI chat (protected)
/admin/login       → AdminLogin (public)
/admin/dashboard   → AdminDashboard (adminOnly)
```

## Environment Setup

Copy `.env.example` files in root, `backend/`, and `frontend/`. Key variables:
- `DATABASE_URL` — MySQL connection string (port 3308 in Docker)
- `OPENAI_API_KEY` — Required for chat and embeddings
- `QDRANT_HOST` / `QDRANT_PORT` — Vector DB connection
- `REDIS_URL` — Session and rate limit cache
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth
- `JWT_SECRET` / `SESSION_SECRET` — Auth secrets
- `REACT_APP_API_URL` — Frontend API base URL

## Database

Schema defined in `backend/prisma/schema.prisma`. Key models:
- `User`, `Session` — Auth
- `ProgramStudi`, `Course`, `AcademicGrade`, `AcademicSummary` — Academic
- `Conversation`, `Message` — Chat history
- `RateLimit`, `RateLimitLog` — Rate limiting

After schema changes: `npm run db:push` (development) or generate a migration.
