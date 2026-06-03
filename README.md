---

## API Routes

| Method | Route                        | Auth         | Description              |
|--------|------------------------------|--------------|--------------------------|
| POST   | /api/login                   | None         | Authenticate, receive JWT|
| GET    | /api/veiculos                | JWT          | List fleet vehicles      |
| POST   | /api/checklist               | JWT          | Submit vehicle inspection|
| POST   | /api/bdv                     | JWT          | Open trip log (BDV)      |
| POST   | /api/bdv/:id/paradas         | JWT          | Register stop            |
| PATCH  | /api/bdv/:id/paradas/:pid    | JWT          | Close stop               |
| PATCH  | /api/bdv/:id/encerrar        | JWT          | Close trip               |
| GET    | /api/admin/relatorio         | JWT + Admin  | Inspection report        |
| GET    | /api/admin/bdv               | JWT + Admin  | Trip report              |
| POST   | /api/admin/funcionarios      | JWT + Admin  | Register employee        |

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
