# CarCheck

Real-time fleet inspection and trip log system for operational security teams.

---

## Overview

CarCheck digitizes vehicle inspection workflows and daily trip logs (BDV) for operational fleet management. Administrators get a real-time audit dashboard with inspection history, damage maps, and trip reports. Built to run on low-end smartphones without app installation.

---

## Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | HTML5, CSS3, Vanilla JS (ES6+)    |
| Backend    | Node.js, Express.js               |
| Database   | MariaDB                           |
| Auth       | JWT + Bcrypt                      |
| Validation | Zod                               |

---

## Features

- Vehicle inspection checklists
- Digital damage mapping using HTML5 Canvas
- Daily trip log (BDV) management
- Stop registration and tracking
- JWT authentication and role-based access control
- Employee management
- Real-time inspection reports
- Trip auditing and KM tracking
- Mobile-first interface
- Admin dashboard

---

## Project Structure

    CarCheck/
        backend/
            index.js                    Entry point, Express setup, BigInt patch
            .env                        Environment variables
            public/                     Static assets (vehicle schematic)
            scripts/
                migrate-passwords.js    Bcrypt migration utility
            src/
                config/
                    database.js         MariaDB connection pool
                controllers/
                    auth.controller.js
                    checklist.controller.js
                    bdv.controller.js
                    admin.controller.js
                    veiculo.controller.js
                services/
                    auth.service.js
                    checklist.service.js
                    bdv.service.js
                repositories/
                    funcionario.repository.js
                    checklist.repository.js
                    bdv.repository.js
                    veiculo.repository.js
                middlewares/
                    auth.middleware.js
                    validate.middleware.js
                    errorHandler.middleware.js
                routes/
                    index.js
                utils/
                    constants.js
                    response.js
        frontend/
            client/
                pages/                  login, menu, selecao, checklist, bdv, admin, admin-dashboard, admin-bdv
                js/                     auth, checklist, admin, frota, config
                css/
                    style.css

---

## API Routes

| Method | Route                         | Auth        | Description               |
|--------|-------------------------------|-------------|---------------------------|
| POST   | /api/login                    | None        | Authenticate, receive JWT |
| GET    | /api/veiculos                 | JWT         | List fleet vehicles       |
| POST   | /api/checklist                | JWT         | Submit vehicle inspection |
| POST   | /api/bdv                      | JWT         | Open trip log (BDV)       |
| GET    | /api/bdv/ativo                | JWT         | Get driver's active BDV   |
| GET    | /api/bdv/:id                  | JWT         | Get BDV with stops        |
| POST   | /api/bdv/:id/paradas          | JWT         | Register stop             |
| PATCH  | /api/bdv/:id/paradas/:pid     | JWT         | Close stop                |
| PATCH  | /api/bdv/:id/encerrar         | JWT         | Close trip                |
| GET    | /api/admin/relatorio          | JWT + Admin | Inspection report         |
| GET    | /api/admin/bdv                | JWT + Admin | Trip report               |
| GET    | /api/admin/funcionarios       | JWT + Admin | List employees            |
| POST   | /api/admin/funcionarios       | JWT + Admin | Register employee         |

---

## Environment Variables

    DB_HOST=localhost
    DB_PORT=3306
    DB_USER=your_user
    DB_PASSWORD=your_password
    DB_NAME=carcheck_db
    DB_CONNECTION_LIMIT=10
    PORT=3000
    HOST=0.0.0.0
    JWT_SECRET=change_in_production
    JWT_EXPIRES_IN=12h
    NODE_ENV=production

---

## Running the Backend

    cd backend
    npm install
    cp .env.example .env
    npm start

For development with auto-restart:

    npm run dev

---

## Running as a Windows Service

In production the backend must survive terminal close, auto-restart on crash,
**and** come back up after the server reboots. This is handled by **NSSM** (the
Non-Sucking Service Manager) in two stages — Part A gets the process managed and
crash-resilient immediately; Part B confirms it survives a reboot.

> **Why NSSM and not PM2?** PM2 is an npm package and inherits Node's platform
> check, which **refuses to run on this server's Windows Server 2012** (EOL,
> below the Node/npm tooling baseline — see BACKLOG **I1**). NSSM is a single
> native `nssm.exe` binary with no Node version requirement, and provides
> crash-restart + start-at-boot itself.

> ⚠️ **The one load-bearing setting: `AppDirectory`.** The service must run
> `node index.js` with its **working directory = the backend folder**. Both
> `index.js` and `config/database.js` call `dotenv.config()` with no path, so
> dotenv reads `.env` from the process CWD. If `AppDirectory` is wrong, `.env`
> doesn't load → `JWT_SECRET` missing → the process exits immediately. This is
> the exact analogue of the old PM2 `cwd: ./backend`.

Install NSSM by dropping `nssm.exe` somewhere on PATH (e.g. `C:\nssm\nssm.exe`).
The backend deploy path on this server is `C:\xampp\htdocs\CarCheck\backend`.

### Part A — Process management

Gets you terminal-close survival + crash auto-restart right away. Run everything
as Administrator.

**1. Find node.exe and pre-create the log dir** (NSSM does **not** create it):

    where node                         REM e.g. C:\Program Files\nodejs\node.exe
    mkdir C:\xampp\htdocs\CarCheck\backend\logs

**2. Install the service** (working dir + identity):

    nssm install CarCheckAPI "C:\Program Files\nodejs\node.exe" index.js
    nssm set CarCheckAPI AppDirectory C:\xampp\htdocs\CarCheck\backend
    nssm set CarCheckAPI DisplayName  "CarCheck API"
    nssm set CarCheckAPI Description   "CarCheck backend (Node/Express) - fleet inspection API"

Using the **full path to `node.exe`** avoids PATH issues under the service
account (default `LocalSystem`, which can read the deploy folder; DB auth is via
TCP credentials in `.env`, so no named account is needed).

**3. stdout/stderr -> backend\logs (with rotation):**

    nssm set CarCheckAPI AppStdout      C:\xampp\htdocs\CarCheck\backend\logs\carcheck-out.log
    nssm set CarCheckAPI AppStderr      C:\xampp\htdocs\CarCheck\backend\logs\carcheck-error.log
    nssm set CarCheckAPI AppRotateFiles 1
    nssm set CarCheckAPI AppRotateOnline 1
    nssm set CarCheckAPI AppRotateBytes 10485760   REM 10 MB

**4. Auto-restart + anti-thrash:**

    REM crash (exit !=0) -> restart;  graceful exit 0 (SIGINT/SIGTERM) -> stay stopped
    nssm set CarCheckAPI AppExit Default Restart
    nssm set CarCheckAPI AppExit 0 Exit
    REM treat a run shorter than 10s as a failed start and back off (prevents a
    REM thrash loop on a permanent failure like a missing .env -> exit in <1s)
    nssm set CarCheckAPI AppThrottle     10000     REM ms; min "successful" uptime
    nssm set CarCheckAPI AppRestartDelay 2000      REM ms delay before each restart

`AppThrottle` is the key anti-thrash lever: a process that dies inside 10s is
retried at most ~every 10s instead of hammering, while a genuinely transient
cause still recovers (NSSM throttles rather than giving up).

**5. Start and verify:**

    nssm start CarCheckAPI
    nssm status CarCheckAPI            REM expect SERVICE_RUNNING
    curl http://localhost:3000/api/health

Health must return `{"success":true,...,"status":"online"}`. Confirm
`backend\logs\carcheck-out.log` shows the startup banner and
`[DB] Conexão estabelecida`.

At this point the backend survives terminal close and auto-restarts on crash.
Reboot survival is confirmed in Part B.

### Part B — Reboot persistence

NSSM registers the service as **Automatic** start, so it comes up at boot with no
login. Set delayed-auto-start so XAMPP/MariaDB is up first (the app exits if the
DB is unreachable at boot):

    nssm set CarCheckAPI Start SERVICE_DELAYED_AUTO_START

Optional hardening: if XAMPP's MariaDB runs as a service (e.g. `mysql`), make the
API wait for it explicitly:

    nssm set CarCheckAPI DependOnService mysql

This server **auto-reboots on its own** (hardware/scheduled), and the current
hand-started `node` process does **not** survive that — which is the gap this
service closes. Without Part B, the app stays down after every reboot.

### Verification — rides the next natural reboot

No need to force a reboot: this server reboots on its own, so verification
piggy-backs on the **next natural reboot**. After it happens, **without starting
anything manually**, run:

    Get-Service CarCheckAPI           REM Status = Running
    curl http://localhost:3000/api/health

Confirm the service is **Running** (started by the SCM at boot, not by hand — the
log timestamp in `carcheck-out.log` should line up with boot time) and health
returns `{"success":true,...,"status":"online"}`.

If the service is `Stopped`/`Paused` after a reboot, check `carcheck-error.log`
for the cause (commonly the DB not being ready in time — the `AppThrottle` back-off
and `DependOnService mysql` above address this).

---

## Scheduled Database Backups

For an odometer/audit system, data loss is catastrophic. Two Node scripts handle
backup and (tested) restore. They shell out to XAMPP's `mysqldump`/`mysql`, read
credentials from `backend/.env` (by absolute path, so they don't depend on the
working directory), and pass the DB password via `MYSQL_PWD` (never on the command
line). **No administrator rights are required** — unlike the NSSM service (B8), a
per-user scheduled task runs under the standard server account.

Relevant `.env` settings (see `.env.example`): `MYSQLDUMP_PATH`, `MYSQL_PATH`,
`BACKUP_DIR`, `BACKUP_KEEP_DAILY`, `BACKUP_KEEP_WEEKLY`.

### Taking a backup

    cd backend
    npm run backup-db

This writes a gzip-compressed dump to `BACKUP_DIR` (default `backend/backups/`,
which is gitignored):

    backups/daily/   carcheck-<db>-<timestamp>.sql.gz   (keeps BACKUP_KEEP_DAILY, default 7)
    backups/weekly/  carcheck-<db>-<timestamp>.sql.gz   (keeps BACKUP_KEEP_WEEKLY, default 4)

Every run writes a daily backup and prunes old ones. A copy is promoted to
`weekly/` whenever the newest weekly backup is 7+ days old — so weekly retention
is correct regardless of which day the task happens to run. The dump uses
`--single-transaction` (consistent InnoDB snapshot without locking writes).

> **Put `BACKUP_DIR` on a different disk/share.** A backup sitting next to the
> database on the same disk does not survive a disk failure. Set `BACKUP_DIR` in
> `.env` to another drive or a network path (e.g. `D:\Backups\CarCheck`).

### Scheduling it (Task Scheduler, no admin)

Register a daily task that runs as the current user. Run once in a normal
(non-elevated) terminal, adjusting the node path and deploy path if needed:

    schtasks /Create /TN CarCheckBackup /SC DAILY /ST 02:00 /F ^
      /TR "\"C:\Program Files\nodejs\node.exe\" \"C:\xampp\htdocs\CarCheck\backend\scripts\backup-db.js\""

By default the task only runs while the user is logged on. To run even when logged
off (recommended, since the server may sit at the lock screen), add `/RU` and
enter the account password when prompted:

    schtasks /Create /TN CarCheckBackup /SC DAILY /ST 02:00 /F /RU geral /RP * ^
      /TR "\"C:\Program Files\nodejs\node.exe\" \"C:\xampp\htdocs\CarCheck\backend\scripts\backup-db.js\""

Verify and trigger a one-off run:

    schtasks /Query /TN CarCheckBackup
    schtasks /Run   /TN CarCheckBackup

### Restoring — and testing the restore

> **A backup you have never restored is not a backup.** Test the restore into a
> throwaway database. The dump is table-level (no `CREATE DATABASE`/`USE`), so the
> restore always targets an explicit `--target-db`, and a test never touches prod.

Safe test restore (creates a scratch DB, restores, prints per-table row counts you
can compare against production, then tells you how to drop it):

    cd backend
    npm run restore-db -- backups/daily/carcheck-<db>-<timestamp>.sql.gz --target-db=carcheck_restore_test

If the row counts match production, the backup is good. Clean up the scratch DB
with the `DROP DATABASE` command the script prints.

Real restore over production (destructive — overwrites the live tables, so it is
blocked without `--yes`):

    npm run restore-db -- backups/daily/carcheck-<db>-<timestamp>.sql.gz --target-db=carcheck --yes

(If the production database was lost entirely, the script recreates it with
`CREATE DATABASE IF NOT EXISTS` before restoring.)

---

## License

This project is proprietary software.

Copyright (c) 2026 Leonardo Andrade. All rights reserved.

No permission is granted to use, copy, modify, distribute, sublicense, deploy for third parties, or create derivative works without explicit written authorization from the copyright holder.

---

## Author

**Leonardo Andrade**

IT Professional | Backend Developer

Rio de Janeiro, Brazil

[github.com/loucop](https://github.com/loucop)
