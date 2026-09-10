# Private Friends Chat

Self-hosted, invite-only chat app. This repository contains the secure access foundation for a private friends chat: there is no public sign-up route and access can be provisioned only by the local owner/admin workflow.

## Prerequisites

- Node.js 24+ and npm 11+
- Docker Desktop (for PostgreSQL)

## Start locally

1. Copy `.env.example` to `.env` and replace `POSTGRES_PASSWORD`.
2. Copy `apps/api/.env.example` to `apps/api/.env`, set `DATABASE_URL`, and generate a unique `SESSION_SECRET` of at least 32 characters.
3. Copy `apps/web/.env.example` to `apps/web/.env` only if the frontend needs a non-default API location.
4. Run `npm install`.
5. Run `npm run db:up`.
6. Run `npm run db:migrate`.
7. Run `npm run create-owner` once to create the first owner through the local terminal.
8. Run `npm run dev`.

The web app is served at `http://localhost:5173`; the API health check is at `http://localhost:3000/api/health`.

## Scripts

- `npm run dev` — start API and web app
- `npm run check` — strict TypeScript checks
- `npm run build` — production builds
- `npm run test` — available Phase 1 tests
- `npm run db:up` / `npm run db:down` — manage local PostgreSQL
- `npm run db:migrate` — apply versioned database migrations
- `npm run create-owner` — interactively create the one-time initial OWNER account

## Proposed architecture

- **Web:** React PWA-oriented client; communicates only with the API over HTTPS in deployment.
- **API:** Fastify modular API. Later modules will cover invitation-only identity, members, conversations, messages, media, real-time events, and calls.
- **Data:** self-hosted PostgreSQL for relational data; media will later be private filesystem/S3-compatible self-hosted object storage, never public URLs.
- **Security:** passwords use Argon2id. Sessions are opaque random values held only in HttpOnly, SameSite cookies; their HMAC hashes—not raw tokens—are stored in PostgreSQL. Login rate limiting, failure throttling, account-status checks, and privacy-conscious security events are included.
- **Real time:** later add WebSocket events for presence, typing, receipts, notifications; WebRTC with a self-hosted TURN service for calls.

## Authentication

There is deliberately no public registration endpoint. The first OWNER account can only be created locally with `npm run create-owner`; later phases add admin-controlled invitation redemption.

The API provides `POST /api/auth/login`, `POST /api/auth/logout`, and `GET /api/auth/me`. Members can sign in with their invited username or email address. All private HTTP and WebSocket routes must use the same server-side session verification used by `/api/private/ping`.

The browser never receives the session token: it remains in an HttpOnly, SameSite cookie. Passwords are hashed with Argon2id, login attempts are rate-limited, and disabled or removed accounts lose access immediately.

For production, use HTTPS, set `NODE_ENV=production`, use a strong unique `SESSION_SECRET`, and put the frontend/API behind the same trusted origin or a correctly configured reverse proxy.

## Current limits

Chat, invitation redemption, member administration, media, WebSockets, and calls are later phases. Docker Desktop must be installed and running before the PostgreSQL migration and owner bootstrap commands can run.
