# CarCheck v3.0

**Real-time fleet inspection and audit system for operational security teams.**  
Replaces paper checklists with a secure, mobile-ready digital pipeline — JWT-authenticated, Bcrypt-hardened, and built for 24/7 uptime.

---

## Overview

CarCheck v3.0 is a production-grade fleet management system built for **Angels Vigilância**, a Brazilian security operations company. It digitizes the full vehicle inspection workflow for field agents and provides administrators with a real-time audit dashboard, visual damage tracking, and personnel management — all secured by JWT authentication and Bcrypt password hashing.

Built to run on low-end smartphones in the field without requiring any app installation.

---

## Architecture

```
Driver (Mobile Browser)
    │
    ▼
Frontend (HTML5 + Vanilla JS)
    │  JWT in Authorization header
    ▼
Express.js REST API (Node.js)
    │  Auth middleware intercepts all /api/* routes
    ▼
MariaDB (Relational, ACID-compliant)
    │
    ▼
Admin Dashboard (Real-time audit panel)
```

**Stack:**

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JS (ES6+) |
| Backend | Node.js, Express.js |
| Database | MariaDB (relational, ACID, foreign keys) |
| Auth | JWT (jsonwebtoken) + Bcrypt |
| Validation | Zod |

---

## Features

### Driver Flow
- Structured multi-category checklist (brakes, lights, oil, tires, mirrors, seatbelts, etc.)
- Mandatory observation field triggered on any "FAIL" item
- Interactive damage map via HTML5 `<canvas>` — drivers draw directly on a vehicle schematic using touch or mouse input
- Canvas output serialized to Base64 and attached to the inspection payload

### Admin Panel
- Real-time audit table of all submitted inspections
- Filter by driver, vehicle, or inspection status (OK / FAIL)
- Modal viewer renders the exact damage map drawn by the driver — serves as legal/technical proof of vehicle condition before dispatch
- Personnel management: register new employees with role-based access (`admin` / `motorista`)

### Security
- JWT issued on login, verified by middleware on all protected routes
- Bcrypt hashing — no plaintext passwords stored
- Role-based route protection on both frontend and backend
- Global error handler prevents server crashes from malformed requests or DB failures
- BigInt serialization patch for MariaDB compatibility

---

## Project Structure

```
CarCheck/
├── backend/
│   ├── index.js                  # Entry point, Express config, global patches
│   ├── .env.example              # Environment variable template
│   ├── public/                   # Static assets (vehicle schematic image)
│   ├── scripts/
│   │   └── migrate-passwords.js  # Bcrypt migration utility
│   └── src/
│       ├── config/               # Database connection pool
│       ├── controllers/          # Request handlers (auth, checklist, admin, vehicle)
│       ├── middlewares/          # JWT auth, error handler, request validation
│       ├── repositories/         # DB query layer (checklist, employee, vehicle)
│       ├── routes/               # API route definitions
│       ├── services/             # Business logic (auth, checklist, image processing)
│       └── utils/                # Constants, response helpers
└── frontend/
    └── client/
        ├── css/                  # Styles
        ├── js/                   # Auth, checklist, admin, fleet, PDF engine
        └── pages/                # login, menu, vehicle selection, checklist, admin
```

---

## API Routes

| Method | Route | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Authenticate and receive JWT |
| GET | `/api/veiculos` | JWT | List active fleet vehicles |
| POST | `/api/checklist` | JWT | Submit inspection with damage map |
| GET | `/api/admin/checklists` | JWT + Admin | Retrieve all inspections |
| POST | `/api/admin/funcionarios` | JWT + Admin | Register new employee |

---

## Installation

```bash
git clone https://github.com/loucop/CarCheck.git
cd CarCheck/backend
npm install
cp .env.example .env
```

Edit `.env` with your database credentials and JWT secret, then:

```bash
node index.js
```

Server starts on `http://localhost:3000` by default.

**Frontend:** Open any `.html` file in `frontend/client/pages/` directly in a browser, or serve via any static file server.

---

## Environment Variables

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=your_user
DB_PASSWORD=your_password
DB_NAME=carcheck
JWT_SECRET=your_jwt_secret
PORT=3000
```

---

## Inspection Payload Example

```json
{
  "veiculo_id": "12",
  "matricula": "202609",
  "km_entrada": 142050,
  "local_origem": "Base Central",
  "local_destino": "Posto Alpha",
  "itens_status": {
    "Buzina": { "status": "OK", "obs": "" },
    "Farol Baixo": { "status": "RUIM", "obs": "Right headlight bulb burnt out" }
  },
  "mapa_avaria_base64": "data:image/png;base64,..."
}
```

---

## License

MIT License. Free to use, adapt, and distribute.

---

## Author

**Leonardo Andrade**  
IT Professional | Backend Developer | AI Systems  
Rio de Janeiro, Brazil  
[github.com/loucop](https://github.com/loucop)
