# HEROES Alumni Portal

AI-led mentor portal for HEROES Academy alumni (matriculated, 18-25). One cohesive product:
an AI mentor ("Bra Hero") drives daily check-ins, goals, money check-ins, workouts and coach
escalations through conversation. Structured views are projections of chat-driven data.

## Stack

- **Server**: Node 20, Express, `pg`, express-session (Postgres-backed), bcryptjs
- **Web**: React 19 + Vite + Tailwind 4 + motion + lucide-react
- **AI**: OpenAI-compatible proxy (`AI_PROXY_BASE_URL`), model `xgmi/Jupiter-320B-1000K`
- **DB**: Postgres; schema bootstrapped from `db/schema.sql` at server boot (additive, idempotent)

## Layout

```
server/src/   Express app: auth, chat (AI action protocol), path, circle, money, move, work, coach
web/          React SPA served statically by Express in production
shared/       TypeScript types shared by server + web
db/schema.sql Source of truth for the schema (CREATE TABLE IF NOT EXISTS only)
seed/seed.ts  Idempotent demo seed (alumni, workouts, opportunities, circle posts)
```

## Chat action protocol

`POST /api/chat {message}` returns `{reply, actions[]}`. The model replies with JSON; the server
applies each action to Postgres (`log_checkin`, `create_goal`, `complete_step`, `add_step`,
`add_commitment`, `money_checkin`, `log_workout`, `escalate_coach`) and persists both turns.
Parse failure degrades to plain chat - never a 500.

## Env

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection (or RunOS `POSTGRES_*` vars) |
| `SESSION_SECRET` | Session signing |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Bootstrap admin (created on first boot if users table empty) |
| `AI_PROXY_BASE_URL` | OpenAI-compatible base (default staging proxy) |
| `AI_PROXY_KEY` | Proxy bearer key (secret) |
| `AI_MODEL` | Model slug (default `xgmi/Jupiter-320B-1000K`) |

## Run locally

```bash
docker run -d --name heroes-db -e POSTGRES_USER=heroes -e POSTGRES_PASSWORD=heroes \
  -e POSTGRES_DB=heroes -p 5432:5432 postgres:16
cp .env.example .env  # edit AI_PROXY_KEY
npm install --prefix server && npm install --prefix web
npm run dev:server   # API on :8080
npm run dev:web      # Vite dev server proxying /api
```

## Deploy (RunOS)

`runos.yaml` in the repo root carries the app spec (`cid: scd`, port 8080, standardHttps).
First-time app creation uses `runos apps add` with `--requires` to provision managed postgres;
subsequent deploys are `runos deploy --cid scd`. The server runs schema bootstrap + admin
bootstrap at boot, so deploys are stateless.
