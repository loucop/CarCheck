# CarCheck v3.0

**Sistema de inspeção e auditoria de frota para equipes de segurança operacional.** Substitui checklists em papel por um fluxo de dados digital em tempo real — pronto para mobile, seguro via JWT e construído para uptime 
contínuo.

---

## Visão Geral
O CarCheck é um sistema de gestão de frota de nível industrial construído para a **Angels Vigilância**. Ele digitaliza o fluxo de inspeção veicular para agentes de campo e fornece aos administradores um painel de auditoria em tempo real, visualização de danos, e gestão de pessoal — tudo protegido por autenticação JWT e senhas criptografadas com Bcrypt.

---

## Arquitetura



**Stack Tecnológica:**
| Camada | Tecnologia |
|---|---|
| **Frontend** | HTML5, CSS3, Vanilla JS (ES6+) |
| **Backend** | Node.js, Express.js |
| **Banco de Dados** | MariaDB (Relacional, ACID) |
| **Autenticação** | JWT (jsonwebtoken) + Bcrypt |

---

## Principais Recursos
- **Fluxo do Motorista:** Checklist estruturado e mapa de avarias via canvas.
- **Painel Administrativo:** Auditoria em tempo real, visualização de danos e gestão de frota.
- **Segurança:** Autenticação JWT, Bcrypt e tratamento global de erros.

---

## Instalação
1. `git clone https://github.com/loucop/CarCheck.git`
2. `cd CarCheck/backend`
3. `npm install`
4. `cp .env.example .env` (Configure suas variáveis)
5. `node index.js`

---

## Autor
**Leonardo Andrade** | [github.com/loucop](https://github.com/loucop)
