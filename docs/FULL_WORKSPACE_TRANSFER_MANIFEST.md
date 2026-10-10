# HRISense Full Workspace Transfer Manifest

## Overview
- **Current Branch:** `main`
- **Current HEAD Commit:** (Will be checkpointed to `hrisense-full-workspace-2026-07-31` tag upon completion)
- **Repository Root:** `C:\xampp\htdocs\HRISense`
- **Remote Repository:** `origin`
- **Database Dump Filename:** `hrisense_db_full_laptop_transfer_20260731.sql`
- **Database Dump Size:** ~767 KB

## Included Paths & Artifacts
The following previously-ignored or generated resources have been explicitly staged and included in this snapshot:

- **Environment Files:**
  - `apps/api/.env`
  - `apps/web/.env`
- **Upload Directories:**
  - `apps/api/uploads/` (including development resumes)
- **Generated Directories:**
  - `apps/api/prisma/client/` (and internal Prisma artifacts)
- **Build Outputs:**
  - `apps/api/dist/`
  - `apps/web/dist/` (if built)
- **Node Modules:**
  - `apps/api/node_modules/`
  - `apps/web/node_modules/`
  - `node_modules/` (root)
- **Previously Ignored Files Included:**
  - Database SQL backups (`*.sql`)
  - Hidden project files (`.vscode/`, `.env.local`, etc.)
  - IDE specific caches

## Large Files & Git LFS
- **Git LFS Tracked Extensions:** `*.zip`, `*.sql`, `*.node`, `*.exe`, `*.dll`, `*.pdf`, `*.docx`, `*.doc`, `*.png`, `*.jpg`, `*.jpeg`, `*.webp`, `*.mp4`
- **Large Files Discovered:** 
  - Several binary files within `node_modules`
  - `hrisense_db_full_laptop_transfer_20260731.sql`

## Files Excluded
- `.git/` (Exact reason: Git's internal repository metadata cannot be committed inside the repository itself.)
- `.git/index.lock` (Exact reason: Transient operating system lock file generated during git operations.)
- `HRISense_FULL_WORKSPACE_20260731.zip` (Exact reason: Optional archive creation was halted/skipped to prioritize the primary Git commit integrity, avoiding locked-file concurrency issues during `git add`.)
