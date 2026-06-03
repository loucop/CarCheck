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
                    image.service.js
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
                pages/                  login, menu, selecao, checklist, admin
                js/                     auth, checklist, admin, frota, pdf-engine, config
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
