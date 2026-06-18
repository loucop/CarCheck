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
**and** come back up after the server reboots. This is handled by **PM2** in two
stages — Part A gets the process managed and crash-resilient immediately; Part B
closes the reboot gap. The process definition lives in `ecosystem.config.js` at
the repo root (fork mode, `cwd: ./backend`, restart policy, logs under
`backend/logs/` — no secrets; they stay in `backend/.env`).

> ⚠️ **Read this first — the two caveats that break PM2 on Windows:**
>
> 1. **Pin `PM2_HOME`.** Set it to a fixed path (`C:\ProgramData\pm2`) for
>    **every** PM2 command below. PM2 stores its saved process list and logs
>    under `PM2_HOME`; if the value drifts between commands, the service won't
>    find the apps you saved.
> 2. **Same account for `pm2 save` and the service.** The `pm2 save` snapshot is
>    resurrected on boot by the Windows Service. The service **must run under the
>    same account that ran `pm2 save`** (and that account needs `node` + `pm2` on
>    its `PATH`). If they differ, the service starts an empty PM2 with nothing to
>    resurrect. Run everything below as that account (e.g. Administrator).

### Part A — Process management

Gets you terminal-close survival + crash auto-restart right away.

**1. Install PM2 (run as Administrator):**

    npm install -g pm2

**2. Pin PM2_HOME (machine-wide, then for this session):**

    setx PM2_HOME "C:\ProgramData\pm2" /M
    set PM2_HOME=C:\ProgramData\pm2

`setx ... /M` writes the machine-wide variable so the service (Part B) sees it on
boot; `set` applies it to the current shell so the commands below use the same home.

**3. Start the app and save the process list:**

    cd C:\path\to\CarCheck
    pm2 start ecosystem.config.js
    pm2 status                       # confirm carcheck-api is "online"
    pm2 save                         # snapshot for resurrect-on-boot (used by Part B)

**4. Log rotation (PM2 is chatty — cap disk usage):**

    pm2 install pm2-logrotate
    pm2 set pm2-logrotate:max_size 10M
    pm2 set pm2-logrotate:retain 14

Live tail when troubleshooting:

    pm2 logs carcheck-api

At this point the backend survives terminal close and auto-restarts on crash.
It does **not** yet survive a reboot — continue to Part B.

### Part B — Reboot persistence

This server **auto-reboots on its own** (hardware/scheduled), but the Node
process does **not** come back by itself after one — PM2's own startup hook is
not supported on Windows. **pm2-windows-service** closes that gap by running the
PM2 daemon as a true Windows Service that starts at boot (no login required) and
resurrects the `pm2 save` snapshot from Part A. Without Part B, the app stays
down after every reboot.

**1. Install the service wrapper (run as Administrator):**

    npm install -g pm2-windows-service

**2. Install the PM2 Windows Service:**

    pm2-service-install -n PM2

Accept the prompts. This registers the PM2 daemon as a service that resurrects
the saved process list at boot. Ensure the service runs under the **same
account** that ran `pm2 save` in Part A (see caveat above).

### Verification — rides the next natural reboot

No need to force a reboot: this server reboots on its own, so verification piggy-backs
on the **next natural reboot**. After it happens, **without starting anything manually**,
open a shell (with `PM2_HOME=C:\ProgramData\pm2`) and run:

    pm2 status

Confirm **`carcheck-api` shows `online`** with a **fresh uptime** — i.e. the
service auto-started it after the reboot, not you. Also hit the health endpoint:

    curl http://localhost:3000/api/health

It must return `{"success":true,...,"status":"online"}`.

If `pm2 status` is empty or the app is `stopped`/`errored` after a reboot, the
**same-account / `PM2_HOME`** caveat was not satisfied — re-run Part A step 2–3
and Part B as the account the service runs under.

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
