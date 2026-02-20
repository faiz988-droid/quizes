# replit.md

## Overview

This is a **mobile-first daily quiz / MCQ exam web application** called "SecureExam.OS". It's designed for serious competitive quizzes and mock exams with strong anti-cheating enforcement. Key characteristics:

- **No leaderboards or scores visible to users** — only the admin panel can view results and rankings
- **Mandatory user identification** before any quiz access (name bound permanently to device ID)
- **Mobile lockdown behavior** during exams (fullscreen enforcement, tab-switch detection, blur detection)
- **Deterministic scoring** with base marks, deductions, bonuses, and answer ordering
- **Admin dashboard** for managing questions, viewing results, and exporting data (XLSX)

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (Client)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State/Data Fetching**: TanStack React Query for server state management
- **UI Components**: shadcn/ui (new-york style) built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming, PostCSS
- **Animations**: Framer Motion for page transitions and micro-interactions
- **Charts**: Recharts for admin dashboard analytics
- **Forms**: React Hook Form with Zod resolvers via @hookform/resolvers
- **Build Tool**: Vite with React plugin
- **Path aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

**Key Pages**:
- `/` (Home) — Identity check / participant entry point
- `/exam` — Exam interface with lockdown mode
- `/admin` — Admin login, dashboard, question management, results

**Anti-Cheat (Client-side)**:
- Device ID generated via UUID and persisted in localStorage
- Lockdown hook (`use-lockdown.ts`) monitors: visibility changes, window blur, fullscreen exit
- Violations auto-submit the exam with a null answer
- Heartbeat system to track active participants

### Backend (Server)
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript, executed via `tsx`
- **API Style**: RESTful JSON API under `/api/*` prefix
- **Route Definitions**: Shared route contracts in `shared/routes.ts` using Zod schemas for input/output validation
- **Build**: Custom build script using esbuild for server + Vite for client, outputs to `dist/`

**Key API Endpoints**:
- `POST /api/identify` — Register/verify participant by name + device ID
- `GET /api/question/daily` — Fetch today's question
- `POST /api/submit` — Submit an answer
- `POST /api/heartbeat` — Keep-alive from exam client
- `POST /api/admin/login` — Admin authentication
- `GET /api/admin/stats` — Dashboard statistics
- `GET /api/admin/results` — Leaderboard/results (admin only)
- CRUD for questions under `/api/admin/questions`
- Excel export functionality via `xlsx` library

### Database
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with `drizzle-zod` for schema-to-Zod conversion
- **Schema location**: `shared/schema.ts`
- **Migrations**: Drizzle Kit with `drizzle-kit push` (no migration files, direct push)
- **Connection**: `pg` Pool via `DATABASE_URL` environment variable
- **Session store**: `connect-pg-simple` available for session management

**Core Tables**:
- `participants` — id, name, deviceId, isBanned, timestamps
- `admins` — id, username, password (hashed)
- `questions` — id, content, options (JSONB), correctAnswerIndex, quizDate, order, isActive, resetId
- `submissions` — id, participantId, questionId, answerIndex, status, answerOrder, wrongAttemptOrder, timestamps, scoring fields (baseMarks, deductionMarks, bonusPercentage, finalScore)
- `settings` — currentResetId (for resetting competition data)

### Shared Layer (`shared/`)
- `schema.ts` — Drizzle table definitions, insert schemas, Zod validation schemas (identifySchema, submitAnswerSchema, heartbeatSchema, insertQuestionSchema)
- `routes.ts` — API contract definitions with paths, methods, input/output Zod schemas. Acts as a type-safe contract between frontend and backend.

### Storage Pattern
- `IStorage` interface in `server/storage.ts` defines all data access methods
- `DatabaseStorage` class implements the interface using Drizzle queries
- Exported as singleton `storage` for use in routes

### Dev vs Production
- **Development**: Vite dev server with HMR proxied through Express, uses `@replit/vite-plugin-*` plugins
- **Production**: Client built to `dist/public/`, server bundled to `dist/index.cjs` via esbuild, served as static files with SPA fallback

## External Dependencies

### Required Services
- **PostgreSQL Database** — Required. Connection via `DATABASE_URL` environment variable. Must be provisioned before the app can start.

### Key NPM Packages
- `express` v5 — HTTP server
- `drizzle-orm` + `drizzle-kit` — Database ORM and migration tooling
- `pg` — PostgreSQL client
- `zod` — Runtime validation (shared between client and server)
- `uuid` — Device ID generation
- `xlsx` — Excel export for admin results
- `date-fns` — Date formatting
- `framer-motion` — Animations
- `recharts` — Admin charts
- `react-hook-form` — Form handling
- `wouter` — Client routing
- `@tanstack/react-query` — Server state management
- `connect-pg-simple` — PostgreSQL session store
- Various `@radix-ui/*` — UI primitives for shadcn components

### Replit-Specific
- `@replit/vite-plugin-runtime-error-modal` — Runtime error overlay
- `@replit/vite-plugin-cartographer` — Dev tooling (dev only)
- `@replit/vite-plugin-dev-banner` — Dev banner (dev only)