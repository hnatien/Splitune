# Step 04 — API skeleton and authentication

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/04-api-contract.md` (primary spec)
- `docs/implementation/14-auth-billing-and-entitlements.md` §1 (auth) — billing comes in step 14
- `docs/implementation/17-security.md` §2, §5 (authz, headers, CSRF, rate limits)
- `docs/implementation/25-personal-mode.md` §1 (one Railway `app` service; API mounted under `/v1`)

Prerequisites: Steps 01–03.

## Goal
`apps/api`: a Hono + oRPC server implementing the shared contract with Better Auth sessions, the error model, rate limiting and the songs/uploads/me endpoints, ready to be mounted inside the TanStack Start server in step 10 (and runnable standalone for tests).

## Deliverables
1. **Server:** Hono app exporting `createApi({ db, storage, config })` so it can run standalone (`pnpm --filter api dev`) or be mounted by the web server. oRPC handlers bound to the contract from `packages/contracts`; OpenAPI 3.1 document served at `/v1/openapi.json`.
2. **Auth (Better Auth 1.7):** Drizzle adapter on the same Postgres; magic link (email via SMTP → Mailpit locally), Google OAuth (configurable, disabled when env vars are missing), session cookies (HttpOnly, Secure in prod, SameSite=Lax). A middleware that resolves `userId` and wraps handlers in `withUser`. Re-auth requirement helper for destructive actions.
3. **Endpoints now:** `GET/PATCH /v1/me`, songs CRUD, `POST /v1/uploads` (multipart init with presigned part URLs, duplicate detection by `file_sha256`), `POST /v1/uploads/{id}/parts` (refresh URLs), `POST /v1/uploads/{id}/complete` (completes the multipart upload and marks it `uploaded`; it does **not** start analysis — analysis is requested explicitly via `POST /v1/analyses` in step 09), `DELETE /v1/uploads/{id}`, `DELETE /v1/songs/{id}` (DB cascade + enqueue `delete_prefix` job for the node worker), health/ready endpoints.
4. **Cross-cutting:** uniform error envelope and codes; 404 for not-owned resources; per-user and per-IP rate limits (Postgres-backed or in-memory with a clear note); CSRF custom-header check for cookie-authenticated mutations; CORS limited to configured origins; structured JSON logging with request ids and no URLs/query strings that could contain presigned signatures.
5. **Authorization matrix test generator:** for every procedure with a resource id, user B and anonymous must get 404/401 for user A's resources.

## Out of scope
Analyses, SSE, corrections, loops, billing, URL import (later steps add them to this app).

## Acceptance criteria
- Magic-link sign-in works end to end locally (email visible in Mailpit, session created).
- All endpoints above validate input with the shared Zod schemas and return documented error codes.
- Authz matrix passes; RLS is active for the `app` role (verified by a test that bypasses the repo layer and still can't read another user's row).
- OpenAPI document generated and valid (lint it with an OpenAPI validator).

## Verification to run and report
`pnpm --filter api test` (integration against compose Postgres + SeaweedFS + Mailpit), a scripted magic-link flow (Vitest or a small script using Mailpit's API), OpenAPI validation command, `pnpm typecheck`, `pnpm lint`.
