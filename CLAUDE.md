# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CarCheck v3.0 is a fleet vehicle inspection system for Angels Vigilância (Brazilian security company). It digitizes the FOR 181 inspection form for field drivers and provides an admin audit dashboard. Designed to run in mobile browsers without app installation.

## Commands

### Backend

```bash
cd backend
npm install          # Install dependencies
npm start            # Run server (node index.js) on port 3000
npm run dev          # Run with nodemon (auto-restart)
node scripts/migrate-passwords.js  # Hash plaintext passwords to bcrypt
```

### Frontend

No build step. Open HTML files directly in a browser or serve statically. Update `frontend/client/js/config.js` (`API_BASE_URL`) to point to the backend host.

### Environment Setup

```bash
cp backend/.env.example backend/.env
# Edit .env with DB credentials and JWT_SECRET
```

There are no automated tests in this project.

## Architecture

```
frontend/client/          # Static HTML/CSS/JS (no framework, no build step)
  pages/                  # login → menu → selecao → checklist / admin
  js/                     # One JS file per page + config.js (API_BASE_URL)
  css/style.css           # Dark theme, mobile-first

backend/
  index.js                # Express entry point; BigInt serialization patch
  src/
    config/database.js    # MariaDB connection pool (10 connections)
    routes/index.js       # All API route declarations
    middlewares/          # auth (JWT verify + role), validate (Zod), errorHandler
    controllers/          # HTTP request/response layer
    services/             # Business logic (transactions live here)
    repositories/         # SQL queries — only layer that touches the DB
    utils/constants.js    # ROLES, ERROR_CODES, STATUS enums
    utils/response.js     # Standardized response helpers
```

**Request flow:** Route → `validate` middleware (Zod) → `auth` middleware (JWT) → Controller → Service → Repository → MariaDB

**Layering rule:** Controllers never query the DB directly; services never write raw SQL. Keep this separation when adding features.

## Key Implementation Details

### BigInt Serialization
MariaDB returns vehicle/checklist IDs as `BigInt`. A global patch in `backend/index.js` adds `BigInt.prototype.toJSON`. Controllers also manually call `.toString()` on BigInt fields before returning responses.

### Checklist Submission (Atomic Transaction)
`src/services/checklist.service.js` uses `SELECT ... FOR UPDATE` to lock the vehicle row, validates that the submitted KM ≥ current KM, inserts the checklist, updates `km_atual`, then commits — all in one transaction. Always preserve this pattern when modifying checklist logic.

### Dual Password Support
`auth.service.js` supports both bcrypt hashes (`$2b$` prefix) and legacy plaintext passwords for backward compatibility with v2.1 data. New users are always stored with bcrypt (10 rounds).

### Damage Map Images
The canvas damage map in `checklist.html` is serialized to a Base64 PNG and stored in the `mapa_avaria_base64` column (LONGTEXT). Images are not written to disk.

### Role-Based Access
Two roles defined in `utils/constants.js`: `admin` and `motorista`. The `authorize(...roles)` middleware in `auth.middleware.js` protects admin-only routes. The frontend shows/hides admin UI based on `usuario.nivel_acesso` from localStorage.

## API Routes (all prefixed `/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | None | Returns JWT (12h expiry) |
| GET | `/health` | None | DB health check |
| GET | `/veiculos` | JWT | List active vehicles |
| GET | `/veiculos/:id/historico` | JWT | Paginated inspection history |
| POST | `/checklist` | JWT | Submit inspection (atomic) |
| GET | `/admin/relatorio` | JWT + admin | Audit report with filters |
| GET | `/admin/funcionarios` | JWT + admin | List employees |
| POST | `/admin/funcionarios` | JWT + admin | Register new employee |

## Database

MariaDB. Key tables: `funcionarios` (matricula PK, cpf, nivel_acesso, senha), `veiculos` (id BigInt, placa, modelo, km_atual, status), `checklists` (id BigInt, veiculo_id FK, matricula FK, km_entrada, itens_status JSON string, mapa_avaria_base64 LONGTEXT).

## Frontend State Management

No framework. State is passed between pages via `localStorage`:
- `token` — JWT for API calls
- `usuario` — JSON of logged-in user (matricula, nome, nivel_acesso)
- `veiculo_selecionado` — JSON of vehicle picked in selecao.html

`frontend/client/js/config.js` is the single source of truth for `API_BASE_URL` (currently `http://10.10.1.100:3000/api` for the Angels Vigilância LAN).
