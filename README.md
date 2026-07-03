# 💰 LedgerFlow API

> A production-ready personal finance tracking REST API — multi-account, session-authenticated, and engineered for data integrity under concurrent load.

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [API Reference](#api-reference)
  - [Auth](#auth)
  - [Users](#users)
  - [Accounts](#accounts)
  - [Transactions](#transactions)
  - [Tags](#tags)
- [Middleware & Authorization](#middleware--authorization)
- [Data Integrity & Architecture Decisions](#data-integrity--architecture-decisions)
- [Caching Strategy](#caching-strategy)
- [Validation](#validation)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Project Structure](#project-structure)

---

## Overview

LedgerFlow is a multi-user financial tracking API where each user can manage multiple accounts (bank, wallet, or UPI) and record income or expense transactions against them. Accounts have a running balance that automatically updates whenever a transaction is created, updated, soft-deleted, or recovered. All balance mutations run inside PostgreSQL database transactions with row-level locking to prevent race conditions. The API is fully session-authenticated — every protected route requires a valid session cookie. Read-heavy endpoints (accounts, transactions, tags) are backed by a **versioned Redis cache** to reduce database load, with automatic invalidation on any write.

---

## Features

- **User authentication** — register, login, logout with session-based auth; passwords hashed with bcrypt
- **Session persistence** — sessions stored in PostgreSQL via `connect-pg-simple`, survive server restarts, expire after 7 days
- **Multi-account support** — create and manage accounts of type `bank`, `wallet`, or `upi`; account names are unique per user
- **Income & expense tracking** — record transactions with amount, type, description, date, and tags
- **Automatic balance updates** — creating, updating, soft-deleting, or recovering a transaction atomically adjusts the linked account balance
- **Soft delete & recovery** — deleted transactions set a `deletedAt` timestamp; the account balance is reversed on delete and reapplied on recover; soft-deleted transactions are excluded from list queries
- **Race condition safety** — all balance-affecting operations lock the account row with `SELECT ... FOR UPDATE` inside a database transaction
- **Tags system** — users create their own reusable tags (unique per user); tags are attached to transactions by ID; duplicate tags on the same transaction are rejected at the database level via a unique composite index
- **Ownership enforcement** — dedicated middleware verifies account, transaction, and tag ownership on every protected route; unauthorized access returns `403`
- **Request validation** — all route params, request bodies, and query strings are validated with Zod; env variables validated at startup
- **Filtering & pagination** — accounts filterable by name and type; transactions filterable by type, description, date range (`afterDate`, `befourDate`); cursor-style `nextPage` pagination
- **Redis caching** — accounts, transactions, and tags reads are cached per-user with a versioned key scheme; any create/update/delete/recover operation invalidates the relevant namespace instantly, with no manual key tracking or bulk deletes required
- **Constraint-level guards** — PostgreSQL `CHECK` constraints enforce `balance >= 0` and `amount > 0`; the error handler maps constraint violations to clean API error responses
- **ESLint + TypeScript strict mode** — `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` all enabled
- **Full test coverage** — every route tested with Vitest and Supertest; tests run sequentially against a dedicated test database

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js (ESM, native `--watch`) |
| Framework | Express.js v5 |
| Language | TypeScript (`tsx` runner, `nodenext` module) |
| Database | PostgreSQL |
| ORM | Drizzle ORM |
| Cache | Redis (`redis` client) |
| Validation | Zod |
| Auth | express-session + bcrypt |
| Session Store | connect-pg-simple (`user_sessions` table, auto-created) |
| Testing | Vitest + Supertest |
| Linting | ESLint + typescript-eslint |

---

## Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL 15+
- Redis 6+

### Installation

```bash
git clone https://github.com/ashifthekkupuram/ledgerflow-api.git
cd ledgerflow-api
npm install
cp .env.example .env
# fill in your values in .env
```

### Database Setup

```bash
npx drizzle-kit push
```

This pushes the schema to your database. The `user_sessions` table is created automatically by `connect-pg-simple` on first server start.

### Redis Setup

Make sure a Redis instance is running and reachable at the URL configured in `REDIS_URI` (see [Environment Variables](#environment-variables)). Locally, the quickest option is:

```bash
docker run -d --name ledgerflow-redis -p 6379:6379 redis:7-alpine
```

The server establishes the Redis connection on startup (`initializeRedisClient()` in `src/index.ts`) before it begins accepting requests. If Redis is unreachable at boot, the server logs the error and exits — caching is treated as a required dependency, not an optional one.

### Running

```bash
# Development (native Node file watch)
npm run dev

# Production
npm run start
```

---

## Environment Variables

```env
APP_STAGE=dev                        # dev | testing | production
NODE_ENV=development                 # development | test | production
PORT=8000
DATABASE_CONNECTION_URL=postgresql://user:password@localhost/mydatabase
REDIS_URI=redis://localhost:6379     # Redis connection string
CACHE_TTL_SECONDS=3600               # default TTL for cached reads (min: 60)
COOKIE_SECRET_KEY=your_secret_key_must_be_at_least_32_chars
PASSWORD_SALT_ROUNDS=12              # min: 10, max: 20
ACCOUNTS_PAGE_LIMIT=8
TRANSACTION_PAGE_LIMIT=8
CORS_ORIGINS=http://localhost:5173   # space-separated for multiple origins
```

All variables are validated at startup via Zod. The server exits immediately with a descriptive error if any variable is missing or invalid. For testing, create `.env.test` — it is loaded automatically when `APP_STAGE=testing`. `.env.test` typically points `REDIS_URI` at a separate database index (e.g. `redis://localhost:6379/1`) so cached test data never collides with development data.

---

## Database Schema

6 tables across 3 domains:

**Users & Auth**
- `users` — `id`, `email` (unique), `username` (unique), `name`, `password`, timestamps

**Accounts**
- `accounts` — `id`, `name`, `userId` (→ users), `balance` (decimal 12,2), `type` enum(`bank`, `wallet`, `upi`), timestamps
  - CHECK: `balance >= 0`
  - UNIQUE: `(userId, name)` — no two accounts with the same name per user
  - INDEX: `(userId, type)`

**Transactions & Tags**
- `account_transactions` — `id`, `accountId` (→ accounts), `amount` (decimal 12,2), `type` enum(`income`, `expense`), `description`, `transactionDate`, `deletedAt` (soft delete), timestamps
  - CHECK: `amount > 0`
  - INDEX: `transactionDate`, `(accountId, transactionDate)`, `(accountId, type)`
- `tags` — `id`, `name` (max 15 chars), `userId` (→ users), timestamps
  - UNIQUE: `(userId, name)` — tag names are unique per user
  - INDEX: `userId`
- `transaction_tags` — `id`, `accountTransactionId` (→ account_transactions), `tagId` (→ tags), timestamps
  - UNIQUE: `(accountTransactionId, tagId)` — prevents duplicate tags on the same transaction
  - INDEX: `accountTransactionId`, `tagId`

All foreign keys use `onDelete: cascade`.

> **Note:** Redis is not a system of record for any of the above — it only ever holds derived, disposable copies of query results keyed off the current version counter. PostgreSQL remains the single source of truth; the cache can be flushed entirely at any time with no data loss.

---

## API Reference

All protected routes require an active session cookie (`connect.sid`). Unauthenticated requests return `401`. `GET` routes on accounts, transactions, and tags are cache-backed as described in [Caching Strategy](#caching-strategy); this is transparent to clients — cached and non-cached responses have identical shapes.

---

### Auth

#### `POST /api/auth/register`

```json
{
  "email": "ashif@example.com",
  "username": "ashif",       // 4–50 chars
  "name": "Ashif Hussain",   // optional, 4–50 chars
  "password": "secret1234"   // min 8 chars
}
```

**Response `201`**
```json
{
  "message": "Register Successfull",
  "user": { "id": "uuid", "email": "...", "username": "...", "name": "...", "createdAt": "..." }
}
```

Sets session cookie. Password is never returned.

---

#### `POST /api/auth/login`

```json
{
  "email": "ashif@example.com",
  "password": "secret1234"
}
```

**Response `200`**
```json
{
  "message": "Login Successfull",
  "user": { "id": "uuid", "email": "...", "username": "...", "name": "...", "createdAt": "..." }
}
```

Regenerates session on login. Returns `400` for invalid credentials (same message for both wrong email and wrong password — no enumeration).

---

#### `POST /api/auth/logout`

No body. Destroys session, clears `connect.sid` cookie.

---

### Users

All routes require authentication.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/users` | Get current user's profile |
| `PATCH` | `/api/users` | Update username and/or name |
| `POST` | `/api/users/change-password` | Change password (destroys session on success) |

#### `PATCH /api/users`

```json
{
  "username": "new_username",  // optional, 4–50 chars
  "name": "New Name"           // optional, 4–50 chars
}
```

#### `POST /api/users/change-password`

```json
{
  "oldPassword": "secret1234",
  "newPassword": "newpassword5678"  // min 8 chars
}
```

Destroys the current session after a successful password change — user must log in again.

---

### Accounts

All routes require authentication. Routes with `/:id` additionally verify account ownership via `accountOwner` middleware (`403` if not owner). `GET /api/accounts` and `GET /api/accounts/:id/transactions` are cached; every write below invalidates the `accounts` cache namespace, and transaction writes also invalidate `transactions` (see [Caching Strategy](#caching-strategy)).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts` | List accounts (paginated, filterable) — cached |
| `GET` | `/api/accounts/:id` | Get account by ID — cached |
| `POST` | `/api/accounts` | Create an account — invalidates `accounts` cache |
| `PUT` | `/api/accounts/:id` | Update an account — invalidates `accounts` cache |
| `DELETE` | `/api/accounts/:id` | Delete an account (cascades transactions) — invalidates `accounts` and `transactions` cache |
| `POST` | `/api/accounts/:id/transactions` | Create a transaction on an account — invalidates `accounts` and `transactions` cache (balance changes) |
| `GET` | `/api/accounts/:id/transactions` | List transactions for an account (paginated, filterable) — cached |

#### `GET /api/accounts`

Query params:
- `page` — page number (default: `1`)
- `name` — partial name search (case-insensitive)
- `type` — filter by `bank` | `wallet` | `upi`

**Response `200`**
```json
{
  "message": "Account Retrieved.",
  "accounts": {
    "data": [{ "id": "uuid", "name": "...", "balance": "5000.00", "type": "bank", ... }],
    "nextPage": 2
  }
}
```

`nextPage` is `undefined` when there are no more pages. The exact `page`/`name`/`type` combination forms part of the cache key, so different filter combinations are cached independently and do not collide.

---

#### `POST /api/accounts`

```json
{
  "name": "Main Savings",  // 4–20 chars, lowercased, unique per user
  "balance": 5000.00,      // optional, default 0, min 0
  "type": "bank"           // required: bank | wallet | upi
}
```

**Response `201`**
```json
{
  "message": "Account created.",
  "account": { "id": "uuid", "name": "main savings", "balance": "5000.00", "type": "bank", ... }
}
```

---

#### `POST /api/accounts/:id/transactions`

Creates a transaction and atomically updates the account balance.

```json
{
  "amount": 1500.00,              // required, must be > 0
  "type": "expense",              // required: income | expense
  "description": "Monthly rent",  // optional
  "transactionDate": "2025-06-01T00:00:00.000Z",  // optional, defaults to now
  "tagIds": ["tag-uuid-1", "tag-uuid-2"]           // optional, default []
}
```

All `tagIds` must exist and belong to the authenticated user (verified by `tagsOwner` middleware before the DB transaction opens).

**Response `201`**
```json
{
  "message": "Transaction created.",
  "transaction": {
    "id": "uuid",
    "accountId": "uuid",
    "amount": "1500.00",
    "type": "expense",
    "description": "Monthly rent",
    "transactionDate": "2025-06-01T00:00:00.000Z",
    "deletedAt": null,
    "tags": [{ "id": "uuid", "name": "rent", "userId": "uuid", ... }],
    ...
  }
}
```

Tags are resolved and returned as full tag objects (not just IDs). Because this mutates the account's balance, both the `accounts` and `transactions` cache namespaces are invalidated for the user after the DB transaction commits successfully.

---

#### `GET /api/accounts/:id/transactions`

Query params:
- `page` — page number (default: `1`)
- `type` — `income` | `expense`
- `description` — partial match (case-insensitive)
- `afterDate` — only transactions on or after this date
- `befourDate` — only transactions on or before this date

Soft-deleted transactions (`deletedAt IS NOT NULL`) are excluded from results.

**Response `200`**
```json
{
  "message": "Transactions retieved.",
  "transactions": {
    "data": [...],
    "nextPage": 2
  }
}
```

---

### Transactions

Standalone transaction routes — operate on a transaction by its own ID. All routes require authentication and verify transaction ownership via `transactionOwner` middleware. Every write route below invalidates both the `accounts` cache namespace (balance changed) and the `transactions` cache namespace for the owning user.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transaction/:id` | Get a transaction by ID — cached |
| `PUT` | `/api/transaction/:id` | Update a transaction (balance auto-adjusts) — invalidates cache |
| `DELETE` | `/api/transaction/:id` | Soft-delete a transaction (balance reversed) — invalidates cache |
| `PATCH` | `/api/transaction/:id/recover` | Recover a soft-deleted transaction (balance reapplied) — invalidates cache |

#### `PUT /api/transaction/:id`

All fields optional. Only provided fields are updated. Balance only recalculates if `amount` or `type` changes.

```json
{
  "amount": 1200.00,             // optional
  "type": "expense",             // optional: income | expense
  "description": "Updated desc", // optional
  "transactionDate": "2025-06-15T00:00:00.000Z",  // optional
  "addTagIds": ["tag-uuid-3"],   // optional, tags to add
  "deleteTagIds": ["tag-uuid-1"] // optional, tags to remove
}
```

The balance diff is computed as `(new effect) - (old effect)` and applied atomically with a row lock on the account. Cache invalidation for `accounts` and `transactions` runs only after this transaction commits — never before, so a rolled-back update never bumps the version unnecessarily.

---

#### `DELETE /api/transaction/:id`

Soft-delete: sets `deletedAt` to current timestamp and reverses the transaction's effect on the account balance. Returns `400` if already deleted.

---

#### `PATCH /api/transaction/:id/recover`

Clears `deletedAt` and reapplies the transaction's effect on the account balance. Returns `400` if the transaction is not deleted.

---

### Tags

All routes require authentication. Routes with `/:id` verify tag ownership via `tagOwner` middleware. `GET` routes are cached under the `tags` namespace; every write below invalidates it.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tags` | List all tags for the current user — cached |
| `GET` | `/api/tags/:id` | Get a tag by ID — cached |
| `POST` | `/api/tags` | Create a tag — invalidates `tags` cache |
| `PUT` | `/api/tags/:id` | Update a tag — invalidates `tags` cache |
| `DELETE` | `/api/tags/:id` | Delete a tag — invalidates `tags` cache |

Tags are not paginated. The `GET /api/tags` endpoint accepts an optional `name` query param for partial name search; each distinct `name` filter is cached under its own key.

#### `POST /api/tags`

```json
{
  "name": "groceries"  // 3–15 chars, lowercased, unique per user
}
```

**Response `201`**
```json
{
  "message": "Tag created.",
  "tag": { "id": "uuid", "name": "groceries", "userId": "uuid", ... }
}
```

---

## Middleware & Authorization

| Middleware | Purpose |
|---|---|
| `authenticate` | Checks `req.session.userId`; returns `401` if missing |
| `accountOwner` | Fetches account by param `id`; returns `404` if not found, `403` if not owned by session user |
| `transactionOwner` | Fetches transaction with its account; returns `404` if not found, `403` if account not owned by session user |
| `tagOwner` | Fetches tag by param `id`; returns `404` if not found, `403` if not owned by session user |
| `tagsOwner` | Validates all `tagIds` in request body exist and belong to session user; used on transaction create |
| `newTagsOwner` | Same as `tagsOwner` but for `addTagIds`; used on transaction update |
| `validateBody` | Runs a Zod schema against `req.body`; returns `400` with field-level errors on failure |
| `validateParams` | Runs a Zod schema against `req.params` |
| `validateQuery` | Runs a Zod schema against `req.query` |
| `errorHandler` | Global error handler; maps PostgreSQL constraint violations (unique, check) to clean `400` responses |

---

## Data Integrity & Architecture Decisions

### Atomic Balance Updates

Every balance-affecting operation runs inside a `db.transaction()` block with `SELECT ... FOR UPDATE` row-level locking on the account. This means:

- Two concurrent `POST /transactions` requests on the same account cannot both read the same stale balance and overwrite each other (lost update prevention)
- If the transaction insert or balance update fails, both are rolled back together — the account balance is always consistent with its transaction history

**Create transaction flow:**
```
BEGIN
  SELECT ... FROM accounts WHERE id = ? FOR UPDATE   ← locks the row
  INSERT INTO account_transactions ...
  UPDATE accounts SET balance = balance ± amount
  INSERT INTO transaction_tags ... (if tags provided)
COMMIT
  → invalidate "accounts" and "transactions" cache namespaces for the user
```

**Update transaction flow (only if amount or type changed):**
```
BEGIN
  SELECT ... FROM accounts WHERE id = ? FOR UPDATE
  diff = (new_effect) - (old_effect)
  UPDATE accounts SET balance = balance + diff
  UPDATE account_transactions SET ...
  INSERT/DELETE transaction_tags as needed
COMMIT
  → invalidate "accounts" and "transactions" cache namespaces for the user
```

### Soft Delete & Recovery

Transactions are never hard-deleted. `DELETE /api/transaction/:id` sets `deletedAt = now()` and reverses the balance. `PATCH /api/transaction/:id/recover` clears `deletedAt` and reapplies the balance. Both operations use the same locking pattern, and both invalidate the same two cache namespaces on success. Soft-deleted transactions are excluded from all list queries via `isNull(accountTransactions.deletedAt)`.

### Constraint-Level Guards

Rather than relying purely on application logic, business rules are enforced at the PostgreSQL level:

- `CHECK (balance >= 0)` on `accounts` — the database itself rejects any balance update that would go negative
- `CHECK (amount > 0)` on `account_transactions` — zero or negative amounts are rejected at the DB level
- `UNIQUE (userId, name)` on `accounts` — no duplicate account names per user
- `UNIQUE (userId, name)` on `tags` — no duplicate tag names per user
- `UNIQUE (accountTransactionId, tagId)` on `transaction_tags` — no duplicate tags on a transaction

The `errorHandler` middleware catches these PostgreSQL error codes (`23505` for unique violations, `23514` for check violations) and maps them to readable API responses. A request that fails a constraint check never reaches the cache-invalidation step, since invalidation only runs after a successful commit.

### Environment Validation at Startup

`env.ts` parses all environment variables through a Zod schema before the app starts. Any missing or invalid variable causes an immediate exit with a descriptive log — no silent misconfigurations at runtime. This includes `REDIS_URI`

---

## Caching Strategy

LedgerFlow uses a **per-user, versioned Redis cache** in front of the `accounts`, `transactions`, and `tags` read routes. The goal is to avoid re-hitting PostgreSQL for repeated list/detail reads while guaranteeing that any write is reflected on the very next read — with no manual cache-key bookkeeping.

### Why versioned keys instead of direct deletion

A naive cache would `DEL` the specific keys affected by a write. That requires tracking every filter/pagination combination ever cached (`accounts:list:page1`, `accounts:list:page2:type=bank`, …) so they can all be found and deleted together — easy to get wrong and easy to leak stale keys. Instead, each user has a single **version counter** per namespace:

```
{namespace}:version:{userId}
```

Every cache key for that namespace embeds the current version:

```
{namespace}:v{version}:{userId}:{querySuffix}
```

Invalidating is a single atomic `INCR` on the version counter — it doesn't matter how many distinct keys exist under the old version, they all become unreachable at once and expire naturally via TTL.

### Namespaces in use

| Namespace | Covers | Invalidated by |
|---|---|---|
| `accounts` | `GET /api/accounts`, `GET /api/accounts/:id` | account create/update/delete; any transaction create/update/delete/recover (balance changes) |
| `transactions` | `GET /api/accounts/:id/transactions`, `GET /api/transaction/:id` | transaction create/update/delete/recover; account delete (cascades) |
| `tags` | `GET /api/tags`, `GET /api/tags/:id` | tag create/update/delete |

### Read path

```typescript
const cacheKey = await getCacheKey(namespace, userId, querySuffix);
const cached = await getCached(cacheKey);
if (cached) return res.status(200).json({ message: "...", data: cached });

const data = await db.query...;          // fetch from PostgreSQL
await setCached(cacheKey, data);          // populate cache with TTL
return res.status(200).json({ message: "...", data });
```

### Write path

```typescript
const result = await db.transaction(async (tx) => {
  // ...balance-safe mutation logic with row locking...
});

// Only after the DB transaction commits successfully:
await invalidateCache("accounts", userId);
await invalidateCache("transactions", userId);
```

Invalidation is deliberately placed **after** the database transaction resolves, never inside it. If it ran before commit and the transaction later rolled back (e.g. a `CHECK` constraint failure), the cache would have been invalidated for a change that never actually happened — wasted work, though not a correctness bug, since the next read would just rebuild an identical cache entry from the still-accurate database state.

### TTL and memory hygiene

All cached entries carry a TTL (`CACHE_TTL_SECONDS`, default 3600s). Orphaned keys from a superseded version are never explicitly deleted — they're simply unreachable once the version bumps — and expire on their own via TTL rather than accumulating indefinitely in Redis.

### Scope of invalidation

Invalidation is intentionally **namespace-wide per user**, not per individual resource (e.g. updating one tag invalidates all cached tag reads for that user, not just the one tag). Given the size of a typical user's tag/account list, this trade-off favors simplicity and correctness over shaving cache hits on a rarely-changing dataset.

### Redis as a non-authoritative layer

Redis holds no data that doesn't also exist in PostgreSQL. If Redis is flushed, restarted, or a key is evicted early, the next request simply falls through to the database and repopulates the cache — no data loss, no inconsistency, only a temporary increase in DB load.

---

## Validation

All inputs are validated with **Zod** at three levels:

| Level | Example |
|---|---|
| Route params | `id` must be a valid UUID (checked with `uuid.validate()`) |
| Request body | `amount > 0`, `type` must be `income` or `expense`, `name` 4–20 chars |
| Query strings | `page` coerced to number, `type` must match enum values |

Validation failures return `400` with field-level details:

```json
{
  "error": "Validation Error.",
  "details": [
    { "name": "amount", "message": "Amount must be above 0." }
  ]
}
```

---

## Error Handling

The global `errorHandler` middleware handles all thrown errors and maps them consistently:

| PostgreSQL code | Constraint | Response |
|---|---|---|
| `23505` | `unique_transaction_tag_id_and_account_transaction_id` | `400` — Cannot add same tag twice |
| `23505` | `unique_tag_name_and_user_id` | `400` — Tag with the name already exists |
| `23505` | `unique_user_account_name` | `400` — Account with same name already exists |
| `23505` | `users_email_unique` | `400` — User with the email already exists |
| `23505` | `users_username_unique` | `400` — Username is taken |
| `23514` | `check_account_balance_non_negative` | `400` — Insufficient balance |
| `23514` | `check_transaction_amount_non_negative` | `400` — Amount must be above 0 |
| Any other | — | `500` — Internal Server Error (stack trace included in `development` mode) |

---

## Testing

LedgerFlow uses **Vitest** with **Supertest** for integration testing. Every route is covered, including cache-hit and cache-invalidation behavior for accounts, transactions, and tags.

```bash
npm run test
```

Tests run with `APP_STAGE=testing` (loads `.env.test`). Vitest is configured with `maxWorkers: 1` and `isolate: false` — all tests run sequentially in a single worker to prevent concurrent writes to the test database from interfering with each other. `.env.test` points `REDIS_URI` at a dedicated database index, and the global setup flushes it before the run so cache state never leaks between test runs.

```ts
// vitest.config.ts
{
  globalSetup: "./tests/setup/globalSetup.ts",
  pool: "threads",
  maxWorkers: 1,
  isolate: false,
}
```

---

## Project Structure

```
ledgerflow-api/
├── src/
│   ├── db/
│   │   ├── connection.ts           # Drizzle + pg pool setup
│   │   ├── redis.ts                # Redis client + initializeRedisClient()
│   │   └── schema.ts               # All table definitions, enums, relations, inferred types
│   ├── middlewares/
│   │   ├── authenticate.ts         # Session auth check
│   │   ├── accountOwner.ts         # Account ownership check
│   │   ├── transactionOwner.ts     # Transaction ownership check (via account join)
│   │   ├── tagOwner.ts             # Single tag ownership check
│   │   ├── tagsOwner.ts            # Bulk tag ownership check (create transaction)
│   │   ├── newTagsOwner.ts         # Bulk tag ownership check (update transaction)
│   │   ├── validation.ts           # Zod validation middleware factory
│   │   └── errorHandler.ts         # Global error handler + PG constraint mapper
│   ├── modules/
│   │   ├── auth/                   # register, login, logout
│   │   ├── users/                  # getUser, updateUser, changePassword
│   │   ├── accounts/               # CRUD + createTransaction + listTransactions (cached)
│   │   ├── transactions/           # getTransaction, updateTransaction, softDelete, recover (cached)
│   │   └── tags/                   # CRUD for user-owned tags (cached)
│   ├── types/
│   │   ├── express-session.d.ts    # Adds userId to SessionData
│   │   └── custom-env.d.ts
│   ├── utils/
│   │   ├── password.ts             # bcrypt hashPassword / comparePassword
│   │   └── cache.ts                # getCacheKey / getCached / setCached / invalidateCache
│   ├── server.ts                   # Express app, session, CORS, route mounting
│   └── index.ts                    # Server listen (connects Redis + Postgres before accepting requests)
├── tests/
│   ├── setup/
│   │   └── globalSetup.ts          # DB + Redis setup/teardown for test runs
|   │   └── dbHelpers.ts
|   │   └── setup.test.tss
│   ├── accounts.test.ts
│   ├── auth.test.ts
│   ├── tags.test.ts
│   ├── transactions.test.ts
│   └── users.test.ts
├── drizzle/                        # Auto-generated migration files
├── drizzle.config.ts
├── env.ts                          # Zod-validated env loader
├── vitest.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── .env.example
└── package.json
```

---

## License

ISC