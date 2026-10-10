# Attendance Import Overlap & Duplicate Handling — Design Review

**Status**: DESIGN REVIEW ONLY — nothing implemented, no schema change, no migration, no commit.
**Date**: 2026-09-07
**Repository**: `C:\xampp\htdocs\HRISense` @ `main` `7648345b` (unchanged)
**Scope**: how HRISense should handle overlapping / duplicate attendance Excel imports once the real Mustard Seedtime export arrives, plus a system-wide logic and data-integrity sweep.

> Every claim about current behaviour in this document was read from the current source on 2026-09-07. Where the source and older docs disagree, the source wins. Where a rule depends on Hospicio policy, it is marked **CLIENT POLICY REQUIRED** and left undecided.

---

## 1. Executive Recommendation

**Build a two-phase, staged, HR-confirmed import. Never write directly from a parsed file to `AttendanceRecord`.**

The recommended shape:

```
Upload → hash & store batch → parse to staging rows → classify every row
       → HR reviews a summary + conflict list → HR confirms
       → chunked transactional apply → batch closed with counts
```

Five decisions drive everything else:

1. **Staging is mandatory.** Classification must happen against persisted rows, not in memory, because HR review happens across HTTP requests and the server may restart between them.
2. **Never `upsert`.** Compare first, then decide. `upsert` cannot distinguish "same values" from "different values", so it silently destroys the distinction between a harmless re-import and a real conflict.
3. **Exact duplicates auto-skip. Conflicts never auto-apply.** This is the entire idempotency guarantee.
4. **Manual corrections need a first-class marker on `AttendanceRecord`.** Today there is no way to tell a manually corrected record from an imported one — this is the single biggest blocker (see §3 and §10).
5. **The parser is the only part that must wait for the real file.** Everything above the parser — batching, hashing, staging, classification, conflict UX, transactions, locking, audit — can be designed and built now against a narrow internal interface.

**Schema change is required.** It is additive (new models + a small number of nullable columns on `AttendanceRecord`) and can be authored later against the migration dev database.

---

## 2. Current Attendance Architecture

Read from source on 2026-09-07.

### `AttendanceRecord` (`apps/api/prisma/schema.prisma`)

```prisma
model AttendanceRecord {
  id            String           @id @default(uuid())
  employeeId    String
  employee      Employee         @relation(fields: [employeeId], references: [id])
  date          DateTime         @db.Date
  timeIn        DateTime?
  timeOut       DateTime?
  status        AttendanceStatus
  hoursWorked   Float?
  overtimeHours Float?
  remarks       String?
  verifiedById  String?
  logs          AttendanceLog[]
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  @@unique([employeeId, date])
  @@index([employeeId]) @@index([date]) @@index([status])
}
```

`AttendanceStatus` = `PRESENT | ABSENT | LATE | HALF_DAY | ON_LEAVE | HOLIDAY | REST_DAY | SUSPENDED`.

**`NO_RECORD` is not in the enum.** It is a runtime-only marker produced by `AttendanceService.getCalendar` (`attendance.service.ts:285`) for employee-days with no row. This is correct and must be preserved — it is what keeps "no data" distinct from "absent".

### `AttendanceLog`

A separate table for LATE / UNDERTIME / EXCUSE_SLIP / OVERTIME / ABSENT_UNEXCUSED entries, optionally linked to an `AttendanceRecord`. **It has no unique constraint** — only indexes on `employeeId` and `logDate`.

### Service surface (`attendance.service.ts`)

`resolveScope` · `getCalendar` · `list` · `getLogs` · `getSchedules` · `getTodaySummary` · `getTally` · `update` · `exportExcel` · `exportPDF`.

### Routes (`attendance.routes.ts`)

All authenticated. `GET /summary/today` and `GET /logs` are tier-gated. **`PUT /:id` is `authorize(['FULL'])`** — HR-only manual correction. Export endpoints are `POST`.

### Answers to the seven confirmation questions you asked

| # | Question | Answer (verified) |
|---|---|---|
| 1 | Current `AttendanceRecord` unique constraint | **`@@unique([employeeId, date])` exists.** Good foundation — the DB already prevents two rows for one employee-day. |
| 2 | Current attendance update endpoint | `PUT /attendance/:id`, HR-only, → `AttendanceService.update` (`attendance.service.ts:679`). |
| 3 | How manual adjustments are stored / audited | Stored by direct `prisma.attendanceRecord.update`. Audited by `createAuditLog({ action: 'UPDATE_ATTENDANCE', newValue: req.body })` in `attendance.controller.ts`. **No `oldValue` is captured** and **no marker is written to the record.** The prior values are lost. |
| 4 | Does any import-related model exist | **No.** No batch, staging, or file-hash model of any kind. |
| 5 | Does any provenance/source field exist | **No.** `AttendanceRecord` has no `sourceType`, `importBatchId`, `manuallyModifiedAt`, or version column. `verifiedById` exists but is **referenced nowhere in `apps/api/src`** — it is a dangling field, and its name means "verified", not "source", so it should not be repurposed. |
| 6 | Can the current `AuditLog` support this | **Yes, structurally.** It has `actorUserId`, `action`, `entityType`, `entityId`, `metadata Json`, `oldValue Json`, `newValue Json`, `ipAddress`, `userAgent`, `createdAt`, indexed on actor / target / entityType / createdAt. It is sufficient for import auditing. It is **not** sufficient as the *mechanism* for manual-correction detection — see §10. |
| 7 | Does export/report logic assume one record per employee/date | **Yes, and correctly so.** `AttendanceService.getTally` (`:657`) computes `noImportedRecord = totalCalendarDays − distinctDates.size` using a `Set` of dates, with an explicit comment that distinct dates prevent duplicate rows from shrinking the count. `ReportService.attendance` (`report.service.ts:212`) uses the same `calendarDays − days.size` formula. Both are consistent with each other and with the unique constraint. |

---

## 3. Current Constraints

**What already protects you**

- `@@unique([employeeId, date])` on `AttendanceRecord` — a duplicate insert fails at the database, not just in application code. This is the strongest asset you have going into this design.
- `NO_RECORD` is derived, never stored — no risk of an import writing a fake "no record" row.
- Tally and Reports both count distinct dates, so even if duplicates somehow existed, the headline counts would not double.
- `PUT /attendance/:id` is HR-only.

**What is missing and blocks the design**

| Gap | Consequence for import |
|---|---|
| No provenance on `AttendanceRecord` | Cannot tell an imported record from an HR-corrected one. **A later overlapping import cannot protect manual corrections.** This is the blocking gap. |
| No `oldValue` captured on manual correction | Even audit-log archaeology cannot reliably reconstruct what HR changed. |
| No import batch / staging models | Nowhere to persist a parsed file between "preview" and "confirm". |
| No file hash storage | Cannot detect a re-uploaded identical file. |
| `PUT /attendance/:id` has no request validation | The route has no `validate()` middleware; the service casts `data.status as any`. An out-of-enum status reaches the database and throws there. Low impact today (HR-only), but the same body shape will be reused by conflict resolution. |

---

## 4. Overlap Problem Types

Your nine scenarios, mapped to the mechanism that must handle each.

| # | Scenario | Handled by |
|---|---|---|
| 1 | Same file uploaded twice | File SHA-256 (§7) → warn; then per-row `EXACT_DUPLICATE` → skip (§6) |
| 2 | Two files, overlapping date ranges (Sep 1–15, Sep 10–30) | Per-row classification. Overlap is normal, not an error. Rows in the intersection resolve to `EXACT_DUPLICATE` or `CONFLICT` individually. |
| 3 | Employee/date already exists | Per-row comparison against the existing record |
| 4 | Exists with different values | `CONFLICT` → HR decision required, never auto-applied |
| 5 | Duplicate rows inside one Excel | `DUPLICATE_IN_FILE` — detected during staging, before comparison |
| 6 | Existing record was manually corrected, later import overlaps | `CONFLICT_MANUAL` — a distinct, louder class (§10) |
| 7 | Earlier import incomplete, later export more complete (`timeOut: null` → `17:00`) | `ENRICHMENT` — a strict superset of existing data (§9). **CLIENT POLICY REQUIRED**: auto-apply or confirm. |
| 8 | Two HR users upload overlapping files simultaneously | Batch-level advisory lock + per-row re-validation inside the apply transaction (§15) |
| 9 | File covers dates already imported by another batch | Identical to #2/#3. Provenance records which batch last wrote each record. |

The essential insight: **overlapping date ranges are a normal operating condition, not an error.** Only *value disagreement* is exceptional. Design for overlap as the common case.

---

## 5. Recommended Import Lifecycle

```
  UPLOADED ──► PARSING ──► VALIDATED ──► (HR reviews) ──► APPLYING ──► COMPLETED
     │            │            │                             │           
     │            ▼            ▼                             ▼           
     │         FAILED       CANCELLED                  PARTIALLY_APPLIED 
     └──────────────────────────────────────────────────────────────────►
```

| State | Meaning | Allowed next |
|---|---|---|
| `UPLOADED` | File stored, hash computed, batch row created. Nothing parsed. | `PARSING`, `FAILED` |
| `PARSING` | Reading the workbook into staging rows. | `VALIDATED`, `FAILED` |
| `VALIDATED` | All rows staged and classified. Counts available. **No `AttendanceRecord` written yet.** | `APPLYING`, `CANCELLED` |
| `APPLYING` | Confirmed apply in progress. Batch is locked. | `COMPLETED`, `PARTIALLY_APPLIED`, `FAILED` |
| `COMPLETED` | Every row reached a terminal disposition. | *(terminal)* |
| `PARTIALLY_APPLIED` | Some chunks committed, some failed. Resumable. | `APPLYING` (resume), `CANCELLED` |
| `CANCELLED` | HR abandoned it. Staging retained for audit. | *(terminal)* |
| `FAILED` | Parse or infrastructure failure. | *(terminal, re-upload to retry)* |

Two properties matter:

- **No attendance is written before `APPLYING`.** A validated batch that is never confirmed changes nothing.
- **The transition into `APPLYING` must be a conditional update** (`WHERE status = 'VALIDATED'`), so a double-click cannot start two applies. See §15.

---

## 6. Recommended Duplicate Classification

Your proposed set is close. I recommend **eight row classes**, splitting one of yours and adding one:

| Class | Meaning | Default action |
|---|---|---|
| `NEW` | No existing record for employee+date | Insert |
| `EXACT_DUPLICATE` | Existing record, all compared fields identical | **Skip silently** (counted, not shown individually) |
| `ENRICHMENT` | Existing values are a strict subset — every non-null existing field matches, and the upload fills at least one field that was null | **CLIENT POLICY REQUIRED** (see below) |
| `CONFLICT` | Existing record differs on at least one non-null field, and was last written by an import | **Require HR decision.** Never auto-apply. |
| `CONFLICT_MANUAL` | Same as `CONFLICT`, but the existing record was manually corrected by HR | **Require HR decision, defaulted to Keep Existing**, and visually distinguished |
| `DUPLICATE_IN_FILE` | A second row in the *same file* for an employee+date already staged | Flag; only the resolved row applies |
| `UNKNOWN_EMPLOYEE` | Source identifier matched no active employee | Cannot apply; reported |
| `INVALID` | Row failed structural validation (unparseable date/time, missing required field) | Cannot apply; reported with the reason |

### Why this set, and what I changed from yours

- **I split `CONFLICT` into `CONFLICT` and `CONFLICT_MANUAL`.** Your list had `MANUALLY_MODIFIED_EXISTING` as a peer of `CONFLICT`, but they are not peers — a manually-modified record is only interesting *when the upload disagrees with it*. If the upload matches, it is simply an `EXACT_DUPLICATE` and there is nothing to protect. Making it a conflict subtype means the "protect manual work" rule is enforced at exactly the point it matters and nowhere else.
- **I renamed your `UPDATED_SOURCE_DATA` to `ENRICHMENT` and gave it a strict definition.** "Updated source data" is ambiguous — it could describe any change. `ENRICHMENT` means specifically: *nothing that was known has changed; something that was unknown is now known.* That is safely distinguishable from a conflict by a mechanical rule, which is what makes it eligible for a different default.
- **I dropped `UNKNOWN`.** A row that cannot be classified is a defect in the classifier, not a business state. Anything unclassifiable should be `INVALID` with a reason string, so it surfaces as something to fix rather than something to ignore.
- **I kept `DUPLICATE_IN_FILE` as its own class** rather than folding it into `EXACT_DUPLICATE`, because its cause is different (a malformed export, or a raw-punch file being treated as a daily file) and HR should see it as a signal about the *file*, not about HRISense's data.

### The `ENRICHMENT` policy question

**CLIENT POLICY REQUIRED.** Does Hospicio want a later, more complete export to automatically fill a `timeOut` that was previously null?

- **Auto-apply** is convenient and matches the intuition that "more data is better".
- **Confirm** is safer, because a null `timeOut` may itself be meaningful (an employee who genuinely never punched out), and silently filling it changes the record's meaning.

My recommendation if Hospicio has no opinion: **confirm, but grouped** — present all enrichments as one bulk-approvable group with a single "Apply all enrichments" action. That keeps it one click without making it invisible. Do not implement auto-apply until this is answered.

---

## 7. File-Level Duplicate Strategy

**Yes — compute SHA-256.** It is cheap, deterministic, and answers "have I seen this exact file before" with certainty.

| Question | Recommendation |
|---|---|
| **When calculated** | On receipt, over the raw bytes, **before parsing**. Streaming hash while writing to disk avoids a second read. |
| **What is stored** | `fileHash` (64 hex chars), `originalFilename`, `fileSizeBytes`, `uploadedByUserId`, `uploadedAt`. Store the hash on the batch row and index it. |
| **Block or warn** | **Warn, never block.** Blocking is wrong for two independent reasons: (a) a previous import of the same file may have been cancelled or failed, so re-uploading is the correct recovery; (b) hash equality already implies every row will classify as `EXACT_DUPLICATE`, so the row-level layer makes the import a no-op anyway. Blocking adds a failure mode without adding safety. |
| **What the warning says** | Name the earlier batch, its date, its uploader, and its outcome — e.g. *"This exact file was uploaded on 3 September by J. Cruz and completed successfully (412 rows imported, 0 conflicts). Importing it again will change nothing."* Then let HR proceed. |
| **Re-upload after a failed import** | Explicitly supported. The warning should read differently: *"This file was uploaded on 3 September but the import failed and was not applied."* This is the recovery path, so it must not feel like an error. |
| **Does filename matter** | **For identity, no — hash alone.** Filename is display metadata only. Two files with the same hash are the same file regardless of name. |
| **Identical contents, renamed file** | Detected by hash. Warn as a duplicate, showing both names: *"Identical to `Sept1-15.xlsx` uploaded on 3 September (uploaded here as `sept_final_v2.xlsx`)."* Surfacing the rename is useful — it usually means someone is unsure whether the first import worked. |

**Do not use the hash as a uniqueness constraint.** Multiple batch rows may legitimately share a hash across time. Index it for lookup; do not make it unique.

---

## 8. Raw Source vs Normalized Daily Record

This is the most important separation in the design, and the reason most of the architecture can be built before the sample arrives.

```
  Excel file
      │
      ▼
  ┌──────────────────────┐   RAW LAYER — shape unknown until the sample arrives
  │ AttendanceImportRow  │   • one row per source row, verbatim
  │ (staging)            │   • raw cell values retained
  └──────────┬───────────┘   • raw-level dedup: identical source rows in one file
             │
             ▼  ◄── NORMALIZATION (the only part that must wait)
  ┌──────────────────────┐   NORMALIZED LAYER — shape already known today
  │ Normalized daily     │   • employeeId + date + timeIn + timeOut + status
  │ candidate            │   • one candidate per employee-day
  └──────────┬───────────┘   • daily-level dedup: against existing AttendanceRecord
             │
             ▼
  ┌──────────────────────┐
  │ AttendanceRecord     │   ← unique(employeeId, date) already enforced
  └──────────────────────┘
```

### Raw source deduplication

Operates on source rows **within a single file**, before any interpretation. Two source rows are raw-duplicates when their normalized cell payloads are byte-identical. This is computable **without knowing what the columns mean** — hash the row's cell values.

If the export turns out to be **format B (multiple punch rows per employee-day)**, this layer is also where multiple punches per day legitimately coexist, and the raw-duplicate rule still holds: two *identical* punch rows are a duplicate, two *different* punch rows for the same day are not.

### Normalized daily deduplication

Operates on the employee-day candidate produced by normalization, compared against `AttendanceRecord`. This is where §6's classification runs. It is **format-independent** — it only needs `{employeeId, date, timeIn, timeOut, status, …}`, which is what `AttendanceRecord` already is.

### Why this separation is what unblocks you

The normalization step is the *only* format-dependent component. If you define it as a single interface —

```ts
// conceptual, not code to write yet
interface AttendanceNormalizer {
  normalize(rows: RawStagingRow[]): NormalizedDailyCandidate[];
}
```

— then the entire batch/staging/classification/conflict/transaction/audit architecture sits above it and can be built, reviewed and tested now against a **fixture normalizer**. When the Mustard sample arrives you implement one class and the rest does not move.

### Format A vs Format B — what changes

| | A: one daily row per employee | B: multiple punch rows per employee-day |
|---|---|---|
| Raw layer | 1 raw row → 1 candidate | N raw rows → 1 candidate |
| Normalization | Mostly field mapping | Requires punch pairing — **DO NOT INVENT** |
| Extra risk | Low | A partial day (odd punch count) must be representable |
| Everything above | **Identical** | **Identical** |

If the export is format B, the raw staging table becomes genuinely valuable rather than merely convenient: it is the only place the original punches survive, and you will want them when a pairing rule is later corrected.

---

## 9. Record-Level Conflict Strategy

### Is `employeeId + attendanceDate` sufficient?

**Yes — for the normalized daily record, and it already exists** (`@@unique([employeeId, date])`).

Two cautions:

1. **Date normalization must be exact.** The column is `@db.Date`, but application code constructs `new Date(...)` values that carry a time component and a timezone. Every comparison and write must normalize to a date-only value in a single agreed timezone (Philippine local, `Asia/Manila`) *before* touching the database. A one-hour drift silently creates a second row for "the same day" — and the unique constraint will not stop it, because the two values genuinely differ. See finding **SW-11** in §24.
2. **It is sufficient only if the destination stays one-row-per-day.** If Hospicio later wants split shifts stored as two attendance rows per day, this key must change. **CLIENT POLICY REQUIRED** — but the current model, tally and reports all assume one row per employee-day, so treat one-row-per-day as the contract until told otherwise.

### The four cases

| Case | Condition | Classification | Action |
|---|---|---|---|
| **A** | No existing record | `NEW` | Insert. Set provenance to the batch. |
| **B** | Exists, all compared fields identical | `EXACT_DUPLICATE` | **Skip.** No write, no `updatedAt` bump. Count it. |
| **C** | Exists, differs on a non-null field | `CONFLICT` / `CONFLICT_MANUAL` | **No write.** Stage the decision; apply only what HR chose. |
| **D** | Exists, was manually corrected | `CONFLICT_MANUAL` (if values differ) | Default **Keep Existing**; require an explicit override with a reason. |

**Case B must not write.** A no-op `update` still bumps `updatedAt`, which pollutes the audit trail and makes "when did this record last really change" unanswerable. Comparing first and skipping is what makes re-import genuinely idempotent.

### Which fields participate in comparison

Compare only the fields the import is authoritative for: `timeIn`, `timeOut`, `status`, and `hoursWorked` / `overtimeHours` *if* the export carries them. **Exclude `remarks`** — it is HR's free-text field, and an import must never overwrite it.

**CLIENT POLICY REQUIRED**: whether the export is authoritative for `status` at all, or whether HRISense derives status from times. Until answered, treat `status` as import-supplied and compare it.

---

## 10. Manual Correction Protection

This is the requirement with no current foundation, and it must be solved before import ships.

### Why the audit log is not enough

You could, in principle, ask *"is there an `UPDATE_ATTENDANCE` audit entry for this record id?"* Reject this approach:

- It is a **query across a growing, unindexed-for-this-purpose table** on every conflicting row — a per-row lookup into `AuditLog` filtered by `entityId`, for potentially thousands of rows per import.
- It is **semantically fragile**: audit entries can be pruned, and the action string is a convention, not a constraint.
- Today's audit entry does not even record `oldValue`, so it cannot tell you *what* was corrected.

Audit is the right place to record *that a decision happened*. It is the wrong place to *derive current state from*.

### Recommended: explicit provenance columns on `AttendanceRecord`

Three nullable additions, plus one integer:

| Field | Type | Purpose |
|---|---|---|
| `sourceType` | enum `IMPORT \| MANUAL \| SYSTEM` (default `IMPORT`) | What last wrote this record |
| `lastImportBatchId` | `String?` → `AttendanceImportBatch` | Which batch last wrote it; null if never imported |
| `manuallyModifiedAt` | `DateTime?` | Set by `AttendanceService.update`; null means never hand-edited |
| `manuallyModifiedById` | `String?` → `User` | Who corrected it |
| `recordVersion` | `Int @default(0)` | Incremented on every write; used for optimistic concurrency (§15) |

**Detection rule** is then a pure field read, no extra query:

```
isManuallyProtected = record.manuallyModifiedAt !== null
```

A conflicting row against such a record classifies as `CONFLICT_MANUAL`.

### Additional rules

- `AttendanceService.update` must set `sourceType = MANUAL`, `manuallyModifiedAt = now()`, `manuallyModifiedById = actor`, and increment `recordVersion` — **and capture `oldValue` in the audit log**, which it does not do today.
- An import applying an HR-approved replacement over a manual correction sets `sourceType = IMPORT` and **clears** `manuallyModifiedAt` — HR has explicitly consented, so the protection resets rather than persisting forever.
- **CLIENT POLICY REQUIRED**: should a manual correction be permanently sticky (every future import always asks), or should approving one replacement clear the flag? My recommendation is *clear on explicit approval* — otherwise the same row nags on every monthly import forever, and HR learns to click through the warning, which defeats it.

### Why not a generic `recordVersion`-only approach

`recordVersion` alone tells you *that* a record changed, not *who* changed it. You specifically need "a human deliberately corrected this", which is a different question from "this row has been written twice". Keep both: `manuallyModifiedAt` for intent, `recordVersion` for concurrency.

---

## 11. Import Batch / Staging Design

**Do we need a batch model? YES.** **Do we need staging? YES.**

Staging is not optional here, for a concrete reason: HR review happens **between HTTP requests**. Preview and Confirm are separate calls, possibly minutes apart, possibly across a server restart. In-memory classification cannot survive that, and re-parsing on confirm reintroduces the race the design exists to prevent (the underlying `AttendanceRecord` rows may have changed between preview and confirm).

Staging also buys three things:

1. **Resumability** after a partial apply (§18).
2. **Explainability** — HR can ask "what did that September import actually do?" months later.
3. **A place to record the per-row HR decision** before it is executed.

### Retention

- **Batch rows: retain indefinitely.** They are small and they are the audit spine.
- **Staging rows: retain, but with a documented pruning policy.** A month of attendance for 200 staff is ~6,000 rows per batch. **CLIENT POLICY REQUIRED**: how long. A reasonable default is *retain for the current and previous fiscal year, then prune staging while keeping batch summaries forever*.

### Should the original Excel file be retained?

**Recommendation: retain, but deliberately, with a stated retention period.**

Arguments to retain: it is the only way to re-run a corrected normalizer over historical data — which is likely, since the pairing rules are unknown today and may be refined after the first real imports. Without the file, an early mis-parse is unrecoverable.

Arguments against: it is personal data (attendance is employee behaviour), it accumulates, and it duplicates information already normalized into the database.

**Resolution**: store the file under the existing protected-upload pattern (random stored filename, streamed only through an authenticated, FULL-only route — never a static path), record `originalFilename` separately for display, and set an explicit retention period. **CLIENT POLICY REQUIRED**: the period. If Hospicio prefers not to retain files at all, keep the hash and metadata only and accept that re-parsing is impossible — that is a legitimate choice, but it must be a choice, not an accident.

---

## 12. Proposed Data Model

**Conceptual only. No migration authored. No schema file touched.**

### `AttendanceImportBatch`

| Purpose | One row per uploaded file; the unit of HR review, apply, and audit. |
|---|---|

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `fileHash` | `String` | SHA-256 hex. **Indexed, not unique** (§7) |
| `originalFilename` | `String` | Display only |
| `storedFilename` | `String? @unique` | Null if file retention is disabled |
| `fileSizeBytes` | `Int` | |
| `uploadedByUserId` | `String` → `User` | |
| `uploadedAt` | `DateTime @default(now())` | |
| `status` | enum `AttendanceImportStatus` | §5 |
| `detectedPeriodStart` | `DateTime? @db.Date` | Derived after parse |
| `detectedPeriodEnd` | `DateTime? @db.Date` | Derived after parse |
| `totalSourceRows` | `Int @default(0)` | |
| `countNew` / `countExactDuplicate` / `countEnrichment` / `countConflict` / `countConflictManual` / `countDuplicateInFile` / `countUnknownEmployee` / `countInvalid` | `Int @default(0)` | Materialised at `VALIDATED` |
| `countApplied` / `countSkipped` / `countFailed` | `Int @default(0)` | Materialised during apply |
| `confirmedByUserId` | `String?` → `User` | |
| `confirmedAt` | `DateTime?` | |
| `completedAt` | `DateTime?` | |
| `failureReason` | `String? @db.Text` | |
| `normalizerVersion` | `String?` | **Important**: which parser version produced this. Lets you find batches that need re-parsing after a rule correction. |

Indexes: `[status]`, `[uploadedAt]`, `[fileHash]`, `[detectedPeriodStart, detectedPeriodEnd]`.

### `AttendanceImportRow`

| Purpose | One row per **source** row — the raw layer (§8). |
|---|---|

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(uuid())` | |
| `batchId` | `String` → `AttendanceImportBatch` | Cascade delete with batch |
| `sourceRowNumber` | `Int` | 1-based, for "row 47 is invalid" messages |
| `sourceSheetName` | `String?` | |
| `rawPayload` | `Json` | The verbatim cell values. **Shape unknown until the sample.** |
| `rawRowHash` | `String` | Hash of `rawPayload` — raw-level dedup within the batch |
| `resolvedEmployeeId` | `String?` → `Employee` | Null when `UNKNOWN_EMPLOYEE` |
| `resolvedDate` | `DateTime? @db.Date` | |
| `normalizedTimeIn` / `normalizedTimeOut` | `DateTime?` | |
| `normalizedStatus` | `AttendanceStatus?` | |
| `classification` | enum `AttendanceImportRowClass` | §6 |
| `classificationReason` | `String?` | Human-readable; populated for INVALID / UNKNOWN_EMPLOYEE |
| `existingRecordId` | `String?` → `AttendanceRecord` | The row it conflicts with |
| `existingSnapshot` | `Json?` | Values at classification time — used to detect drift at apply (§15) |
| `hrDecision` | enum `PENDING \| KEEP_EXISTING \| USE_UPLOADED \| SKIP` | Default `PENDING` for conflicts |
| `hrDecisionByUserId` / `hrDecisionAt` / `hrDecisionReason` | | |
| `appliedAt` | `DateTime?` | |
| `applyError` | `String? @db.Text` | |

Indexes: `[batchId, classification]`, `[batchId, sourceRowNumber]`, `[resolvedEmployeeId, resolvedDate]`, `[batchId, rawRowHash]`.

**Unique**: `@@unique([batchId, sourceRowNumber])` — protects against a re-run of parsing double-inserting staging rows.

### Additions to `AttendanceRecord`

As in §10: `sourceType`, `lastImportBatchId`, `manuallyModifiedAt`, `manuallyModifiedById`, `recordVersion`. **All nullable / defaulted**, so the migration is additive and existing rows remain valid (they become `sourceType = IMPORT`-defaulted with null manual markers, which is the correct interpretation of "we don't know").

### New enums

`AttendanceImportStatus` · `AttendanceImportRowClass` · `AttendanceRecordSource` · `AttendanceImportDecision`.

---

## 13. Conflict Resolution UX

Your proposed flow is right. Refined:

```
  Upload  →  Validating…  →  Review  →  Resolve conflicts  →  Confirm  →  Result
```

### Screen 1 — Review summary

A single card per class, in severity order, with counts that add up to `totalSourceRows`:

| | Count | Action |
|---|---|---|
| **New records** | 412 | Will be added |
| **Already imported** | 138 | Will be skipped — no change |
| **More complete than existing** | 6 | *(policy-dependent — see §6)* |
| **Conflicts** | 9 | **Needs your decision** |
| **Conflicts with your corrections** | 2 | **Needs your decision** |
| **Repeated rows in this file** | 3 | Only the first will be used |
| **Employee not found** | 4 | Cannot be imported |
| **Invalid rows** | 1 | Cannot be imported |

Plus a header line: filename, uploader, detected period, and — if the hash matched an earlier batch — the duplicate-file warning from §7.

**Confirm must be disabled while any conflict is `PENDING`.** The button's disabled reason must be stated inline, not only in a tooltip: *"9 conflicts still need a decision."*

### Screen 2 — Conflict resolution

Per conflict, a three-column row: **Employee / Date**, **Currently in HRISense**, **In this file**. Differing fields highlighted; identical fields muted so the eye goes to the difference.

```
  HSJ-0016  ·  5 September 2026
  ┌────────────────────────────┬────────────────────────────┐
  │ Currently in HRISense      │ In this file               │
  │ Time In    8:01 AM         │ Time In    8:17 AM   ◄ differs
  │ Time Out   5:03 PM         │ Time Out   5:03 PM         │
  │ Status     Present         │ Status     Late      ◄ differs
  └────────────────────────────┴────────────────────────────┘
   ( • ) Keep existing        (   ) Use uploaded
```

For `CONFLICT_MANUAL`, add a banner above the row: *"You corrected this record on 4 September. Replacing it will discard that correction."* — and require a reason when choosing **Use uploaded**.

### Per-row vs bulk

**Both, with different defaults.**

- **Per-row** is the primitive and always available.
- **Bulk** is offered per *group*: "Keep existing for all 9 conflicts" / "Use uploaded for all 9 conflicts".
- **`CONFLICT_MANUAL` is excluded from bulk actions.** Those two rows must be decided individually. This is the one place where friction is the feature — bulk-overwriting hand corrections is exactly the failure this design exists to prevent.

### Safe defaults

| Class | Default |
|---|---|
| `NEW` | Apply |
| `EXACT_DUPLICATE` | Skip |
| `CONFLICT` | **`PENDING`** — no default, blocks confirm |
| `CONFLICT_MANUAL` | **`KEEP_EXISTING`**, overridable with a reason |
| `ENRICHMENT` | Policy-dependent (§6) |
| `DUPLICATE_IN_FILE` | First occurrence applies, rest skip |
| `UNKNOWN_EMPLOYEE` / `INVALID` | Cannot apply |

### Screen 3 — Result

What was applied, what was skipped, what failed, with a link to the batch in Import History. If anything failed, the batch stays `PARTIALLY_APPLIED` with a **Resume** action.

---

## 14. Transaction Strategy

**Chunked transactions, with partial success allowed and explicit resumability.**

| Option | Verdict |
|---|---|
| One giant transaction | **No.** A month for 200 staff is ~6,000 writes. A single transaction of that size holds locks for a long time, risks MySQL lock-wait timeouts against concurrent attendance reads, and an error at row 5,999 discards 5,998 correct writes. |
| Row-by-row, no transaction | **No.** No atomicity at all; a crash leaves the batch in an unknowable state. |
| **Chunked** (recommended) | ~200–500 rows per `$transaction`. Each chunk is atomic. Progress is durable between chunks. |

### Per-chunk shape

Inside each transaction, for each row:

1. Re-read the existing `AttendanceRecord` for `(employeeId, date)`.
2. **Compare against `existingSnapshot`** captured at classification. If it drifted, mark the row `applyError = 'Record changed since preview'` and skip it — do not apply a decision made against stale data.
3. Apply the decision: insert (`NEW`), update (`USE_UPLOADED`), or no-op (`SKIP` / `KEEP_EXISTING`).
4. Set provenance: `sourceType`, `lastImportBatchId`, increment `recordVersion`.
5. Stamp `appliedAt` on the staging row.

Steps 2–5 in one transaction means a staging row is never marked applied unless its write committed.

### Batch status after a partial failure

- All chunks committed → `COMPLETED`
- Some committed, some failed → `PARTIALLY_APPLIED`, with per-row `applyError`
- Nothing committed → `FAILED`

**Resume re-runs only rows where `appliedAt IS NULL` and the decision is actionable.** Because each row's outcome is recorded individually, resume is naturally idempotent — already-applied rows are skipped by the query, not by a guess.

---

## 15. Concurrency / Race Condition Strategy

Your scenario: Officer A uploads Sept 1–30 while Officer B uploads Sept 15–30.

### Layered defence — all four layers, not one

**Layer 1 — the existing unique constraint.** `@@unique([employeeId, date])` means two simultaneous inserts for the same employee-day cannot both succeed. One gets a `P2002`. This is the backstop that guarantees correctness even if every higher layer is bypassed. Handle `P2002` inside chunk processing by converting that row to a re-comparison rather than failing the chunk.

**Layer 2 — batch state as a mutex.** The transition `VALIDATED → APPLYING` must be a **conditional update**:

```
UPDATE attendance_import_batches
   SET status = 'APPLYING'
 WHERE id = ? AND status = 'VALIDATED'
```

Check affected-rows = 1. If 0, another request already started the apply — return "this import is already being applied". This alone kills the double-click case and the network-retry case.

**Layer 3 — snapshot comparison at apply time.** §14 step 2. This is what actually handles A-vs-B: if B's import applies first, A's rows for the overlapping range no longer match their `existingSnapshot`, so A does not blindly overwrite B's work — those rows are reported as changed-since-preview and A can re-validate.

**Layer 4 — an advisory period lock (recommended, optional).** A short-lived lock keyed on overlapping `[detectedPeriodStart, detectedPeriodEnd]` that prevents two batches from being in `APPLYING` for overlapping ranges simultaneously. This turns a confusing partial interleave into a clean *"another import covering 15–30 September is currently being applied; try again in a moment"*.

### What I would not rely on

- **Transaction isolation alone.** MySQL's default `REPEATABLE READ` does not prevent the check-then-act pattern used here, and raising the isolation level would hurt concurrent attendance reads for no real gain.
- **Row locking (`SELECT … FOR UPDATE`) as the primary mechanism.** Holding row locks across an HR review that spans minutes is not viable. Snapshot comparison is the correct pattern for long-lived optimistic workflows.

---

## 16. Audit Trail

Use the existing `AuditLog`. It has the fields needed (§2). Recommended action strings and payloads:

| Event | Action | `entityType` / `entityId` | Payload |
|---|---|---|---|
| File uploaded | `ATTENDANCE_IMPORT_UPLOADED` | `AttendanceImportBatch` / batch id | `originalFilename`, `fileHash`, `fileSizeBytes`, `duplicateOfBatchId?` |
| Validation completed | `ATTENDANCE_IMPORT_VALIDATED` | same | all class counts, detected period, `normalizerVersion` |
| Import confirmed | `ATTENDANCE_IMPORT_CONFIRMED` | same | counts by decision, `confirmedByUserId` |
| Import completed | `ATTENDANCE_IMPORT_COMPLETED` | same | `countApplied`, `countSkipped`, `countFailed` |
| Duplicate skipped | *(no per-row entry)* | — | Counted on the batch. **Do not write 138 audit rows for skips** — it buries the entries that matter. |
| Conflict — keep existing | `ATTENDANCE_CONFLICT_KEPT` | `AttendanceRecord` / record id | `batchId`, `sourceRowNumber`, `uploadedValues` |
| Conflict — replace | `ATTENDANCE_CONFLICT_REPLACED` | `AttendanceRecord` / record id | `batchId`, **`oldValue`**, **`newValue`**, `hrDecisionReason` |
| Manual correction | `UPDATE_ATTENDANCE` *(existing)* | `AttendanceRecord` / record id | **must add `oldValue`** — currently missing |
| Import failed | `ATTENDANCE_IMPORT_FAILED` | batch | `failureReason`, `countApplied` at failure |
| Import cancelled | `ATTENDANCE_IMPORT_CANCELLED` | batch | `cancelledByUserId` |

**Do not log file contents.** Log the hash, the filename, row *numbers* and per-record before/after values for the specific records HR decided on. Never write the raw payload of the whole sheet into `AuditLog` — that duplicates personal data into a table with different retention and a FULL-tier-wide read surface.

---

## 17. Idempotency Guarantee

> *Uploading the same attendance data once, twice, or ten times results in the same final `AttendanceRecord` state, unless HR explicitly approves a conflicting replacement.*

The architecture guarantees this through four mechanisms, each covering what the others cannot:

| # | Mechanism | What it guarantees |
|---|---|---|
| 1 | **Compare-then-act, never `upsert`** | Identical data produces `EXACT_DUPLICATE` → **no write at all**. Not a no-op write — no write. `updatedAt` is untouched, so even the metadata is unchanged. |
| 2 | **Conflicts default to `PENDING` and block confirm** | Differing data can never be applied without a human decision. There is no code path from "file uploaded" to "record overwritten" that does not pass through an HR click. |
| 3 | **Batch state machine with conditional transitions** | The same batch cannot be applied twice. `VALIDATED → APPLYING` succeeds for exactly one caller (§15 layer 2). |
| 4 | **Per-row `appliedAt` + `existingSnapshot`** | Resume after partial failure re-applies only unapplied rows, and only if the target has not drifted. |

**The formal statement**: for any file F and any existing state S, `apply(F, S) = S'` where `S' = S` for every employee-day whose values in F equal those in S. Since `EXACT_DUPLICATE` performs no write, `apply(F, S') = S'`. The operation is idempotent by construction, not by retry-detection.

**The one deliberate exception** is `ENRICHMENT` if Hospicio chooses auto-apply: the first import fills a null, the second is then an exact duplicate. Still convergent — it reaches a fixed point after one application — but it is not a no-op on the first re-import. Worth stating explicitly when the policy is decided.

---

## 18. Failure & Recovery

| Case | Behaviour |
|---|---|
| Employee not found | `UNKNOWN_EMPLOYEE`. Row reported with its source identifier. Never guess a match. |
| Duplicate employee mapping (one identifier → 2 employees) | `INVALID` with reason. **Never pick one.** Almost certainly a data problem in HRISense (see **SW-08**). |
| Invalid date | `INVALID`, row number reported |
| Invalid time | `INVALID`, or null time if the export legitimately omits it — **CLIENT POLICY REQUIRED**, cannot be decided without the sample |
| Missing required source value | `INVALID`. Which fields are required is **CLIENT POLICY REQUIRED**. |
| Future date | Flag as `INVALID` by default. **CLIENT POLICY REQUIRED** — a scheduled future record may be legitimate. |
| Archived employee (`deletedAt` set) | `UNKNOWN_EMPLOYEE` by default. **CLIENT POLICY REQUIRED**: a file covering a period *before* separation is legitimate and arguably should import. |
| Resigned/terminated (`employmentState`) | Same as above — period-relative, **CLIENT POLICY REQUIRED** |
| Date before hire date | Flag as `INVALID` and report. Genuine cases exist (pre-employment training). **CLIENT POLICY REQUIRED** |
| File contains only duplicates | Valid outcome. Report *"Nothing to import — all 138 rows are already in HRISense."* Not an error. |
| File contains only conflicts | Valid. Every row needs a decision; confirm stays blocked until resolved. |
| Validated but never confirmed | Batch sits at `VALIDATED` indefinitely. Nothing written. Consider an auto-cancel after N days — **CLIENT POLICY REQUIRED**. |
| Import cancelled | `CANCELLED`. Staging retained. Nothing written. |
| **Server crashes mid-apply** | Batch is stuck at `APPLYING`. On startup, any batch in `APPLYING` with no active worker is moved to `PARTIALLY_APPLIED`. Because `appliedAt` is per-row, exactly which rows committed is known. Resume is safe. |
| Two overlapping imports | §15 |
| Existing record manually edited | §10 |
| Re-run after partial failure | Resume processes only `appliedAt IS NULL` rows |

---

## 19. What Can Be Built Before the Mustard Sample

All of this is format-independent:

1. `AttendanceImportBatch` + `AttendanceImportRow` models and enums
2. `AttendanceRecord` provenance columns (§10)
3. File upload, SHA-256 hashing, duplicate-file detection and warning
4. Batch state machine with conditional transitions
5. The **classification engine** — it consumes `NormalizedDailyCandidate`, not Excel
6. Conflict comparison, `existingSnapshot`, drift detection
7. Manual-correction detection and protection
8. Chunked transactional apply, resume, crash recovery
9. Import History page
10. The full conflict-resolution UX
11. Complete audit wiring
12. **A fixture normalizer** producing synthetic candidates — which makes items 5–11 fully testable today

Estimated coverage: **~85% of the work**.

## 20. What Must Wait for the Mustard Sample

Only the normalizer, and the decisions that only the file can answer:

1. Column → field mapping
2. Sheet selection / multi-sheet handling
3. Employee identifier format and its resolution rule
4. Whether the export is format A or B (§8)
5. If B: **punch pairing rules** — the single riskiest unknown
6. Time parsing, including how midnight and overnight shifts are represented
7. Whether the export supplies `status`, or HRISense derives it
8. Lateness / half-day / night-differential-hours representation
9. Absence representation, if any

**None of these may be guessed.** A wrong pairing rule produces confidently-wrong attendance, which is worse than no import — it is exactly the failure mode the current disabled placeholder exists to prevent.

---

## 21. Recommended Implementation Order

| Phase | Work | Depends on sample |
|---|---|---|
| **0** | Fix blocking prerequisites: audit `oldValue` on manual correction; validate `PUT /attendance/:id`; **fix SW-01 and SW-02** (§24) | No |
| **1** | Schema additions (authored against `hrisense_migration_dev_db`, `--create-only`, reviewed before deploy) | No |
| **2** | Upload + hash + batch creation + Import History (read-only) | No |
| **3** | Staging models + fixture normalizer + classification engine | No |
| **4** | Conflict UX + decision persistence | No |
| **5** | Chunked apply + resume + crash recovery + audit | No |
| **6** | Concurrency layers (§15) | No |
| **7** | **Real normalizer** | **Yes** |
| **8** | End-to-end validation against the real file, in a copy of the database | **Yes** |

Phases 0–6 can proceed now. Phase 7 is a single class behind an interface.

---

## 22. Risks / Tradeoffs

| Risk | Assessment |
|---|---|
| **Staging storage growth** | ~6,000 rows/month. Trivial for MySQL. Mitigated by a pruning policy. |
| **Two-step flow is slower than one-click** | Deliberate. The alternative is silent overwriting of HR's corrections. Bulk actions keep the common path to ~2 clicks. |
| **Snapshot drift rejects rows** | Correct behaviour, but must be *explained* well in the UI or HR will read it as a bug. |
| **`existingSnapshot` duplicates data** | Accepted. It is the mechanism that makes long-lived optimistic review safe. |
| **Retaining source files** | Personal data at rest. Mitigated by protected streaming + retention policy. **CLIENT POLICY REQUIRED**. |
| **Complexity added before the format is known** | Real, but the format only affects the normalizer. The alternative — waiting — leaves ~85% of the work unstarted for an unbounded period. |
| **Provenance columns default existing rows to `IMPORT`** | Slightly wrong for any historically hand-entered row, but they have `manuallyModifiedAt = null`, so they get *less* protection than they deserve. Acceptable: current attendance volume is low. Worth a one-time note. |

---

## 23. Final Recommended Architecture Diagram

```
 HR uploads .xlsx
        │
        ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 1. RECEIVE                                                    │
 │    stream to protected storage · SHA-256 · create batch       │
 │    hash match? → WARN (never block)          status=UPLOADED  │
 └───────────────────────────┬───────────────────────────────────┘
                             ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 2. PARSE → RAW STAGING                        status=PARSING  │
 │    one AttendanceImportRow per source row · rawRowHash        │
 │    raw dedup within batch → DUPLICATE_IN_FILE                 │
 └───────────────────────────┬───────────────────────────────────┘
                             ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 3. NORMALIZE   ◄── THE ONLY FORMAT-DEPENDENT STEP             │
 │    AttendanceNormalizer: raw rows → daily candidates          │
 │    (waits for the Mustard sample; fixture normalizer today)   │
 └───────────────────────────┬───────────────────────────────────┘
                             ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 4. CLASSIFY vs existing AttendanceRecord    status=VALIDATED  │
 │    NEW · EXACT_DUPLICATE · ENRICHMENT · CONFLICT ·            │
 │    CONFLICT_MANUAL · DUPLICATE_IN_FILE ·                      │
 │    UNKNOWN_EMPLOYEE · INVALID                                 │
 │    capture existingSnapshot per conflicting row               │
 │            ══ NOTHING WRITTEN TO ATTENDANCE YET ══            │
 └───────────────────────────┬───────────────────────────────────┘
                             ▼
 ┌───────────────────────────────────────────────────────────────┐
 │ 5. HR REVIEW                                                  │
 │    summary counts · conflict list (existing vs uploaded)      │
 │    per-row + bulk decisions · CONFLICT_MANUAL excluded from   │
 │    bulk · Confirm disabled while any conflict is PENDING      │
 └───────────────────────────┬───────────────────────────────────┘
                             ▼  conditional UPDATE … WHERE status='VALIDATED'
 ┌───────────────────────────────────────────────────────────────┐
 │ 6. APPLY (chunked)                            status=APPLYING │
 │    per chunk tx: re-read → snapshot drift check → write       │
 │    → set sourceType/lastImportBatchId/recordVersion           │
 │    → stamp appliedAt        P2002 → re-compare, never fail    │
 └───────────────────────────┬───────────────────────────────────┘
                             ▼
              COMPLETED · PARTIALLY_APPLIED (resumable) · FAILED
                             │
                             ▼
                   Import History + AuditLog
```

---

## 24. Additional System-Wide Logic & Data Integrity Review

Every finding below was read from current source. Where I could not confirm a problem, I have said so rather than speculating.

---

### SW-01 · Weekly schedule insert creates overlapping effective ranges

| | |
|---|---|
| **MODULE** | Work Schedule |
| **SCENARIO** | HR sets a schedule effective 1 Oct. Later, HR sets one effective 15 Sep (i.e. *before* an existing future schedule). |
| **CURRENT BEHAVIOR** | `weekly-schedule.service.ts:203` computes `const newEffectiveTo = nextSchedule ? nextSchedule.effectiveFrom : null;` — and **never uses it**. Verified: `newEffectiveTo` appears exactly once in the file, its own declaration. The `create` call hardcodes `effectiveTo: null`. |
| **WHY IT MAY BE A PROBLEM** | The new schedule is open-ended while the later schedule still exists. Any query of the form `effectiveFrom <= date AND (effectiveTo IS NULL OR effectiveTo > date)` now matches **two schedules** for dates after 1 Oct. Reads happen to survive because lookups use `findFirst` with `orderBy: { effectiveFrom: 'desc' }`, but the timeline is genuinely ambiguous, and any `findMany` or differently-ordered query returns two "active" schedules for one employee-day. This is precisely the "two active schedules covering the same employee/date" case. |
| **SEVERITY** | **HIGH** |
| **CLASSIFICATION** | CONFIRMED LOGIC BUG |
| **SOURCE FILES** | `apps/api/src/services/weekly-schedule.service.ts` |
| **EXACT FUNCTION** | `WeeklyScheduleService.saveEmployeeWeeklySchedule`, line 203 + the `create` block |
| **RECOMMENDED APPROACH** | Use the computed value: `effectiveTo: newEffectiveTo`. Then add `@@unique([employeeId, effectiveFrom])` and an index on `[employeeId, effectiveFrom, effectiveTo]`. Consider a one-off audit query for employees with more than one open-ended schedule. |
| **SCHEMA CHANGE LIKELY?** | YES (constraint + index; the bug fix itself is code-only) |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | **YES** — attendance interpretation depends on resolving one schedule per employee-day. |

---

### SW-02 · Leave approval is check-then-act outside its transaction

| | |
|---|---|
| **MODULE** | Leave |
| **SCENARIO** | HR double-clicks Approve, or a client retries the request after a timeout where the server actually succeeded. |
| **CURRENT BEHAVIOR** | `leave.service.ts` `approve()` does `findUnique` → status guard → **then** opens `$transaction` and calls `leaveRequest.update({ where: { id } })` with no status precondition, followed by `leaveBalance.update({ data: { used: { increment: totalDays } } })`. |
| **WHY IT MAY BE A PROBLEM** | Two concurrent calls both read `PENDING`, both pass the guard, both enter their transactions, both set status to `APPROVED` (harmless), and **both increment `used`**. The employee is charged twice for one leave request. The status guard provides no protection because it is outside the write. |
| **SEVERITY** | **HIGH** |
| **CLASSIFICATION** | CONCURRENCY RISK |
| **SOURCE FILES** | `apps/api/src/services/leave.service.ts` |
| **EXACT FUNCTION** | `LeaveService.approve` (and by inspection the same shape in `reject`, `endorse`, `cancel`) |
| **RECOMMENDED APPROACH** | Move the guard into the write: inside the transaction, `updateMany({ where: { id, status: { in: ['PENDING','FOR_REVIEW'] } }, data: {…} })`, assert `count === 1`, and only then touch the balance. Throw/rollback when 0. |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | NO (independent), but it is the highest-value non-attendance fix in this list. |

---

### SW-03 · Leave balance `pending` uses non-atomic read-modify-write

| | |
|---|---|
| **MODULE** | Leave |
| **SCENARIO** | Two leave decisions for the same employee/year/type commit concurrently. |
| **CURRENT BEHAVIOR** | In the same statement: `used: { increment: leave.totalDays }` (atomic, database-side) but `pending: Math.max(0, balance.pending - leave.totalDays)` (computed in Node from a value read earlier in the transaction). |
| **WHY IT MAY BE A PROBLEM** | Two transactions can read the same `pending` and both write the same computed result — one decrement is lost. The `Math.max(0, …)` clamp then hides the drift, so `pending` silently diverges from reality with no error. The inconsistency between the two fields *in one statement* also makes the intent ambiguous to a future reader. |
| **SEVERITY** | **MEDIUM** |
| **CLASSIFICATION** | CONCURRENCY RISK |
| **SOURCE FILES** | `apps/api/src/services/leave.service.ts` |
| **EXACT FUNCTION** | `LeaveService.approve` (balance update block) |
| **RECOMMENDED APPROACH** | Use `pending: { decrement: leave.totalDays }` and enforce non-negativity with a check constraint or a guarded `updateMany … WHERE pending >= totalDays`. If the clamp is genuinely needed, that indicates a reservation bug worth finding rather than clamping. |
| **SCHEMA CHANGE LIKELY?** | NO (unless a check constraint is added) |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | NO |

---

### SW-04 · Training completion writes a compliance record outside any transaction

| | |
|---|---|
| **MODULE** | Training ↔ Compliance |
| **SCENARIO** | HR marks a participant `COMPLETED` on an activity linked to a compliance requirement. |
| **CURRENT BEHAVIOR** | `training.service.ts:517` calls `prisma.employeeComplianceRecord.create(...)` **outside any transaction**, then separately `prisma.trainingParticipant.update(...)` to store the resulting `complianceRecordId`. The duplicate guard is `if (!complianceRecordId)` — read from the participant row. |
| **WHY IT MAY BE A PROBLEM** | Two failure modes. (a) If the participant update fails or the process dies between the two writes, an **orphan compliance record** exists — the employee is marked compliant, with `reviewStatus: ACCEPTED`, and nothing links it back. (b) Because the orphan was never linked, a **retry creates a second compliance record**, since `participant.complianceRecordId` is still null. Both records then satisfy the same requirement. |
| **SEVERITY** | **HIGH** |
| **CLASSIFICATION** | DATA-INTEGRITY RISK / DUPLICATION RISK |
| **SOURCE FILES** | `apps/api/src/services/training.service.ts` |
| **EXACT FUNCTION** | participation-status update path, ~lines 500–560 |
| **RECOMMENDED APPROACH** | Wrap both writes in one `prisma.$transaction`. Separately, add `@@unique([employeeId, requirementId, completedAt])` or an equivalent guard so auto-generated compliance records cannot duplicate. Note the same file already uses `$transaction` correctly at line ~640, so the pattern is established. |
| **SCHEMA CHANGE LIKELY?** | YES (unique constraint), NO for the transaction fix |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | NO |

---

### SW-05 · AI fact sheet counts attendance for archived employees; Reports and Tally do not

| | |
|---|---|
| **MODULE** | AI Assistance ↔ Reports ↔ Attendance |
| **SCENARIO** | HR compares the attendance figures on AI Assistance with the Attendance report for the same period. |
| **CURRENT BEHAVIOR** | `workforce-facts.service.ts:124–135` queries `attendanceRecord.groupBy`, `.count` and `.findMany` filtered **only by date** — no employee scoping. By contrast `ReportService.attendance` filters employees through `employeeWhere()` = `{ deletedAt: null, employmentState: 'ACTIVE' }` (`report.service.ts:74`), and `AttendanceService.getTally` uses the identical filter. |
| **WHY IT MAY BE A PROBLEM** | Two problems. (1) **The two screens disagree** — AI totals include attendance belonging to archived/separated staff; Reports and Tally exclude it. (2) Worse, `daysWithNoImportedRecord` is computed as `expectedEmployeeDays − distinctAttendanceDays.length` where `expectedEmployeeDays = totalActive × periodDays` (active only) but `distinctAttendanceDays` spans **all** employees. This subtracts a wider population from a narrower one, **understating the ingestion gap**, and `Math.max(0, …)` can clamp it to zero — hiding a real gap entirely. This directly undermines the fact sheet's purpose as trustworthy grounding for the AI narrative. |
| **SEVERITY** | **MEDIUM–HIGH** |
| **CLASSIFICATION** | CONFIRMED LOGIC BUG |
| **SOURCE FILES** | `apps/api/src/services/ai/workforce-facts.service.ts` |
| **EXACT FUNCTION** | attendance block, lines 123–152 |
| **RECOMMENDED APPROACH** | Scope all three attendance queries with `employee: { deletedAt: null, employmentState: 'ACTIVE' }` so the minuend and subtrahend describe the same population. Then extract the active-employee filter into one shared helper used by Reports, Tally and the fact sheet, so they cannot drift again. |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | **YES** — the import will make `daysWithNoImportedRecord` an operationally important number, and it is currently computed wrongly. |

---

### SW-06 · `EmployeeWeeklySchedule` has no unique constraint and no indexes

| | |
|---|---|
| **MODULE** | Work Schedule |
| **SCENARIO** | Two concurrent saves for the same employee and effective date; or SW-01 recurring. |
| **CURRENT BEHAVIOR** | The model declares no `@@unique` and **no `@@index` at all** — verified by reading the model. Uniqueness of `(employeeId, effectiveFrom)` is enforced only by the application's `findFirst` + delete-and-recreate logic. |
| **WHY IT MAY BE A PROBLEM** | Nothing at the database prevents two schedules with the same `employeeId` + `effectiveFrom`. The check-then-act pattern in `saveEmployeeWeeklySchedule` (find `sameDateSchedule`, then delete, then create) is not atomic against a concurrent caller. Absent indexes also make every effective-date lookup a scan as the table grows. |
| **SEVERITY** | **MEDIUM** |
| **CLASSIFICATION** | DATA-INTEGRITY RISK / ARCHITECTURAL DEBT |
| **SOURCE FILES** | `apps/api/prisma/schema.prisma`, `apps/api/src/services/weekly-schedule.service.ts` |
| **EXACT MODEL** | `EmployeeWeeklySchedule` |
| **RECOMMENDED APPROACH** | Add `@@unique([employeeId, effectiveFrom])` and `@@index([employeeId, effectiveFrom, effectiveTo])`. Fix SW-01 at the same time — they are the same area. |
| **SCHEMA CHANGE LIKELY?** | YES |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | **YES** (with SW-01) |

---

### SW-07 · `EmployeeScheduleAssignment` has no overlap protection, and three scheduling models coexist

| | |
|---|---|
| **MODULE** | Work Schedule |
| **SCENARIO** | An employee is onboarded (which writes a `scheduleTemplateId` assignment) and later given a weekly schedule. Which is authoritative for a given date? |
| **CURRENT BEHAVIOR** | Three representations are live: `Employee.workSchedule` (enum, read by `AttendanceService.getSchedules`); `ScheduleTemplate` + `EmployeeScheduleAssignment` (written by onboarding via `ScheduleService.assignSchedule`); and `ShiftDefinition` + `EmployeeWeeklySchedule` (written by the profile editor). `EmployeeScheduleAssignment` has indexes but **no unique constraint and no overlap guard**. `AttendanceService.getSchedules` carries an explicit comment: *"Date-specific work schedule management is NOT implemented in this phase."* |
| **WHY IT MAY BE A PROBLEM** | Two sources of truth for "what days does this person work". Attendance interpretation, rest-day identification, and any future lateness derivation all depend on resolving exactly one schedule per employee-day. Today, which one wins depends on which service you ask. |
| **SEVERITY** | **MEDIUM** (today) → **HIGH** once import lands |
| **CLASSIFICATION** | ARCHITECTURAL DEBT |
| **SOURCE FILES** | `schema.prisma`, `attendance.service.ts:414`, `schedule.service.ts`, `weekly-schedule.service.ts`, `employee.controller.ts` (onboarding) |
| **RECOMMENDED APPROACH** | Declare `EmployeeWeeklySchedule` authoritative. Decide the fate of the legacy pair (backfill then retire, or freeze read-only). Requires a client decision on historical data. |
| **SCHEMA CHANGE LIKELY?** | YES (eventually) |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | **YES — at least the decision.** The import must know which schedule to consult. |

---

### SW-08 · No unique constraint on employee source identifiers used for import matching

| | |
|---|---|
| **MODULE** | Employees ↔ Attendance import |
| **SCENARIO** | The Mustard export identifies employees by some field. The importer must map it to exactly one employee. |
| **CURRENT BEHAVIOR** | `employeeNumber` is `@unique` ✓ and `workEmail` is `@unique` ✓. But if the export identifies staff by **name**, or by a **biometric/device id**, there is no such field on `Employee` and no uniqueness anywhere. |
| **WHY IT MAY BE A PROBLEM** | If matching must fall back to name, duplicates are near-certain in a 200-person organisation, and a wrong match writes one person's attendance onto another's record — silently, and hard to detect afterwards. |
| **SEVERITY** | **MEDIUM** (unknown until the sample) |
| **CLASSIFICATION** | DATA-INTEGRITY RISK / CLIENT POLICY REQUIRED |
| **SOURCE FILES** | `apps/api/prisma/schema.prisma` (`Employee`) |
| **RECOMMENDED APPROACH** | When the sample arrives, if the identifier is not `employeeNumber`, add a dedicated nullable-but-unique `biometricId` (or equivalent) and an HR mapping screen. **Never** match on name. Ambiguous matches must classify `INVALID`, never resolve to a guess. |
| **SCHEMA CHANGE LIKELY?** | LIKELY |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | **YES** (blocked on the sample) |

---

### SW-09 · Attendance manual correction records no `oldValue`

| | |
|---|---|
| **MODULE** | Attendance |
| **SCENARIO** | HR corrects a time-in, then someone later asks what it was before. |
| **CURRENT BEHAVIOR** | `attendance.controller.ts` `update` writes `createAuditLog({ action: 'UPDATE_ATTENDANCE', newValue: req.body })`. `AuditLog` **has** an `oldValue Json?` column; it is simply not populated here. The service reads the record before updating, so the prior values are in hand and discarded. |
| **WHY IT MAY BE A PROBLEM** | Corrections are unreconstructable. For an attendance system feeding compliance and (externally) payroll, "what did it say before HR changed it" is a question that will be asked. |
| **SEVERITY** | **MEDIUM** |
| **CLASSIFICATION** | CONFIRMED LOGIC BUG (an available field left unpopulated) |
| **SOURCE FILES** | `apps/api/src/controllers/attendance.controller.ts`, `apps/api/src/services/attendance.service.ts` |
| **EXACT FUNCTION** | `AttendanceController.update` / `AttendanceService.update` |
| **RECOMMENDED APPROACH** | Return the pre-update record from the service and pass it as `oldValue`. Trivial change. |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | **YES** — it is a prerequisite for meaningful conflict auditing. |

---

### SW-10 · `PUT /attendance/:id` has no request validation

| | |
|---|---|
| **MODULE** | Attendance |
| **SCENARIO** | A malformed or out-of-enum `status` is submitted. |
| **CURRENT BEHAVIOR** | The route has no `validate()` middleware; `AttendanceService.update` casts `data.status as any` and passes it to Prisma. |
| **WHY IT MAY BE A PROBLEM** | An invalid enum value fails at the database with an opaque error rather than a clear 400. `timeIn`/`timeOut` are parsed with bare `new Date(...)` — an unparseable string yields `Invalid Date`, which Prisma will reject, again opaquely. Low impact today (HR-only), but this same body shape is the natural basis for conflict resolution, where correctness matters more. |
| **SEVERITY** | **LOW** (today) |
| **CLASSIFICATION** | LOGIC GAP |
| **SOURCE FILES** | `apps/api/src/routes/attendance.routes.ts`, `attendance.service.ts:679` |
| **RECOMMENDED APPROACH** | Add a zod schema via the existing `validate` middleware, consistent with other routes. |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | Recommended alongside Phase 0. |

---

### SW-11 · Date-only comparison relies on `Date` objects carrying time and timezone

| | |
|---|---|
| **MODULE** | Attendance (and every `@db.Date` field) |
| **SCENARIO** | An import, or any write, constructs `new Date(dateString)` and compares or writes it against a `@db.Date` column. |
| **CURRENT BEHAVIOR** | `AttendanceRecord.date` is `@db.Date`. Application code compares using `rec.date.toISOString().split('T')[0]` (`attendance.service.ts:638`, `report.service.ts:196`) — i.e. **UTC** date extraction. Server timezone is not pinned anywhere in `apps/api/src/config/env.ts`. |
| **WHY IT MAY BE A PROBLEM** | `toISOString()` converts to UTC. For a server running in Philippine time (UTC+8), a `Date` at local midnight is the **previous day** in UTC. Whether this currently misbehaves depends on how Prisma materialises `@db.Date` values and on the server's timezone — I did not run the system, so I am flagging this as a **risk to verify**, not a confirmed defect. The import will make it consequential: date is half the deduplication key, and a one-day drift creates a duplicate row that the unique constraint cannot catch, because the two dates genuinely differ. |
| **SEVERITY** | **MEDIUM** (unverified — needs a runtime check) |
| **CLASSIFICATION** | DATA-INTEGRITY RISK |
| **SOURCE FILES** | `attendance.service.ts`, `report.service.ts`, `workforce-facts.service.ts`, `weekly-schedule.service.ts` |
| **RECOMMENDED APPROACH** | Before building the import: write a one-off script that inserts a known date and reads it back, confirming no drift. Then centralise date-only handling in a single helper (`toBusinessDate`) used everywhere, and pin the server timezone explicitly. |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | **YES — verify first.** |

---

### SW-12 · `noImportedRecord` counts calendar days, not scheduled working days

| | |
|---|---|
| **MODULE** | Attendance ↔ Reports |
| **SCENARIO** | An employee working a 5-day week over a 30-day month. |
| **CURRENT BEHAVIOR** | Both `getTally` (`:657`) and `ReportService.attendance` (`:212`) compute `totalCalendarDays − distinctDatesWithRecord`. Neither consults the weekly schedule, holidays, or the hire/separation dates. |
| **WHY IT MAY BE A PROBLEM** | ~8–9 rest days per month are reported as "No Imported Record". The label is honest ("no attendance data was received"), and the code correctly refuses to infer absence — but the metric conflates *"this person was not scheduled"* with *"data is missing"*, which are operationally very different. An employee hired mid-month is also charged no-record days for the period before they were hired. |
| **SEVERITY** | **MEDIUM** |
| **CLASSIFICATION** | CLIENT POLICY REQUIRED |
| **SOURCE FILES** | `attendance.service.ts`, `report.service.ts` |
| **RECOMMENDED APPROACH** | Ask Hospicio whether "No Imported Record" should mean *scheduled working days with no data*. If yes, it must intersect with the weekly schedule and holiday calendar — which requires SW-07 resolved first. At minimum, clamp to the employee's employment period. **Do not change the definition without the client's decision.** |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | Decision yes; implementation can follow. |

---

### SW-13 · `AttendanceLog` has no uniqueness or idempotency protection

| | |
|---|---|
| **MODULE** | Attendance |
| **SCENARIO** | A future import, or a retried request, creates a LATE log twice for the same employee-day. |
| **CURRENT BEHAVIOR** | `AttendanceLog` declares only `@@index([employeeId])` and `@@index([logDate])`. No unique constraint on any combination. |
| **WHY IT MAY BE A PROBLEM** | Unlike `AttendanceRecord`, nothing prevents duplicate logs. If the importer later generates logs, or if an acknowledge action is retried, tardiness counts inflate silently. |
| **SEVERITY** | **LOW** (today — no writer creates these in bulk) |
| **CLASSIFICATION** | DUPLICATION RISK |
| **SOURCE FILES** | `apps/api/prisma/schema.prisma` |
| **RECOMMENDED APPROACH** | If the import will write logs, add `@@unique([employeeId, logDate, logType])`. Decide before, not after. |
| **SCHEMA CHANGE LIKELY?** | YES (if import writes logs) |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | Only if the import writes logs. |

---

### SW-14 · Evaluation submit/finalize uses the same check-then-act pattern as leave

| | |
|---|---|
| **MODULE** | Evaluations |
| **SCENARIO** | An evaluator double-clicks Submit. |
| **CURRENT BEHAVIOR** | `evaluation.service.ts:957` guards with `if (assignment.status === FINALIZED) throw`, read before the write, with the update not conditioned on status. Same shape at `:859`. |
| **WHY IT MAY BE A PROBLEM** | Same class as SW-02. Impact is lower — the observable effect is mostly duplicated response rows / a second audit entry rather than a numeric balance error — but the pattern is identical and should be fixed together. |
| **SEVERITY** | **MEDIUM** |
| **CLASSIFICATION** | CONCURRENCY RISK |
| **SOURCE FILES** | `apps/api/src/services/evaluation.service.ts` |
| **RECOMMENDED APPROACH** | Conditional `updateMany … WHERE status != 'FINALIZED'`, assert affected = 1. |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | NO |

---

### SW-15 · `Notification` has no idempotency key

| | |
|---|---|
| **MODULE** | Notifications |
| **SCENARIO** | A leave decision request is retried after a client timeout where the server succeeded. |
| **CURRENT BEHAVIOR** | `NotificationService` creates rows with no dedupe key. The model has no `eventId`-style unique column. **Contrast**: `ApplicantCommunication` **does** have `eventId String? @unique` (`schema.prisma:2039`) and the recruitment auto-communication service uses it correctly for idempotency. |
| **WHY IT MAY BE A PROBLEM** | One business event can produce two notifications, inflating unread badges. Impact is cosmetic rather than corrupting, but the pattern for fixing it already exists in this codebase and is not applied here. |
| **SEVERITY** | **LOW–MEDIUM** |
| **CLASSIFICATION** | DUPLICATION RISK |
| **SOURCE FILES** | `apps/api/src/services/notification.service.ts`, `schema.prisma` (`Notification`) |
| **RECOMMENDED APPROACH** | Add a nullable-unique `eventId` and key it on the business event (e.g. `leave-approved:<leaveId>`), mirroring `ApplicantCommunication`. |
| **SCHEMA CHANGE LIKELY?** | YES |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | NO |

---

### SW-16 · `DocumentService.uploadDocument` orphans the file if the database write fails

| | |
|---|---|
| **MODULE** | Documents |
| **SCENARIO** | Multer writes the file; `prisma.employeeDocument.create` then throws. |
| **CURRENT BEHAVIOR** | No try/catch around the create; no cleanup. **Contrast**: `EmployeeController.create` **does** call `cleanupUploadedFiles(allFiles)` when the onboarding transaction rolls back (`employee.controller.ts:146`) — so the correct pattern exists and is applied there but not here. |
| **WHY IT MAY BE A PROBLEM** | Disk accumulates unreferenced files containing personal data, invisible to every HRISense screen. Not corruption, but a slow privacy and storage leak. |
| **SEVERITY** | **LOW** |
| **CLASSIFICATION** | DATA-INTEGRITY RISK |
| **SOURCE FILES** | `apps/api/src/services/document.service.ts` |
| **EXACT FUNCTION** | `DocumentService.uploadDocument` |
| **RECOMMENDED APPROACH** | Wrap in try/catch and call the existing `cleanupUploadedFiles`. Consider a periodic orphan sweep comparing the uploads directory against `storedFilename` values. |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | NO |

---

### SW-17 · Leave report counts by filing date; the Leave module works by leave date

| | |
|---|---|
| **MODULE** | Reports ↔ Leave |
| **SCENARIO** | HR compares "September leave" on the Leave report against the leave calendar. |
| **CURRENT BEHAVIOR** | `ReportService.leave` filters `where.createdAt` between from/to — i.e. requests **filed** in the period. `LeaveService.getCalendar` uses a proper overlap query on `startDate`/`endDate` — i.e. leave **taken** in the period. |
| **WHY IT MAY BE A PROBLEM** | Two screens legitimately show different numbers for "September". The report's description does say *"filed in the period"*, so it is honest — but it is a near-certain source of "the system's numbers don't match" during a defence or an audit. |
| **SEVERITY** | **LOW** |
| **CLASSIFICATION** | UX RISK / CLIENT POLICY REQUIRED |
| **SOURCE FILES** | `report.service.ts` (leave builder), `leave.service.ts:142` |
| **RECOMMENDED APPROACH** | Ask which definition HR means. Ideally offer both, labelled explicitly ("Filed in period" / "Leave taken in period"). Do not silently change the existing definition. |
| **SCHEMA CHANGE LIKELY?** | NO |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | NO |

---

### SW-18 · `AttendanceRecord.verifiedById` is a dangling field

| | |
|---|---|
| **MODULE** | Attendance |
| **CURRENT BEHAVIOR** | The column exists on the model. `grep -rn "verifiedById" apps/api/src` returns **nothing** — no reader, no writer, no relation declared. |
| **WHY IT MAY BE A PROBLEM** | It looks like provenance and will tempt a future implementer to reuse it for import/manual tracking. Its name means "verified", which is a third concept distinct from both "source" and "manually corrected". Reusing it would encode a confusing meaning permanently. |
| **SEVERITY** | **LOW** |
| **CLASSIFICATION** | ARCHITECTURAL DEBT |
| **SOURCE FILES** | `schema.prisma` (`AttendanceRecord`) |
| **RECOMMENDED APPROACH** | Either give it a real meaning as part of the import work (an explicit HR verification step) or drop it in the same migration that adds proper provenance. Do not silently repurpose it. |
| **SCHEMA CHANGE LIKELY?** | YES (as part of §12) |
| **MUST FIX BEFORE ATTENDANCE IMPORT?** | Decide during §12. |

---

### Areas I checked and found sound

Stated so you know they were examined, not skipped:

| Area | Finding |
|---|---|
| `AttendanceRecord` uniqueness | `@@unique([employeeId, date])` present — correct |
| Tally vs Report attendance definitions | **Consistent** — both use `calendarDays − distinctDates` |
| Announcement publish | Recipient snapshot is inside `$transaction`; `replaceRecipientSnapshot` deletes then `createMany({ skipDuplicates: true })`, protected by `@@unique([announcementId, employeeId])`. Well built. |
| Applicant → employee conversion | `JobApplication.employeeId` and `.onboardingDraftId` are both `@unique`; `OnboardingDraft.createdEmployeeId` is `@unique`; conversion runs in `$transaction`. **Double conversion is impossible.** Well built. |
| Recruitment automatic email idempotency | `ApplicantCommunication.eventId @unique` + an explicit pre-check. Correct. |
| Employee onboarding atomicity | Employee + User + documents in one `$transaction`, with employee-number retry and file cleanup on rollback. Correct. |
| Compliance derived status | Filters `lifecycle: 'ACTIVE', deletedAt: null` and orders records by `completedAt desc`. Inactive requirements correctly excluded. |
| Leave overlap prevention | `leave.service.ts:333` performs a proper overlap query and returns 409. Present and correct. |
| Org hierarchy | `OrgHierarchyService` filters `deletedAt: null` throughout — archived employees do not act as supervisors. |
| Reports / Tally employee scoping | Both use `{ deletedAt: null, employmentState: 'ACTIVE' }` consistently. |

---

## TOP 10 LOGICAL / DATA-INTEGRITY RISKS

Ranked most to least dangerous.

| # | ID | Risk | Severity |
|---|---|---|---|
| 1 | **SW-02** | Leave approval double-applies the balance under concurrent/retried requests | HIGH |
| 2 | **SW-04** | Training completion creates orphan and duplicate compliance records | HIGH |
| 3 | **SW-01** | Weekly schedule insert creates overlapping open-ended effective ranges | HIGH |
| 4 | **SW-05** | AI fact sheet miscounts attendance and understates ingestion gaps | MED–HIGH |
| 5 | **SW-07** | Three coexisting scheduling models; no single authority for employee-day | MED → HIGH |
| 6 | **SW-11** | Date-only handling via UTC extraction — unverified drift risk | MEDIUM |
| 7 | **SW-06** | `EmployeeWeeklySchedule` has no unique constraint or indexes | MEDIUM |
| 8 | **SW-03** | Leave `pending` non-atomic decrement, silently clamped | MEDIUM |
| 9 | **SW-09** | Attendance corrections record no `oldValue` | MEDIUM |
| 10 | **SW-14** | Evaluation submit/finalize check-then-act | MEDIUM |

Below the line: SW-12 (policy), SW-08 (blocked on sample), SW-15, SW-13, SW-10, SW-16, SW-17, SW-18.

**Risk multiplier for all of the above: there are no automated tests.** Every fix listed will be verified by reading code and clicking, which is how SW-01's dead variable survived in the first place.

---

## Answers to your 13 questions

**1. Duplicate-data risks you did not list?** Yes — three. SW-04 (compliance records duplicating via an unlinked orphan on retry, which your list did not anticipate as a *mechanism*), SW-06 (schedules duplicable at the same effective date because the constraint is application-only), and SW-13 (`AttendanceLog` has no uniqueness at all).

**2. Overlap risks outside attendance?** Yes — SW-01 is a genuine, confirmed overlap bug in weekly schedules, caused by a computed value that is never used. SW-07 is a broader overlap-of-authority problem across three scheduling models.

**3. Double-submit / retry risks?** Yes — SW-02 (leave, highest impact), SW-14 (evaluations), SW-15 (notifications). All share one shape: **a status guard read outside the write that enforces it.**

**4. Status-transition bugs?** No invalid transitions found — the guards exist and are correct in isolation. The defect is that they are **not atomic** with the writes they protect (SW-02, SW-14). Announcement and recruitment state handling looked sound.

**5. Unsafe transaction boundaries?** Yes — SW-04 is the clear one (two dependent writes, no transaction, in a file that uses `$transaction` correctly elsewhere). SW-16 is a lesser instance. Onboarding, applicant conversion and announcement publish are all correctly atomic.

**6. Calculations that double-count or disagree between modules?** Yes — SW-05 (AI vs Reports vs Tally, with a genuine mixed-population subtraction bug) and SW-17 (leave counted by filing date vs leave date). Attendance tally and the attendance report agree with each other.

**7. Date/time logic risks?** Yes — SW-11 (UTC extraction from `@db.Date` values with no pinned server timezone) is the one I would verify first, because the import makes date the deduplication key. SW-12 is a definitional date-range question rather than a bug.

**8. Authorization + data-integrity problems?** No new ones. Scoping is applied in service `where` clauses, `OrgHierarchyService` excludes archived employees, health records are excluded from supervisors, and audit metadata is redacted. **But SW-05 is the closest thing**: the AI fact sheet aggregates over employees the requester's own reports would exclude — a scope inconsistency rather than an exposure.

**9. File-storage consistency problems?** Yes — SW-16 (orphaned file when the document DB write fails). Onboarding handles this correctly, so the pattern exists; it is just not applied in `DocumentService`.

**10. Anything that could corrupt or silently overwrite valid HR data?** Yes, three: SW-02 (silently doubles a leave balance charge), SW-01 (silently creates an ambiguous schedule timeline), and — most relevant to this review — **the absence of manual-correction provenance on `AttendanceRecord`**, which means any import built without §10 would silently destroy HR's hand corrections.

**11. Fix BEFORE Mustard Seedtime import?** SW-01, SW-06 (schedule timeline must be unambiguous) · SW-07 (at minimum the decision) · SW-05 (`daysWithNoImportedRecord` becomes operationally important) · SW-09 (prerequisite for conflict auditing) · SW-11 (verify) · SW-08 (blocked on the sample) · plus SW-10 as cheap hygiene.

**12. Can wait?** SW-02, SW-03, SW-14 (important, but independent of attendance) · SW-15, SW-16, SW-17, SW-13, SW-18, SW-12 implementation.

**13. Anything else needing attention that you did not ask about?** Three things.
- **No automated tests anywhere** — no test file and no `test` script in any of the three `package.json` files. Every finding above was found by reading; SW-01 is a dead variable that any unit test of schedule bounding would have caught immediately.
- **13 schema models with zero runtime usage**, including `Payslip` — a table that could be mistaken for payroll capability, which is explicitly out of scope.
- **Two configuration mechanisms**: `config/env.ts` validates a core set with zod and exits on failure, but roughly a dozen other variables are read straight from `process.env` unvalidated — so misconfiguration fails silently at use rather than loudly at boot.

---

*Prepared by reading the current source on 2026-09-07. Nothing was implemented, no schema was changed, no migration was authored, and no Git operation was performed.*

---

## 25. Implementation-State Addendum — 2026-09-07

The design above was reviewed and approved with several architectural decisions
changed by the user. This records what was actually built.

### Decisions the user changed from my proposal

| My proposal | User's decision | Built as |
|---|---|---|
| Raw rows and daily candidates in ONE staging model | **Separate them** | `AttendanceImportRawRow` and `AttendanceImportCandidate` are distinct models. `rawRow.candidateId` is nullable, so MANY raw rows → ONE candidate. |
| Existing `AttendanceRecord` rows default to `sourceType = IMPORT` | **Use `LEGACY`** — do not claim provenance we do not know | Enum is `LEGACY \| IMPORT \| MANUAL \| SYSTEM`, default `LEGACY`. All 20 existing rows verified as LEGACY. |
| Unique `(employeeId, requirementId, completedAt)` on training-generated compliance | **Use a source-event key instead** — recurring requirements legitimately repeat | `EmployeeComplianceRecord.generatedFromTrainingParticipantId`, nullable + unique. |
| Optional date-period locking for concurrent imports | **Skip it** — keep the first implementation understandable | Three layers only: unique constraint, conditional batch transition, snapshot/version drift detection. |
| A fixture normalizer to make the pipeline testable now | **No fixture data in the production system** | Registry is empty and fails closed. |

### Built

- `AttendanceImportBatch`, `AttendanceImportRawRow`, `AttendanceImportCandidate` + 4 enums
- `AttendanceRecord` provenance: `sourceType`, `lastImportBatchId`, `manuallyModifiedAt`, `manuallyModifiedById`, `recordVersion`
- `attendance-import/normalizer.ts` — interface + empty registry, fails closed
- `attendance-import/classification.service.ts` — full 8-class engine, format-independent
- `lib/businessDate.ts` — date-only handling, 13/13 verification checks pass
- `lib/workforceScope.ts` — one shared active-workforce definition
- `services/schedule-resolver.service.ts` — canonical schedule authority

### Not built, deliberately

- The **real normalizer** — sample required
- The **apply engine and HTTP surface** — with no normalizer, no candidate can
  legitimately exist, so an apply path would be unreachable code whose first real
  exercise would be against production data. The classification engine it depends
  on is complete.
- **Process Import remains disabled** in the UI, with its existing honest message.

Full detail: `docs/LOGIC_DATA_INTEGRITY_REPAIR_REPORT.md`.
