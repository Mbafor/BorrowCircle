# BorrowCircle

BorrowCircle is a campus marketplace web app for KNUST students to borrow and rent items
from each other — calculators, textbooks, lab coats, cameras, and more. Students list items
they own, browse what's available nearby, and request to borrow or rent them for a short
period.

This repository currently contains the **Sprint 1 foundation**: project skeleton, tooling,
and database setup only. Authentication, listing endpoints, and other business logic are
built in later sprints.

## Tech stack

- **Backend:** Node.js + Express + TypeScript
- **Frontend:** React + TypeScript + Vite + Tailwind CSS
- **Database:** PostgreSQL (run locally via Docker Compose)
- **ORM:** Drizzle ORM + drizzle-kit for migrations
- **Package manager:** npm, using npm workspaces (`Frontend`, `Backend`)
- **Linting/formatting:** ESLint + Prettier

## Repository structure

```
borrowcircle/
  Frontend/     React + Vite frontend
  Backend/      Express + TypeScript backend
  docker-compose.yml
  .gitignore
  README.md
  package.json  root, defines npm workspaces
```

## Prerequisites

- Node.js 20+ and npm 10+
- Docker Desktop (or another Docker Compose-compatible runtime)

## Local setup

### 1. Clone and install

```bash
git clone <repo-url> borrowcircle
cd borrowcircle
npm install
```

This installs dependencies for the root, `Frontend`, and `Backend` workspaces in one step,
and sets up the Git hooks (via Husky) automatically.

### 2. Configure environment variables

Copy the example env files and adjust if needed:

```bash
cp Backend/.env.example Backend/.env
cp Frontend/.env.example Frontend/.env
```

`Backend/.env`:

| Variable       | Description                                    | Default (example)                                                    |
| -------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| `PORT`         | Port the API listens on                        | `4000`                                                                  |
| `NODE_ENV`     | `development` \| `production`                  | `development`                                                          |
| `DATABASE_URL` | Postgres connection string                     | `postgresql://borrowcircle:borrowcircle@localhost:5432/borrowcircle`   |

`Frontend/.env`:

| Variable              | Description                     | Default (example)      |
| --------------------- | -------------------------------- | ----------------------- |
| `VITE_API_BASE_URL`   | Base URL of the backend API      | `http://localhost:4000` |

### 3. Start the database

```bash
docker compose up -d
```

This starts a PostgreSQL 16 container on port `5432`, with data persisted in a named
Docker volume across restarts. The default user/password/database are `borrowcircle` /
`borrowcircle` / `borrowcircle` (override via `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB` env vars if desired — they must match `DATABASE_URL` in `Backend/.env`).

### 4. Run database migrations

```bash
npm run db:migrate
```

This applies the Drizzle migrations in `Backend/src/db/migrations` to your local database.

### 5. Start the dev servers

In two terminals:

```bash
npm run dev:server   # starts the Express API on http://localhost:4000
npm run dev:client   # starts the Vite dev server on http://localhost:5173
```

Visit `http://localhost:5173` — the Home page calls the backend's `/health` endpoint and
shows whether the API and database are reachable.

### Other useful commands

```bash
npm run lint            # lint every workspace
npm run build           # type-check and build every workspace
npm run build:server    # compile the backend to Backend/dist
npm run build:client    # build the frontend to Frontend/dist
npm run lint:server     # lint the backend
npm run lint:client     # lint the frontend
npm run db:generate     # generate a new migration from schema changes
npm run db:studio       # open Drizzle Studio to browse the database
```

## Health check

`GET /health` on the backend returns:

```json
{ "status": "ok", "db": true }
```

`db` is `true` only when the API can successfully query the Postgres database.

## Git workflow

- `main` — production-ready code only
- `develop` — integration/staging branch
- `feature/*` — short-lived branches created from `develop`

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature-name

# ...make changes...

git push -u origin feature/your-feature-name
# open a PR: feature/your-feature-name -> develop
```

Every push runs a local pre-push hook (`npm run lint && npm run build`) and the same
checks run in CI on every push and pull request. Direct pushes to `develop` and `main`
are blocked — all changes land via reviewed Pull Requests.
