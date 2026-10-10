# Logic & Data-Integrity Repair + Attendance Import Foundation — Report

**Date**: 2026-09-07
**Repository**: `C:\xampp\htdocs\HRISense`
**Branch**: `main` · **HEAD**: `7648345b4c08ec74387ee2b8f67136395c5549b8` (unchanged)
**Git write operations**: NONE

---

## 1. What was done

Two goals, both completed:

- **Goal A** — repair the confirmed logic and data-integrity defects found in
  `docs/ATTENDANCE_IMPORT_OVERLAP_DESIGN_REVIEW.md` §24.
- **Goal B** — build the **format-independent** foundation for safe attendance
  imports, without implementing the Mustard Seedtime parser.

No Mustard column, sheet name, identifier format, punch-pairing rule, overnight
rule, lateness formula or absence rule was invented anywhere.

---

## 2. Database preflight (read-only, before any change)

Script: `apps/api/scripts/preflight-integrity-check.ts` — performs no writes.

| Check | Before | After |
|---|---|---|
| Duplicate weekly schedules (employeeId + effectiveFrom) | **0** | 0 |
| Employees with >1 open-ended weekly schedule | **1** (3 rows) | **0** |
| Overlapping weekly schedule ranges | **3 pairs** | **0** |
| Ambiguous same-effective-date schedules | **0** | 0 |
| Orphan training-generated compliance records | 0 | 0 |
| Duplicate notification groups | 0 | 0 |
| AttendanceRecord rows | 20 (2026-07-12 … 07-16) | 20 |
| Attendance owned by archived/non-ACTIVE employees | **20 of 20** | 20 of 20 |
| Leave balance anomalies (negative / overspent / pending mismatch) | 0 / 0 / 0 | 0 / 0 / 0 |
| Date-only round-trip drift | none | none |

The 3 overlapping ranges were the SW-01 bug visible in live data. They were
repaired deterministically (each schedule's `effectiveTo` = the next schedule's
`effectiveFrom`), which restores the intended half-open timeline rather than
inventing policy. **No ambiguous rows existed, so nothing needed manual
reconciliation and nothing was deleted.**

---

## 3. Fixes applied

### SW-01 — Weekly schedule effective-range bug · FIXED

`weekly-schedule.service.ts` computed `newEffectiveTo` and then discarded it; the
`create` hardcoded `effectiveTo: null`. Inserting a schedule before an existing
future one produced two rows both covering the same dates.

The computed value is now used. Data repaired via
`apps/api/scripts/repair-weekly-schedule-ranges.ts` (dry-run by default, `--apply`
to write; refuses to touch any employee holding two schedules with the same
effective date).

### SW-06 — Weekly schedule database protection · ADDED

`@@unique([employeeId, effectiveFrom])` and `@@index([employeeId, effectiveFrom,
effectiveTo])`. Preflight confirmed **0 violating rows** before adding.

### SW-07 — Canonical scheduling authority · RESOLVED

New `ScheduleResolverService` (`schedule-resolver.service.ts`) is the single
authority for "what is this employee scheduled to do on this date".

Precedence, deliberately strict:

1. `EmployeeWeeklySchedule` covering the date → **authoritative**
2. otherwise a legacy `EmployeeScheduleAssignment` → reported as `LEGACY_TEMPLATE`
3. otherwise → `UNRESOLVED`

The two sources are **never merged** for one employee-day. When a weekly schedule
exists, the legacy assignment is not consulted at all.

`Employee.workSchedule` (the coarse enum) is display-only and is never used to
decide whether a date is a working day. Legacy tables remain physically in the
schema — nothing was dropped.

**Legacy fallback that remains, stated precisely**: 62 employees currently have
only a legacy `EmployeeScheduleAssignment` and no weekly schedule. For them the
resolver returns `source: LEGACY_TEMPLATE` with `status: UNCONFIGURED` and a note
telling HR to set a weekly schedule. It does **not** guess their working days.

`AttendanceService.getSchedules` still lists `Employee.workSchedule` as a display
column; it does not use it for any per-date decision. Migrating the 62 legacy
assignments into weekly schedules needs a client backfill decision and is
documented as outstanding, not silently performed.

### SW-02 — Leave double-approval / retry · FIXED (all four transitions)

`approve`, `reject`, `endorse` and `cancel` now transition through a guarded
write: the status precondition is in the `WHERE` clause via `updateMany`, and the
caller asserts `count === 1`.

If the count is 0, the row already moved — the method throws `409` and performs
**no** side effects. Balance updates, notifications and audit entries all run only
after the transition is genuinely won by that caller.

`approvedById` cannot be set through `updateManyMutationInput`, so the guarded
claim carries the scalar fields and the approver is attached immediately after,
inside the same transaction — safe, because the claim has already been won.

### SW-03 — Leave pending balance concurrency · FIXED

`Math.max(0, balance.pending - days)` computed in Node is gone. Release now uses a
guarded database-side decrement:

```
updateMany({ where: { id, pending: { gte: days } }, data: { pending: { decrement: days } } })
```

When that matches nothing the stored `pending` is smaller than the days being
released — a real data-integrity condition. It is **surfaced**, not clamped away:
an `LEAVE_BALANCE_PENDING_ANOMALY` audit entry records the before/after figures,
and the anomaly text is returned to the caller as `balanceWarning`. The HR
decision itself still completes, because refusing to approve leave over a stale
counter would be worse than reporting it.

### SW-04 — Training → compliance atomicity + duplication · FIXED

Both writes now happen in one `prisma.$transaction`: creating the
`EmployeeComplianceRecord` and linking it back to the `TrainingParticipant`.

Idempotency uses a **source-event key**, as specified:
`EmployeeComplianceRecord.generatedFromTrainingParticipantId`, nullable and
**unique**. It means "this compliance record was generated from THIS training
completion". A retry finds the existing record and reuses it instead of creating a
second.

Deliberately **not** a uniqueness rule over `(employee, requirement)` — recurring
requirements legitimately produce several records over time, and that constraint
would be false.

### SW-05 — AI attendance fact-sheet population · FIXED

All three attendance queries in `workforce-facts.service.ts` are now scoped with
`employee: { deletedAt: null, employmentState: 'ACTIVE' }`.

This matters concretely here: **all 20 attendance rows belong to non-active
employees**, so AI Assistance was reporting 20 records where Reports and Tally
reported 0.

`daysWithNoImportedRecord` now subtracts like-for-like. Previously
`expectedEmployeeDays` counted active employees while `distinctAttendanceDays`
counted everybody — a mixed-population subtraction that understated the ingestion
gap and could clamp a real gap to zero.

**Shared filter**: `apps/api/src/lib/workforceScope.ts` now holds the single
definition. `ReportService`, `AttendanceService` (4 call sites) and the AI fact
sheet all import it, so they cannot drift again.

### SW-09 — Attendance manual-correction audit · FIXED

`AttendanceService.update` returns `{ before, after, record }`; the controller
writes **both** `oldValue` and `newValue`. `AuditLog.oldValue` already existed and
was simply never populated.

The snapshot is a deliberate subset (date, times, status, hours, remarks) — no
ids, no session data, nothing sensitive.

### SW-10 — Attendance update validation · FIXED

`PUT /attendance/:id` now validates through the project's existing `validate`
middleware with a zod schema: enum-checked `status`, parseable timestamps,
bounded numerics, `.strict()` to reject unknown fields, a "provide at least one
field" rule and a "time out cannot precede time in" rule. The `as any` cast on
status is gone.

`null` is accepted and distinct from omission, because clearing a time-out is a
legitimate correction.

### SW-11 — Date-only handling · VERIFIED AND CENTRALISED

New `apps/api/src/lib/businessDate.ts` with `toBusinessDate`, `businessDateKey`,
`instantToBusinessDate`, `businessDaysBetweenInclusive`, `isSameBusinessDate`,
`formatBusinessDate`. Business timezone `Asia/Manila`.

Verified by `apps/api/scripts/verify-business-date-roundtrip.ts` — **13/13 checks
pass**, including all 30 days of a month, a leap day, year boundaries, and
instants either side of Manila midnight.

The verification caught a real defect in my own first implementation: reading UTC
components directly returned **4 September** for `new Date('2026-09-05T00:00:00')`
on a UTC+8 server. The helper now interprets any `Date` as an instant in the
business timezone, which is correct for both shapes that occur in practice —
Prisma `@db.Date` values (UTC midnight → same day) and locally-constructed dates.

The DB round-trip probe **refuses to write to `hrisense_db`**; it runs against the
migration database when `SHADOW_DATABASE_URL` is set, and otherwise reports
SKIPPED. The read-only preflight already confirmed stored `@db.Date` values return
as UTC midnight with no drift.

### SW-14 — Evaluation double-submit / finalize · FIXED

Both `submit` and `finalize` now claim the transition with a guarded
`updateMany` before doing anything else. On submit the claim happens **first**, so
a losing caller writes no response rows at all. Repeats return `409`.

### SW-15 — Notification idempotency · FIXED

`Notification.eventId` added, nullable and unique — mirroring the
`ApplicantCommunication.eventId` pattern already proven in recruitment.

`NotificationService.notify` scopes the key per recipient automatically, so one
event key notifies many people. A unique-violation on retry is treated as "already
sent" and returns quietly rather than logging a failure. `notifyMany` uses
`skipDuplicates` so one already-notified recipient does not fail the batch.

Wired for `leave-approved:<id>` and `leave-rejected:<id>`. Notifications remain
secondary: a notification failure never rolls back the business operation.

### SW-16 — Document orphan file cleanup · FIXED

`DocumentService.uploadDocument` now calls the existing `cleanupUploadedFiles` on
both failure paths (employee not found, and DB create failure). Onboarding already
did this; this path was missing it.

---

## 4. Deliberately NOT changed

| Item | Why |
|---|---|
| **SW-08** — employee identifier mapping for import | Needs the real Mustard sample. Never match by name. |
| **SW-13** — `AttendanceLog` uniqueness | We do not yet know whether the importer will write logs. Adding a constraint now would guess. |
| **SW-12** — "No Imported Record" definition | Still calendar days minus days with a record. Truthful, and it never infers absence. Whether it should become *scheduled working days without a record* is **CLIENT POLICY REQUIRED**, and depends on the 62 legacy-schedule employees being migrated first. |
| **SW-17** — Leave report filed-date vs leave-date | Two legitimate definitions. Not silently redefined. **CLIENT POLICY REQUIRED**. |
| **SW-18** — `verifiedById` | NOT repurposed for provenance. Its meaning is "verified", not "source". Documented in the schema for a later cleanup decision. |
| Legacy Prisma models (`Payslip`, `SupervisionLink`, legacy health/compliance/training) | Not dropped. Separate historical-data task. Payroll remains out of runtime scope — `prisma.payslip` has **0** usages. |

---

## 5. Attendance import foundation (format-independent)

### Three-layer pipeline, as specified

```
AttendanceImportBatch
      └── AttendanceImportRawRow        (verbatim source evidence)
            └── AttendanceImportCandidate   (normalized employee-day)
                  └── AttendanceRecord
```

Raw rows and candidates are **separate models**. `AttendanceImportRawRow` has a
nullable `candidateId`, so MANY raw rows can point to ONE candidate — which is
exactly what a multi-punch export would require, and cannot be represented if the
layers are collapsed.

### Models

| Model | Key points |
|---|---|
| `AttendanceImportBatch` | `fileHash` (SHA-256, **indexed, NOT unique**), filename, size, uploader, status, detected period, 8 classification counters, 3 apply counters, confirmer, `normalizerVersion` |
| `AttendanceImportRawRow` | `sourceRowNumber`, `sourceSheetName`, `rawPayload Json` (uninterpreted), `rawRowHash`, `candidateId`. Unique `(batchId, sourceRowNumber)` |
| `AttendanceImportCandidate` | employee, date, times, status, hours, `classification`, `existingRecordId`, `existingSnapshot`, `existingRecordVersion`, `hrDecision`, `appliedAt`, `applyError`. Unique `(batchId, employeeId, date)` |

### Enums

`AttendanceImportStatus` · `AttendanceImportClassification` ·
`AttendanceImportDecision` · `AttendanceRecordSource`

### AttendanceRecord provenance

`sourceType` (default **LEGACY**), `lastImportBatchId`, `manuallyModifiedAt`,
`manuallyModifiedById`, `recordVersion`.

**Verified after deploy: all 20 existing rows carry `sourceType = LEGACY`.** They
are not labelled IMPORT, because their true origin is unknown and claiming
otherwise would be false.

`AttendanceService.update` sets `MANUAL`, stamps who and when, and increments
`recordVersion`.

### Normalizer — interface only, fails closed

`attendance-import/normalizer.ts` defines `RawSourceRow`,
`NormalizedDailyCandidate`, `AttendanceNormalizer` and a registry that is
**deliberately empty**. `isAttendanceImportProcessingAvailable()` returns false and
`NORMALIZER_UNAVAILABLE_MESSAGE` explains why in plain language.

No fixture normalizer was registered — the instruction was explicit that fake
fixture data must not reach the production system.

### Classification engine

`attendance-import/classification.service.ts`, entirely format-independent:

| Classification | Default decision |
|---|---|
| `NEW` | USE_UPLOADED |
| `EXACT_DUPLICATE` | **SKIP — zero write, no `updatedAt` bump, no audit** |
| `ENRICHMENT` | **PENDING** (auto-apply is CLIENT POLICY REQUIRED) |
| `CONFLICT` | **PENDING** |
| `CONFLICT_MANUAL` | **KEEP_EXISTING** |
| `DUPLICATE_IN_FILE` | SKIP |
| `UNKNOWN_EMPLOYEE` / `INVALID` | SKIP (cannot apply) |

`remarks` is excluded from comparison — it is HR's free-text field and an import
must never overwrite it or treat it as a conflict.

`CONFLICT_MANUAL` is checked **before** plain `CONFLICT`, so hand-corrected records
get the louder class and the safer default.

### Not built yet, by design

The apply engine and HTTP surface were **not** exposed. With no normalizer, no
candidate can legitimately exist, so an apply path would be unreachable code whose
first real exercise would be against production data. The classification engine —
the part that can be reasoned about and reviewed without the file — is complete
and ready for it.

---

## 6. Configuration cleanup

Variables whose absence materially changes behaviour moved into the zod schema:
`ENABLE_TRANSACTIONAL_EMAILS`, `BREVO_API_KEY`, `DEFAULT_FROM_NAME`,
`DEFAULT_FROM_EMAIL`, `APPLICATION_STATUS_TOKEN_SECRET`, `TRUST_PROXY`, and the
four public rate-limit settings.

All optional, so a developer machine with integrations off still boots.
**Conditional validation**: when `ENABLE_TRANSACTIONAL_EMAILS` is true,
`BREVO_API_KEY` and a valid `DEFAULT_FROM_EMAIL` become required — a
half-configured mail setup now fails loudly at boot instead of silently at the
first send. Only variable **names** are ever printed.

`brevo-transactional.provider.ts`, `applicationStatusToken.ts`,
`public-recruitment.routes.ts` and `index.ts` now read the validated config
instead of raw `process.env`.

> Observed during this pass: `ENABLE_TRANSACTIONAL_EMAILS` is now **true** in
> `apps/api/.env`, and the conditional validation passed — so the API key and
> from-address are both present. **Transactional email is live.** No email was
> sent during this work.

---

## 7. Migration

**Name**: `20260907110000_add_attendance_import_foundation_and_integrity_constraints`

**Process followed**: preflight → backup → author against
`hrisense_migration_dev_db` → hand review → test on a rebuilt dev DB → `migrate
deploy` to `hrisense_db` → `migrate status` → `generate`.

**Backup**: `hrisense_db_backup_pre_logic_integrity_20260907_105430.sql` (606 KB).
Existing backups untouched.

**Hand-filtered.** `prisma migrate diff` also emitted **19 blocks of pre-existing
drift** between migration history and `schema.prisma`: 6 `DROP INDEX` statements,
a dropped foreign key on `compliance_requirements`, and a dozen no-op
`MODIFY … JSON` statements **including one on `payslips`**. None of that belongs to
this change, payroll is out of scope, and dropping indexes nobody asked to drop
would be a silent performance regression. They were removed deliberately and the
reasoning is recorded in the migration header. Reconciling that drift is a
separate, explicit task.

**Content**: 3 CREATE TABLE, 23 executable statements total, **0 destructive**
(verified: no DROP TABLE / DROP COLUMN / TRUNCATE / DELETE / DROP INDEX outside
comments).

**Never run against `hrisense_db`**: `migrate dev`, `migrate reset`, `db push`,
seed, drop. The migration dev database was dropped and recreated — that is its
purpose, and it holds no real data.

---

## 8. Validation

| Check | Result |
|---|---|
| API build (`tsc`) | **PASS** |
| Web build (`tsc -b && vite build`) | **PASS** |
| `prisma validate` | **PASS** |
| `prisma migrate deploy` | **PASS** — 1 migration applied |
| `prisma migrate status` | **Database schema is up to date** (14 migrations) |
| `prisma generate` | **PASS** (required stopping the dev server — Windows DLL lock) |
| Business-date round-trip | **13/13 checks pass** |
| Post-fix integrity preflight | 0 overlaps, 0 open-ended duplicates, 0 orphans |
| Browser automation | **NONE** |
| Live email / paid AI call | **NONE** |

---

## 9. Outstanding

### Manual data reconciliation
**None.** No ambiguous same-effective-date schedules existed.

### CLIENT POLICY REQUIRED
1. `ENRICHMENT` auto-apply, or always confirm
2. "No Imported Record" → scheduled working days?
3. Leave report: filed-date vs leave-date
4. Import file and raw-row retention period
5. Whether a manual-correction flag clears after an approved override
6. Migrating the 62 legacy schedule assignments into weekly schedules

### MUSTARD SAMPLE REQUIRED
Column mapping · sheet selection · employee identifier · format A vs B · punch
pairing · time parsing · status derivation · lateness/half-day/night handling ·
absence representation.

### Deferred
Attendance import apply engine + HTTP surface (blocked on the normalizer);
`AttendanceLog` uniqueness; `verifiedById` cleanup; legacy model cleanup;
migration-history drift reconciliation.

---

## 10. Status

```
CURRENT LOGIC/DATA-INTEGRITY REPAIRS COMPLETE
ATTENDANCE IMPORT FOUNDATION COMPLETE
REAL MUSTARD NORMALIZER DEFERRED — SAMPLE REQUIRED
MANUAL USER QA REQUIRED
```

> **The API dev server was stopped** to release the Prisma query-engine DLL lock.
> Restart it with `npm run dev` before manual testing.
