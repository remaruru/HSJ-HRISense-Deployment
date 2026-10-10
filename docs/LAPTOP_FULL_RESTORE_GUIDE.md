# HRISense Full Workspace Laptop Restore Guide

## Preparation
1. **Install Git**: Download and install [Git for Windows/macOS](https://git-scm.com/downloads).
2. **Install Git LFS**: Download and install [Git Large File Storage](https://git-lfs.com/). 
   *Run `git lfs install` in your terminal.*
3. **Install Node.js**: Ensure Node.js (v18 or v20 recommended) is installed.
4. **Install XAMPP/MySQL**: Ensure MySQL is available via XAMPP or a direct installation.

## Clone & Setup
5. **Clone the private repository**:
   ```bash
   git clone <repository_url> HRISense
   cd HRISense
   ```
6. **Check out main**:
   ```bash
   git checkout main
   ```
7. **Pull Git LFS files**: Ensure all large files (like the DB dump) are downloaded.
   ```bash
   git lfs pull
   ```
8. **Verify Environment Files**: 
   Confirm `.env`, `.env.local`, `.env.development` are present in the root and in `apps/api`/`apps/web`. The workspace snapshot included them automatically.

## Database Restoration
9. **Create the Database**: 
   Open your MySQL client or phpMyAdmin and create a database named `hrisense_db`.
10. **Import the SQL Dump**:
    Import `hrisense_db_full_laptop_transfer_20260731.sql` (found in the repository root) into `hrisense_db`.
    ```bash
    mysql -u root hrisense_db < hrisense_db_full_laptop_transfer_20260731.sql
    ```
11. **Verify DATABASE_URL**: Check your `.env` in `apps/api` to ensure `DATABASE_URL` matches your local MySQL credentials.

## Environment & Dependencies
12. **Verify API Environment**: Check `apps/api/.env` settings (e.g., JWT, Brevo).
13. **Verify Web Environment**: Check `apps/web/.env` settings.
14. **Verify Uploaded Files**: The `uploads/` directories and development resumes were included in this snapshot. They should already be in place.
15. **Verify Dependencies**: `node_modules` was explicitly included in this transfer to maintain exact parity.
    > [!WARNING]
    > Because `node_modules` contains OS-specific binaries, you **may** need to reinstall dependencies if moving from Windows to macOS/Linux, or if native binaries fail to load. If you encounter missing module errors, run `npm ci` in `apps/api` and `apps/web`.

## Prisma Configuration
16. **Generate Prisma Client**:
    ```bash
    cd apps/api
    npm run db:generate
    ```
17. **Check Prisma Migration Status**:
    ```bash
    npx prisma migrate status
    ```
    > [!IMPORTANT]
    > **Do not** automatically run `prisma migrate reset`, `prisma db push`, or database reseeding on the laptop unless instructed.

## Running the Application
18. **Start API**:
    ```bash
    cd apps/api
    npm run dev
    ```
19. **Start Web**:
    ```bash
    cd apps/web
    npm run dev
    ```
20. **Confirm Login**: Open the web app and sign in using the existing test accounts to confirm the current project state is exactly as it was on the original machine.
