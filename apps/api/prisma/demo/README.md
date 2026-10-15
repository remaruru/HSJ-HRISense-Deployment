# HRISense demo data

Everything needed to give a freshly deployed HRISense database the demo accounts
and example records used to demonstrate the system.

| File | What it is |
|---|---|
| `demo-data.json` | The demo dataset (synthetic). Generated — do not edit by hand. |
| `seed-demo.js` | Loads `demo-data.json` into the database in `DATABASE_URL`. |
| `demo-accounts.js` | Shared rules: demo login domain, password policy, bcrypt hashing. |
| `export-demo-data.js` | Rebuilds `demo-data.json` from a **local** development database. |
| `../../src/scripts/seed_dev_accounts.js` | Gives any active job role without one a demo account. `seed-demo.js` runs it at the end. |
| `team-accounts.js` | The team's own HR accounts (see below). `seed-demo.js` runs it last; it does nothing unless `TEAM_ACCOUNT_PASSWORDS` is set. |

## Deploying

```bash
# 1. once per hosted database (and after every new migration)
npx prisma migrate deploy

# 2. demo data — needs DEMO_ACCOUNT_PASSWORD in the environment
npm run db:seed:demo

# 3. start the API
npm start
```

Run these in `apps/api` (from the repository root, add `--workspace=apps/api`
to the npm commands). On the hosted site, Railway's pre-deploy step runs 1 and 2
on every deploy, which is safe because the seed never changes existing rows
(see [`docs/DEVELOPMENT_SETUP.md`](../../../../docs/DEVELOPMENT_SETUP.md) §6).
`DEMO_ACCOUNT_PASSWORD` is the password every demo account gets. Set it in the hosting service's environment settings, never in a committed
file. It must have at least 8 characters, with an uppercase letter, a lowercase
letter, a number and a special character (the same rule as the login).

Options:

| Command | Effect |
|---|---|
| `npm run db:seed:demo:dry-run` | Shows what would be created; writes nothing. |
| `node prisma/demo/seed-demo.js --reset-passwords` | Also sets every existing demo account back to `DEMO_ACCOUNT_PASSWORD` and unlocks it. |
| `npm run db:seed:demo:accounts` | Only the demo-account step: one account for each active job role that has none. |

## What the seed will and will not do

- **Never deletes or resets** anything, and **never changes a row that already
  exists**. Rows are recognised by id or by their natural key (job role code,
  login email, leave balance's employee + year + type, …). Running it again
  creates nothing new, and rows a migration already made (the Sister job role,
  the standard schedule templates) are reused rather than duplicated.
- **Checks first, then writes.** If a demo row would clash with a different
  existing row on a unique value, it stops before writing anything.
- **Passwords.** No password exists in this repository. New demo accounts get a
  bcrypt hash (12 rounds, exactly like `src/lib/password.ts`) of
  `DEMO_ACCOUNT_PASSWORD`; existing accounts keep theirs unless
  `--reset-passwords` is given. The password is never printed. Demo accounts do
  not have to change their password at first sign-in.

## The demo accounts

One per job role: 3 full access (HR), 13 supervisors, 31 employees. Their names
are their job role ("Kitchen Staff"), and their personal details are placeholders.

Logins use the reserved **example.com** domain. Nobody can own a mailbox or a
Google account there, so no outsider can take a demo account over through
*Forgot password* or *Continue with Google*. (The local development logins used
`gmail.com` addresses, which belong to real people.)

| Access | Login | Job role |
|---|---|---|
| Full (HR) | hr@example.com | Human Resource Officer |
| Full (HR) | hrassistant@example.com | Human Resource Assistant/Staff |
| Full (HR) | sister@example.com | Sister |
| Supervisor | assistantadmin@example.com | Assistant Administrator |
| Supervisor | igp@example.com | IGP Coordinator |
| Supervisor | janitorialsupervisor@example.com | Janitorial Supervisor |
| Supervisor | kitchensupervisor@example.com | Kitchen Supervisor |
| Supervisor | maintenancesupervisor@example.com | Maintenance Supervisor |
| Supervisor | clinic@example.com | Clinic Staff |
| Supervisor | ptcoordinator@example.com | PT Coordinator |
| Supervisor | headpch@example.com | Head Pastoral Care/Homelife Services |
| Supervisor | op@example.com | OP Coordinator |
| Supervisor | preschool@example.com | CIP Coordinator |
| Supervisor | psn@example.com | PSN Coordinator |
| Supervisor | stvincent@example.com | CY Coordinator |
| Supervisor | headssd@example.com | Head SSD |
| Employee | adminsecretary@example.com | Administrative Secretaries |
| Employee | receptionist@example.com | Receptionists |
| Employee | canteen@example.com | Canteen Staff |
| Employee | dormitory-staff@example.com | Dormitory Staff |
| Employee | dormitory@example.com | Bakery Staff |
| Employee | accounting@example.com | Accounting Staff |
| Employee | liaison@example.com | Liaison Officer |
| Employee | pmo@example.com | PMO Staff |
| Employee | stockroom@example.com | Stockroom Staff |
| Employee | driver@example.com | Drivers |
| Employee | janitorialstaff@example.com | Janitorial Staff |
| Employee | kitchenstaff@example.com | Kitchen Staff |
| Employee | laundry@example.com | Laundry Staff |
| Employee | maintenancestaff@example.com | Maintenance Staff |
| Employee | ptstaff@example.com | PT Staff |
| Employee | chapel@example.com | Chapel Staff |
| Employee | pre-school-staff@example.com | Pre-School Staff |
| Employee | rendua@example.com | Rendu A Staff |
| Employee | rendub@example.com | Rendu B Staff |
| Employee | renduc@example.com | Rendu C Staff |
| Employee | sanctuary@example.com | Sanctuary Center Staff |
| Employee | siglivboys@example.com | Sigliv Boys Staff |
| Employee | st-vincent-staff@example.com | St. Vincent Staff |
| Employee | staluisa@example.com | Sta. Luisa Staff |
| Employee | stjoseph@example.com | St. Joseph Staff |
| Employee | stmary@example.com | St. Mary Staff |
| Employee | tahan@example.com | Tahan Center Staff |
| Employee | eccd@example.com | ECCD Teacher |
| Employee | psychologist@example.com | Psychologist |
| Employee | ptpsychologist@example.com | Part-Time Psychologist |
| Employee | socialworker@example.com | Social Workers |

A few logins do not match their role's name (for example `preschool@` is the CIP
Coordinator). They are kept exactly as they were in the local demo database.

## The team's HR accounts

`team-accounts.js` adds three **Human Resource Officer** accounts for the
HRISense team — the names and `@tip.edu.ph` emails already listed on the public
landing page:

| Employee no. | Name | Login |
|---|---|---|
| TEAM-HRD-001 | Earl Angelo Roldan | mearoldan@tip.edu.ph |
| TEAM-HRD-002 | Enzo Benedict Rosales | mebrosales@tip.edu.ph |
| TEAM-HRD-003 | Maria Cielo Salazar | mmcsalazar02@tip.edu.ph |

- **Passwords are not in this repository.** Set `TEAM_ACCOUNT_PASSWORDS` in the
  hosting service's environment settings, as JSON mapping each email to its
  password: `{"mearoldan@tip.edu.ph": "…", …}`. Each password must meet the
  same rule as `DEMO_ACCOUNT_PASSWORD` and is stored only as a bcrypt hash.
  Without the variable, this step is skipped.
- **Created once.** An email that already has an account is left exactly as it
  is — a redeploy never resets a password someone changed.
- Gender, date of birth, address and contacts are **placeholders** (gender is
  "Prefer not to say"); each person corrects their own record in Employee
  Management.
- These accounts are real people's, so the demo export never includes them
  (its privacy check rejects `tip.edu.ph` addresses).

## What the dataset contains

- **Reference data:** units, job roles and the reporting hierarchy, permissions,
  shifts and schedule templates, the holiday calendar, the evaluation templates
  (including Hospicio's official forms), the compliance requirement, award voting
  groups, system settings, and the five sample Yearly Achievements pages.
- **The 47 demo accounts and their example records:** emergency contacts,
  schedules, leave balances and requests, evaluation cycles with their ratings,
  Additional Oversight, calendar notes, announcements and who received them,
  notifications, one psychological record, one training activity and one (closed)
  job opening.

**Left out on purpose:** every non-demo employee, all applicants and
applications, the biometric attendance import, uploaded files (documents,
photos, attachments — the files are not in the repository), sign-in sessions and
password-reset tokens, the audit log, AI chat history and logs, and legacy tables
nothing uses. A fresh deployment therefore starts with an empty audit log and no
attendance records.

## Refreshing the dataset

When the local demo data changes, rebuild the file from the local database and
review the diff before committing:

```bash
DATABASE_URL="mysql://root@localhost:3306/hrisense_db" npm run db:seed:demo:export
```

The exporter only reads. It takes the `DEV-` demo accounts and the records tied
to them, moves logins to example.com, drops password hashes and sign-in history,
clears file references, and then runs a privacy check. If any name, email or id
of a person it left out, or any gmail/yahoo/outlook/hotmail, `tip.edu.ph` or
`hsj.org.ph` address, appears in the output, it stops without writing. A new
table in the schema must be classified in `export-demo-data.js` before the export
runs again.
