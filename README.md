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
- [Validation](#validation)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Project Structure](#project-structure)

---

## Overview

LedgerFlow is a multi-user financial tracking API where each user can manage multiple accounts (bank, wallet, or UPI) and record income or expense transactions against them. Accounts have a running balance that automatically updates whenever a transaction is created, updated, soft-deleted, or recovered. All balance mutations run inside PostgreSQL database transactions with row-level locking to prevent race conditions. The API is fully session-authenticated — every protected route requires a valid session cookie.

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
COOKIE_SECRET_KEY=your_secret_key_must_be_at_least_32_chars
PASSWORD_SALT_ROUNDS=12              # min: 10, max: 20
ACCOUNTS_PAGE_LIMIT=8
TRANSACTION_PAGE_LIMIT=8
CORS_ORIGINS=http://localhost:5173   # space-separated for multiple origins
```

All variables are validated at startup via Zod. The server exits immediately with a descriptive error if any variable is missing or invalid. For testing, create `.env.test` — it is loaded automatically when `APP_STAGE=testing`.

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

---

## API Reference

All protected routes require an active session cookie (`connect.sid`). Unauthenticated requests return `401`.

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

All routes require authentication. Routes with `/:id` additionally verify account ownership via `accountOwner` middleware (`403` if not owner).

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/accounts` | List accounts (paginated, filterable) |
| `GET` | `/api/accounts/:id` | Get account by ID |
| `POST` | `/api/accounts` | Create an account |
| `PUT` | `/api/accounts/:id` | Update an account |
| `DELETE` | `/api/accounts/:id` | Delete an account (cascades transactions) |
| `POST` | `/api/accounts/:id/transactions` | Create a transaction on an account |
| `GET` | `/api/accounts/:id/transactions` | List transactions for an account (paginated, filterable) |

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

`nextPage` is `undefined` when there are no more pages.

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

Tags are resolved and returned as full tag objects (not just IDs).

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

Standalone transaction routes — operate on a transaction by its own ID. All routes require authentication and verify transaction ownership via `transactionOwner` middleware.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/transaction/:id` | Get a transaction by ID |
| `PUT` | `/api/transaction/:id` | Update a transaction (balance auto-adjusts) |
| `DELETE` | `/api/transaction/:id` | Soft-delete a transaction (balance reversed) |
| `PATCH` | `/api/transaction/:id/recover` | Recover a soft-deleted transaction (balance reapplied) |

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

The balance diff is computed as `(new effect) - (old effect)` and applied atomically with a row lock on the account.

---

#### `DELETE /api/transaction/:id`

Soft-delete: sets `deletedAt` to current timestamp and reverses the transaction's effect on the account balance. Returns `400` if already deleted.

---

#### `PATCH /api/transaction/:id/recover`

Clears `deletedAt` and reapplies the transaction's effect on the account balance. Returns `400` if the transaction is not deleted.

---

### Tags

All routes require authentication. Routes with `/:id` verify tag ownership via `tagOwner` middleware.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/tags` | List all tags for the current user |
| `GET` | `/api/tags/:id` | Get a tag by ID |
| `POST` | `/api/tags` | Create a tag |
| `PUT` | `/api/tags/:id` | Update a tag |
| `DELETE` | `/api/tags/:id` | Delete a tag |

Tags are not paginated. The `GET /api/tags` endpoint accepts an optional `name` query param for partial name search.

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
```

### Soft Delete & Recovery

Transactions are never hard-deleted. `DELETE /api/transaction/:id` sets `deletedAt = now()` and reverses the balance. `PATCH /api/transaction/:id/recover` clears `deletedAt` and reapplies the balance. Both operations use the same locking pattern. Soft-deleted transactions are excluded from all list queries via `isNull(accountTransactions.deletedAt)`.

### Constraint-Level Guards

Rather than relying purely on application logic, business rules are enforced at the PostgreSQL level:

- `CHECK (balance >= 0)` on `accounts` — the database itself rejects any balance update that would go negative
- `CHECK (amount > 0)` on `account_transactions` — zero or negative amounts are rejected at the DB level
- `UNIQUE (userId, name)` on `accounts` — no duplicate account names per user
- `UNIQUE (userId, name)` on `tags` — no duplicate tag names per user
- `UNIQUE (accountTransactionId, tagId)` on `transaction_tags` — no duplicate tags on a transaction

The `errorHandler` middleware catches these PostgreSQL error codes (`23505` for unique violations, `23514` for check violations) and maps them to readable API responses.

### Environment Validation at Startup

`env.ts` parses all environment variables through a Zod schema before the app starts. Any missing or invalid variable causes an immediate exit with a descriptive log — no silent misconfigurations at runtime.

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

LedgerFlow uses **Vitest** with **Supertest** for integration testing. Every route is covered.

```bash
npm run test
```

Tests run with `APP_STAGE=testing` (loads `.env.test`). Vitest is configured with `maxWorkers: 1` and `isolate: false` — all tests run sequentially in a single worker to prevent concurrent writes to the test database from interfering with each other.

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
│   │   ├── accounts/               # CRUD + createTransaction + listTransactions
│   │   ├── transactions/           # getTransaction, updateTransaction, softDelete, recover
│   │   └── tags/                   # CRUD for user-owned tags
│   ├── types/
│   │   ├── express-session.d.ts    # Adds userId to SessionData
│   │   └── custom-env.d.ts
│   ├── utils/
│   │   └── password.ts             # bcrypt hashPassword / comparePassword
│   ├── server.ts                   # Express app, session, CORS, route mounting
│   └── index.ts                    # Server listen
├── tests/
│   └── setup/
│       └── globalSetup.ts          # DB setup/teardown for test runs
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