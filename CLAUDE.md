# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CarCheck v4.0 is a fleet vehicle inspection and trip log system for the client organization. It digitizes the FOR 181 inspection form and the BDV (daily trip log) for field drivers, and provides an admin audit dashboard. Designed to run in mobile browsers without app installation.

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
  pages/                  # login -> menu -> selecao -> checklist / bdv / admin
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
    repositories/         # SQL queries -- only layer that touches the DB
    utils/constants.js    # ROLES, ERROR_CODES, STATUS enums
    utils/response.js     # Standardized response helpers
```

**Request flow:** Route -> `validate` middleware (Zod) -> `auth` middleware (JWT) -> Controller -> Service -> Repository -> MariaDB

**Layering rule:** Controllers never query the DB directly; services never write raw SQL. Keep this separation when adding features.

## Key Implementation Details

### BigInt Serialization
MariaDB returns vehicle/checklist IDs as `BigInt`. A global patch in `backend/index.js` adds `BigInt.prototype.toJSON`. Controllers also manually call `.toString()` on BigInt fields before returning responses.

### Checklist Submission (Atomic Transaction)
`src/services/checklist.service.js` uses `SELECT ... FOR UPDATE` to lock the vehicle row, validates that the submitted KM >= current KM, inserts the checklist, updates `km_atual`, then commits -- all in one transaction. Always preserve this pattern when modifying checklist logic.

### BDV Open/Close (Atomic Transactions)
`src/services/bdv.service.js` uses the same transaction + `SELECT ... FOR UPDATE` pattern. Opening a BDV checks for an existing open BDV per driver and per vehicle, then sets vehicle status to `em_uso`. Closing sets status back to `disponivel` and updates `km_atual`.

### Dual Password Support
`auth.service.js` supports both bcrypt hashes (`$2b$` prefix) and legacy plaintext passwords for backward compatibility with v2.1 data. New users are always stored with bcrypt (10 rounds).

### Damage Map Images
The canvas damage map in `checklist.html` is serialized to a Base64 PNG and stored in the `mapa_avaria_base64` column (LONGTEXT). Images are not written to disk.

### Role-Based Access
Three roles defined in `utils/constants.js`: `admin`, `vistoriador`, and `motorista`. The `authorize(...roles)` middleware in `auth.middleware.js` protects admin-only routes. The frontend shows/hides UI elements based on `usuario.nivel_acesso` from localStorage.

### Linear Flow Lock
After checklist submission, drivers are redirected to `bdv.html`. `menu.html` and `checklist.html` both check `GET /api/bdv/ativo` on load and redirect to `bdv.html` if an open BDV exists, preventing a driver from starting a new checklist while a trip is in progress.

## API Routes (all prefixed `/api`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | None | Returns JWT (12h expiry) |
| GET | `/health` | None | DB health check |
| GET | `/veiculos` | JWT | List active vehicles |
| GET | `/veiculos/:id/historico` | JWT | Paginated inspection history |
| POST | `/checklist` | JWT | Submit inspection (atomic) |
| POST | `/bdv` | JWT | Open trip log |
| GET | `/bdv/ativo` | JWT | Get driver's active BDV |
| GET | `/bdv/:id` | JWT | Get full BDV with stops |
| POST | `/bdv/:id/paradas` | JWT | Register stop |
| PATCH | `/bdv/:id/paradas/:paradaId` | JWT | Close stop |
| PATCH | `/bdv/:id/encerrar` | JWT | Close trip |
| GET | `/admin/relatorio` | JWT + admin | Checklist audit report |
| GET | `/admin/bdv` | JWT + admin | BDV audit report |
| GET | `/admin/funcionarios` | JWT + admin | List employees |
| POST | `/admin/funcionarios` | JWT + admin | Register new employee |

## Database

MariaDB 10.4. Key tables:

`funcionarios` — matricula (PK), nome, cpf, nivel_acesso (`admin` | `vistoriador` | `motorista`), senha, coligada

`veiculos` — id (BigInt PK), placa, modelo, km_atual, status (`disponivel` | `em_uso` | `manutencao`)

`checklists` — id (BigInt PK), veiculo_id (FK), matricula (FK), km_entrada, itens_status (JSON string), mapa_avaria_base64 (LONGTEXT)

`bdv` — id (BigInt PK), matricula (FK), veiculo_id (FK), coligada, km_inicial, km_final, combustivel_retorno, status (`aberto` | `encerrado`), data_abertura, data_encerramento, encerrado_fora_base

`bdv_paradas` — id (BigInt PK), bdv_id (FK), local_saida, hora_saida, km, local_chegada, hora_chegada, observacao

## Frontend State Management

No framework. State is passed between pages via `localStorage`:
- `token` -- JWT for API calls
- `usuario` -- JSON of logged-in user (matricula, nome, nivel_acesso)
- `veiculo_id` -- ID of vehicle picked in selecao.html
- `veiculo_atual` -- plate of selected vehicle
- `modelo_veiculo` -- model name of selected vehicle

`frontend/client/js/config.js` is the single source of truth for `API_BASE_URL` (configured in config.js).
