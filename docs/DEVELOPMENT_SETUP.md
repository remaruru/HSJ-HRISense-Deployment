# HRISense — Clean Development Setup Guide
**System Title**: *HSJ HRISense: An AI-Assisted Workforce Administration System with Compliance Decision*  
**Document Target**: Laptop & New Machine Onboarding from Remote Repository

---

## 1. Prerequisites & System Requirements

Before setting up HRISense, ensure your system has the following software installed:

1. **Node.js**: `v20.x` or `v22.x` (LTS recommended)
2. **npm**: `v10.x` or higher
3. **Database Server**: **MySQL 8.x** or **MariaDB 10.x** (e.g. via **XAMPP** running on port `3306`)
4. **Git**: Version control client

---

## 2. Step-by-Step Installation from Remote Clone

### Step 1: Clone the Repository
```bash
git clone https://github.com/remaruru/HRISense.git
cd HRISense
```

### Step 2: Install Monorepo Dependencies
Use `npm install` or `npm ci` at the root directory to install all dependencies for the monorepo root, backend (`apps/api`), frontend (`apps/web`), and shared package (`packages/shared`):
```bash
npm install
```

---

## 3. Environment & Configuration Setup

### Step 3: Configure Backend Environment Variables
Copy the API environment template to `apps/api/.env`:
```bash
# Windows PowerShell
Copy-Item apps/api/.env.example apps/api/.env

# Linux / macOS
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and update your local database credentials if they differ from standard XAMPP defaults:
```env
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000

# Update with your MySQL credentials (default XAMPP has user 'root' and empty password)
DATABASE_URL="mysql://root:@localhost:3306/hrisense_db"

JWT_SECRET=replace-with-a-long-random-secret
REFRESH_TOKEN_SECRET=replace-with-a-different-long-random-secret
```

### Step 4 (Optional): Configure Frontend Environment Variables
If needed, copy the frontend environment template:
```bash
# Windows PowerShell
Copy-Item apps/web/.env.example apps/web/.env

# Linux / macOS
cp apps/web/.env.example apps/web/.env
```

---

## 4. Database Setup & Migrations

### Step 5: Start MySQL Server
Ensure MySQL is active in the XAMPP Control Panel or running as a local service on port `3306`.

### Step 6: Create the MySQL Database
Log into MySQL (e.g. via phpMyAdmin at `http://localhost/phpmyadmin` or the MySQL CLI) and create the database if it doesn't already exist:
```sql
CREATE DATABASE IF NOT EXISTS hrisense_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Step 7: Apply Migrations (DO NOT use `db push` or `migrate reset`)
Deploy all verified migrations to bring the database schema up to date:
```bash
npm run prisma:migrate --prefix apps/api
# Or directly:
npx --prefix apps/api prisma migrate deploy
```

### Step 8: Generate Prisma Client
Generate the type-safe Prisma client:
```bash
npm run prisma:generate --prefix apps/api
# Or directly:
npx --prefix apps/api prisma generate
```

### Step 9: Seed Master & Test Data (Optional)
To populate baseline master data, job roles, units, and development accounts:
```bash
npm run seed --prefix apps/api
```

---

## 5. Building & Running the Application

### Running in Development Mode (Hot Reloading)
To start both the API server (`http://localhost:5000`) and the Web client (`http://localhost:3000`) concurrently:
```bash
npm run dev
```

Or start them individually in separate terminals:
- **Backend API**: `npm run dev --prefix apps/api` (runs on `http://localhost:5000`)
- **Frontend Web**: `npm run dev --prefix apps/web` (runs on `http://localhost:3000`)

### Building for Production Verification
- **API Build**: `npm run build --prefix apps/api`
- **Web Build**: `npm run build --prefix apps/web`

---

## 6. Access & Default Endpoints

| Service | Local URL | Notes |
|---|---|---|
| **Web Application** | `http://localhost:3000` | Landing page, Login, Dashboard, Help Center |
| **Backend API** | `http://localhost:5000/api/v1` | Health check, Auth, Module routes |
| **API Health Check** | `http://localhost:5000/api/v1/health` | Returns server uptime and status |

---

## 7. Troubleshooting & Common Questions

1. **"Database connection failed"**:
   - Verify MySQL is running in XAMPP on port `3306`.
   - Verify `DATABASE_URL` in `apps/api/.env` matches your MySQL username, password, and port.

2. **"Prisma client out of date"**:
   - Run `npx --prefix apps/api prisma generate`.

3. **"Uploaded files directory missing"**:
   - The backend automatically creates necessary `uploads/` subdirectories upon initialization.

4. **"Port 5000 or 3000 in use"**:
   - Close any lingering Node processes or adjust `PORT` in `apps/api/.env` and `VITE_API_URL` in `apps/web/.env`.
