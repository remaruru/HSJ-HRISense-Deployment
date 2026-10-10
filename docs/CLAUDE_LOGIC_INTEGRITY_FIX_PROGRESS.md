# Logic & Data-Integrity Repair + Attendance Import Foundation — Progress Tracker

**Started**: 2026-09-07
**Repository**: `C:\xampp\htdocs\HRISense`
**Branch**: `main` · **HEAD at start**: `7648345b4c08ec74387ee2b8f67136395c5549b8`
**Git write operations**: NONE (frozen)

---

## Phase board

| Phase | Item | Status |
|---|---|---|
| 0 | Progress tracker created | DONE |
| 1 | Database / data preflight (read-only) | DONE |
| 2 | SW-01 weekly schedule `effectiveTo` bug | DONE (code + 2 rows repaired) |
| 3 | SW-06 weekly schedule DB protection | DONE (unique + index) |
| 4 | SW-07 canonical scheduling + resolver | DONE (ScheduleResolverService) |
| 5 | SW-02 leave atomic state transitions | DONE (all 4) |
| 6 | SW-03 leave pending balance atomicity | DONE (guarded decrement + anomaly audit) |
| 7 | SW-04 training → compliance atomicity + idempotency | DONE (tx + source-event key) |
| 8 | SW-05 AI attendance scoping + shared filter | DONE (workforceScope.ts) |
| 9 | SW-12 no-imported-record definition (document only) | DONE (unchanged, documented) |
| 10 | SW-09 attendance oldValue audit | DONE |
| 11 | SW-10 attendance update validation | DONE (zod) |
| 12 | SW-11 date-only verification + helper | DONE (businessDate.ts, 13/13 checks pass) |
| 13 | SW-14 evaluation double-submit | DONE (submit + finalize) |
| 14 | SW-15 notification idempotency | DONE (eventId unique) |
| 15 | SW-16 document orphan cleanup | DONE |
| 16 | SW-08 / SW-13 / SW-17 / SW-18 — no change, documented | DONE |
| 17 | Attendance import schema foundation (3 models + enums) | DONE |
| 18 | AttendanceRecord provenance | DONE (all rows LEGACY) |
| 19 | Normalizer interface only (no parser) | DONE (fails closed) |
| 20 | Classification engine | DONE (8 classes) |
| 21 | Conflict / decision storage | DONE (schema + defaults) |
| 22 | Apply safety engine | DEFERRED — unreachable without a normalizer |
| 23 | File storage (policy documented, not decided) | DONE (documented, not decided) |
| 24 | Import UI stays honest / disabled | DONE (untouched, still disabled) |
| 25 | Migration authoring + deploy | DONE (deployed, status clean) |
| 26 | Config cleanup (zod env) | DONE (conditional validation) |
| 27 | No legacy table drops | N/A (nothing to do) |
| 28 | Static logic re-audit | DONE |

---

## Preflight results — 2026-09-07 (read-only, no writes)

Script: `apps/api/scripts/preflight-integrity-check.ts`

| # | Check | Result |
|---|---|---|
| 1 | Duplicate weekly schedules (employeeId + effectiveFrom) | **0** → SAFE to add `@@unique` |
| 2 | Employees with >1 open-ended weekly schedule | **1** (`da700851-…13950`, 3 open-ended) — SW-01 present in live data |
| 3 | Overlapping weekly schedule ranges | **3 pairs**, all the same employee → deterministically repairable |
| 4 | Training-generated compliance records | 0 participants linked, 0 `TRN-` records, **0 orphans** → SW-04 fix is preventive |
| 5 | Duplicate notification groups | **0** → SW-15 fix is preventive |
| 6/7 | AttendanceRecord | **20 rows**, 2026-07-12 .. 2026-07-16, 5 distinct dates (16 PRESENT, 4 LATE) |
| — | Attendance rows owned by archived/non-ACTIVE employees | **20 of 20** → SW-05 is live: AI counts 20, Reports/Tally count 0 |
| 8 | Leave balances | 45 rows, 0 negative, 0 overspent, **0 pending mismatches** |
| 10 | Scheduling model usage | Weekly: 3 rows / 1 employee · Legacy assignments: 125 rows / **62 employees** · Templates 18 · Shifts 6 · Both systems: 1 employee |
| 11 | Date-only round-trip | Server TZ offset −480 (GMT+0800). Stored `@db.Date` returns as local 08:00 = **00:00Z**. `toISOString().slice(0,10)` → correct date. **No drift.** |

### Conclusions

- **Unique constraint on `(employeeId, effectiveFrom)` is safe to add** — no violating rows.
- **No ambiguous same-effective-date schedules** → no manual reconciliation required.
- 3 overlapping ranges belong to one employee and are repairable by the deterministic rule
  (each schedule's `effectiveTo` = the next schedule's `effectiveFrom`).
- SW-04 and SW-15 have no bad data yet; the fixes prevent future occurrences.
- **SW-05 is not theoretical**: every attendance row currently belongs to a non-active
  employee, so AI Assistance reports 20 records where Reports and Tally report 0.
- Date handling is currently **correct**: `@db.Date` round-trips through UTC midnight, and
  UTC extraction is the right method. Local-component extraction would be the unsafe one.

---

## Schema changes

Migration: `20260907110000_add_attendance_import_foundation_and_integrity_constraints`

**Additive only.** Hand-filtered from `prisma migrate diff` output: the generated
diff also contained 6 `DROP INDEX` statements, a dropped foreign key on
`compliance_requirements`, and a dozen no-op `MODIFY ... JSON` statements including
one on `payslips`. All of that is PRE-EXISTING drift between migration history and
`schema.prisma`, not part of this change — it was removed deliberately. Reconciling
that drift is a separate, explicit task.

| Change | Object |
|---|---|
| 3 new tables | `attendance_import_batches`, `attendance_import_raw_rows`, `attendance_import_candidates` |
| 4 new enums | `AttendanceImportStatus`, `AttendanceImportClassification`, `AttendanceImportDecision`, `AttendanceRecordSource` |
| 5 new columns | `attendance_records`: `sourceType` (default LEGACY), `lastImportBatchId`, `manuallyModifiedAt`, `manuallyModifiedById`, `recordVersion` |
| 1 new column | `employee_compliance_records.generatedFromTrainingParticipantId` (unique) |
| 1 new column | `notifications.eventId` (unique) |
| 2 new indexes | `employee_weekly_schedules` unique `(employeeId, effectiveFrom)` + composite index |
| 0 destructive statements | verified: no DROP TABLE / DROP COLUMN / TRUNCATE / DELETE |

Verified after deploy: all 20 existing `attendance_records` carry `sourceType = LEGACY`.

---

## Migration status

- Start: 13 migrations, schema up to date.
- Backup taken before any write: `hrisense_db_backup_pre_logic_integrity_20260907_105430.sql` (606 KB). Existing backups untouched.
- Migration tested on a rebuilt `hrisense_migration_dev_db` from scratch: **all 14 applied cleanly**.
- `prisma migrate deploy` on `hrisense_db`: **applied**.
- `prisma migrate status`: **Database schema is up to date** (14 migrations).
- `prisma generate`: **PASS** (required stopping the dev server — it held the Windows query-engine DLL).
- NEVER run against `hrisense_db`: `migrate dev`, `migrate reset`, `db push`, seed. Confirmed none were.

---

## Build status

- Start: not yet run for this pass.

---

## Build status (final)

| Check | Result |
|---|---|
| API build (`tsc`) | PASS |
| Web build (`tsc -b && vite build`) | PASS |
| `prisma validate` | PASS |
| `prisma migrate deploy` | PASS (1 applied) |
| `prisma migrate status` | up to date (14 migrations) |
| `prisma generate` | PASS |
| business-date round-trip | 13/13 PASS |
| post-fix integrity preflight | 0 overlaps / 0 orphans / 0 anomalies |

## Files changed

**API source modified (11)**: `config/env.ts`, `index.ts`,
`controllers/attendance.controller.ts`, `routes/attendance.routes.ts`,
`routes/public-recruitment.routes.ts`, `lib/applicationStatusToken.ts`,
`services/attendance.service.ts`, `services/leave.service.ts`,
`services/evaluation.service.ts`, `services/training.service.ts`,
`services/document.service.ts`, `services/weekly-schedule.service.ts`,
`services/report.service.ts`, `services/notification.service.ts`,
`services/ai/workforce-facts.service.ts`,
`services/email/brevo-transactional.provider.ts`

**API source created (5)**: `lib/businessDate.ts`, `lib/workforceScope.ts`,
`services/schedule-resolver.service.ts`,
`services/attendance-import/normalizer.ts`,
`services/attendance-import/classification.service.ts`

**Scripts created (3)**: `scripts/preflight-integrity-check.ts`,
`scripts/repair-weekly-schedule-ranges.ts`,
`scripts/verify-business-date-roundtrip.ts`

**Schema**: `prisma/schema.prisma` + 1 migration directory

**Web source**: NONE modified in this pass

**Not modified by me**: `apps/api/.env` (the user enabled transactional email)

---

## Known blockers

- **Real Mustard Seedtime sample** — blocks the normalizer, and therefore the
  apply engine and the import HTTP surface.
- **62 employees on legacy schedule assignments only** — migrating them into
  `EmployeeWeeklySchedule` needs a client backfill decision.
- **CLIENT POLICY REQUIRED** — ENRICHMENT auto-apply; "No Imported Record"
  definition; leave report date basis; import file retention; manual-flag reset.

---

## Exact continuation point

ALL PHASES COMPLETE.

Final report: `docs/LOGIC_DATA_INTEGRITY_REPAIR_REPORT.md`

**Status: CURRENT LOGIC/DATA-INTEGRITY REPAIRS COMPLETE — ATTENDANCE IMPORT
FOUNDATION COMPLETE — REAL MUSTARD NORMALIZER DEFERRED — MANUAL USER QA REQUIRED.**

NOTE: the API dev server was stopped to release the Prisma query-engine DLL lock.
Restart with `npm run dev`.
