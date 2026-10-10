# Legacy Migrations Archive

These migration folders were archived on 2026-07-31 to resolve a fatal migration history corruption (Recovery Path D).

## Reason for Archival
The historical migration chain was broken. The `20260717092607_init` migration failed to create several critical tables that existed in the live database (such as `departments` and `onboarding_drafts`). The subsequent migration `20260722_phase_4a_hierarchy_structure` attempted to `ALTER TABLE departments`, which caused `prisma migrate dev` and shadow database calculations to fail permanently because the table never existed in the tracked migration history.

## Relevant Commits
- `c4adeab10123f36f02f60be0ecaac208607fdc2e` (Init migration added)
- `f9c79003e042194464e8d45f45c3092959c0ea8a` (Phase 4a hierarchy added)

## Baseline Replacement
These migrations have been superseded by a single `00000000000000_hrisense_baseline` migration that represents the exact pre-Recruitment live database structure, ensuring Prisma's shadow database can successfully build the full schema.

## Backup Info
A safe backup of the live database was taken prior to this recovery: `hrisense_db_backup.sql` (2026-07-31).

## Rollback Instructions
To reverse this archival:
1. Delete the new `00000000000000_hrisense_baseline` migration folder.
2. Move `20260717092607_init` and `20260722_phase_4a_hierarchy_structure` back into `prisma/migrations/`.
3. If the live database `_prisma_migrations` table was altered, drop the database and restore from `hrisense_db_backup.sql`.
