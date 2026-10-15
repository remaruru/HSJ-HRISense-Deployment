# HRISense — Development Setup and Deployment

**System:** *HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision*
**Repository:** `https://github.com/remaruru/HSJ-HRISense-Deployment`
**Last checked against the code:** 15 October 2026

How to run HRISense on a new machine, and how the hosted site is set up. The
full description of the system is [`HRISENSE_SYSTEM_REFERENCE.md`](HRISENSE_SYSTEM_REFERENCE.md);
the AI assistant's design is [`HRISENSE_AI_ARCHITECTURE.md`](HRISENSE_AI_ARCHITECTURE.md).

---

## 1. Requirements

| Tool | Version |
|---|---|
| Node.js | 22 LTS (20.19 or newer works; the web build needs it) |
| npm | 10 or newer |
| Database | MySQL 8 or MariaDB 10.4+ (for example XAMPP on port `3306`) |
| Git | with **Git LFS** installed, for the screenshots and slides in `docs/` |

The repository is an npm workspace: `apps/web` (React + Vite), `apps/api`
(Express + Prisma) and `packages/shared`.

---

## 2. Install

```bash
git clone https://github.com/remaruru/HSJ-HRISense-Deployment.git
cd HSJ-HRISense-Deployment
npm install
```

`npm install` at the root installs every workspace.

---

## 3. Configure

### API — `apps/api/.env`

```bash
cp apps/api/.env.example apps/api/.env
```

Set at least:

| Variable | Value |
|---|---|
| `DATABASE_URL` | e.g. `mysql://root:@localhost:3306/hrisense_db` (XAMPP's default user `root`, no password) |
| `JWT_SECRET`, `REFRESH_TOKEN_SECRET` | two different long random strings (command below) |
| `DEMO_ACCOUNT_PASSWORD` | the password every demo account will use — 8+ characters with an uppercase letter, a lowercase letter, a number and a symbol |

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Keys for the optional services (Google sign-in, reCAPTCHA, the AI provider,
Brevo email) go in **`apps/api/.env.local`**, which overrides `.env`. Every
`.env` file is git-ignored; only the `*.env.example` templates are committed.
Each variable is explained in `apps/api/.env.example`; without them HRISense
still runs, with that feature switched off.

### Web — `apps/web/.env` (optional)

Only needed if the API is not on `http://localhost:5000`:

```env
VITE_API_URL=http://localhost:5000/api/v1
```

---

## 4. Database

1. Start MySQL (XAMPP does not start it on its own).
2. Create the database:
   ```sql
   CREATE DATABASE IF NOT EXISTS hrisense_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Apply the migrations and generate the Prisma client:
   ```bash
   npm run db:migrate:deploy --workspace=apps/api
   npm run db:generate --workspace=apps/api
   ```
   Never use `prisma db push` or `prisma migrate reset` on a database you want to keep.
4. Load the demo data — the same dataset as the hosted site (47 demo accounts
   and their example records):
   ```bash
   npm run db:seed:demo --workspace=apps/api
   ```
   `npm run db:seed:demo:dry-run --workspace=apps/api` shows what it would
   create without writing. The seed never deletes or overwrites anything, so it
   is safe to run again. Demo logins are listed in
   [`apps/api/prisma/demo/README.md`](../apps/api/prisma/demo/README.md); they all
   use `DEMO_ACCOUNT_PASSWORD`.

---

## 5. Run

```bash
npm run dev
```

| Part | Address |
|---|---|
| Website | `http://localhost:3000` |
| API | `http://localhost:5000/api/v1` |
| API health check | `http://localhost:5000/health` |

Or one at a time: `npm run dev --workspace=apps/api` and
`npm run dev --workspace=apps/web`.

**Checks:**

```bash
npm run typecheck
npm test --workspace=apps/api
```

Some API integration tests need a scratch database, `hrisense_migration_dev_db`.

---

## 6. The hosted site

`main` deploys automatically to both services below. Secrets live only in each
service's environment settings — never in the repository.

### Website — Vercel (`https://www.hrisense.xyz`)

| Setting | Value |
|---|---|
| Root directory | `apps/web` |
| Framework | Vite (build `npm run build`, output `dist`) |
| `VITE_API_URL` | `https://api.hrisense.xyz/api/v1` — read at **build** time, so redeploy after changing it |

`apps/web/vercel.json` sends every path to `index.html` so refreshing a page
works. Vercel does not download Git LFS files, so `.gitattributes` keeps the
migrations and the website's images out of LFS.

### API and database — Railway (`https://api.hrisense.xyz`)

| Setting | Value |
|---|---|
| Root directory | repository root |
| Build | `npm run db:generate --workspace=apps/api && npm run build --workspace=apps/api` |
| Pre-deploy | `sh -c "npm run db:migrate:deploy --workspace=apps/api && npm run db:seed:demo --workspace=apps/api"` |
| Start | `npm start --workspace=apps/api` |
| Health check | `/health` |
| Volume | mounted at `/app/apps/api/uploads` (uploaded files survive redeploys) |
| Database | Railway MySQL, `DATABASE_URL=${{MySQL.MYSQL_URL}}` |

Variables: `NODE_ENV=production`, `PORT` (the custom domain's port),
`CLIENT_URL=https://www.hrisense.xyz`, `TRUST_PROXY=1`, `JWT_SECRET`,
`REFRESH_TOKEN_SECRET`, `DEMO_ACCOUNT_PASSWORD`, and optionally
`TEAM_ACCOUNT_PASSWORDS` (the team's HR accounts, see the demo README),
`GOOGLE_CLIENT_ID`, `RECAPTCHA_SITE_KEY` / `RECAPTCHA_SECRET_KEY`,
`OPENAI_API_KEY` (or `AI_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`) and the
Brevo email settings from `apps/api/.env.example`.

### Domain and email

`hrisense.xyz` is registered and served by Vercel DNS: the apex redirects to
`www`, `api` is a CNAME to Railway (with Railway's verification TXT record), and
Brevo's records (`brevo-code` TXT, two DKIM CNAMEs, DMARC) authenticate the
senders `no-reply@hrisense.xyz` and `careers@hrisense.xyz`.

---

## 7. Troubleshooting

| Problem | Fix |
|---|---|
| "Database connection failed" | MySQL is not running, or `DATABASE_URL` has the wrong user, password, port or database name. |
| Port 5000 or 3000 in use | `npm run dev` checks first and explains how to stop the old process. |
| `prisma generate` fails with EPERM on Windows | Stop the running dev servers, generate, then start them again. |
| Prisma client out of date after pulling | `npm run db:generate --workspace=apps/api`. |
| The AI assistant says it is not configured | No provider key is set — see `apps/api/.env.example` and [`HRISENSE_AI_ARCHITECTURE.md`](HRISENSE_AI_ARCHITECTURE.md) §13. |
| Images or slides in `docs/` are tiny text files | Git LFS is not installed: install it, then `git lfs pull`. |
