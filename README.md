# AIROVE

Aviation Operations Intelligence Platform

## Architecture

AIROVE uses a layered architecture:

- **Layer 1**: Core Infrastructure (this repository)
- **Layer 2+**: Business Logic (built on top of Layer 1)

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | Next.js 14+ (App Router) |
| Edge/CDN | Cloudflare Pages |
| Backend | Hono on Node.js |
| Database | Neon PostgreSQL + Drizzle ORM |
| Redis | Upstash Redis |
| Object Storage | Cloudflare R2 |
| Queue | BullMQ |
| Auth | Better Auth |

## Project Structure

```
airove/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # Hono API server
├── packages/
│   ├── shared/       # Shared types, schemas, constants
│   └── db/           # Database schema + migrations
├── turbo.json
└── package.json
```

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with your values

# Run database migrations
npm run db:generate
npm run db:migrate

# Start development
npm run dev
```

## Environment Variables

See `.env.example` for required environment variables.

## Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all services in dev mode |
| `npm run build` | Build all packages |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript checks |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Run database migrations |
