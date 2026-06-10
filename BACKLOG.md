# BACKLOG — CarCheck

> Lista de itens pendentes priorizada (Crítico → Baixo), reconstruída a partir do
> estado atual do código em **2026-06-10**.
>
> Legenda de status: ⬜ pendente · 🔵 em andamento · ✅ concluído
>
> **Nota:** a numeração de segurança chegou até **S3** (S1 XSS, S2 JWT secret, S3 rate
> limit). Se existiam itens **S4+** da auditoria original, eles foram perdidos junto com
> o chat — rodar `/security-review` novamente para confirmar se sobrou algo.

---

## 🔴 Crítico

- ✅ **C1 — Criar coluna `bdv.checklist_id` no MariaDB** *(aplicado em 2026-06-10)*
  O código (`bdv.repository.js::createBDV`, `bdv.service.js`, `checklist.repository.js::findPendingTodayByMatricula`)
  já lê/grava `checklist_id`, mas a coluna pode não existir no banco. Como o projeto
  **não usa migrations** (alterações são manuais), enquanto a coluna não existir **toda
  abertura de BDV lança erro em runtime**.
  ```sql
  ALTER TABLE bdv ADD COLUMN checklist_id BIGINT NULL,
    ADD CONSTRAINT fk_bdv_checklist FOREIGN KEY (checklist_id) REFERENCES checklists(id);
  ```
  Aplicar em produção **antes** do próximo deploy. Validar fluxo de duas viagens no mesmo dia.

---

## 🟠 Alto

- ⬜ **A1 — Auditar XSS em todas as páginas admin**
  `escHtml` existe em `admin.js`, `admin-bdv.html`, `admin-funcionarios.html` e `bdv.html`,
  mas não há garantia de que **todas** as interpolações em `innerHTML` estejam escapadas.
  Revisar cada uso de `innerHTML` (lista em `admin-bdv.html`, `admin-funcionarios.html`,
  `bdv.html`, `frota.js`, `checklist.js`) e confirmar que dados vindos da API/usuário passam
  por `escHtml`. Vetor já explorado uma vez (S1) — alto risco residual.

- ⬜ **A2 — Restringir CORS**
  `backend/index.js:31` usa `app.use(cors())` sem configuração → **qualquer origem** acessa
  a API. Restringir a uma allowlist de origens (host do frontend) via `cors({ origin: [...] })`.

---

## 🟡 Médio

- ⬜ **M1 — Adicionar cabeçalhos de segurança (helmet)**
  Não há `helmet` nem CSP/X-Frame-Options/X-Content-Type-Options. Dado o histórico de XSS,
  uma **Content-Security-Policy** é defesa em profundidade valiosa. Avaliar impacto dos
  `style`/`onclick` inline existentes ao definir a CSP.

- ⬜ **M2 — Rate limiter resiliente**
  O limiter de login (`backend/index.js`) é **in-memory**: zera a cada restart e não funciona
  com múltiplas instâncias (PM2 cluster / réplicas). Migrar para store compartilhado (Redis)
  ou documentar que o deploy é single-process. Mensagem "15 minutos" está hardcoded — derivar
  de `LOGIN_WINDOW_MS`.

- ⬜ **M3 — Vazamento de detalhes em erros 500**
  `errorHandler.middleware.js` retorna `err.message` cru no fallback genérico (sem checar
  `NODE_ENV`). Em produção, mensagens internas podem vazar ao cliente. Padronizar para mensagem
  genérica quando `NODE_ENV === 'production'`. Confirmar que `NODE_ENV=production` está setado no deploy.

- ⬜ **M4 — JWT em localStorage**
  Token guardado em `localStorage` é roubável via XSS. Considerar cookie `httpOnly`+`SameSite`
  (exige ajuste de CSRF). Decisão arquitetural — avaliar custo/benefício.

---

## 🟢 Baixo

- ⬜ **B1 — Remover `console.log` de debug remanescentes**
  `admin.js:184-185` (`[DEBUG]` dumpando registro completo — PII no console),
  `auth.js:8,23`, `checklist.js`, `frota.js`, `pdf-engine.js`. Limpeza de higiene.

- ⬜ **B2 — Política de senha fraca**
  `validate.middleware.js` exige senha com **mín. 6 caracteres** no cadastro. Considerar
  política mais forte (comprimento + complexidade) conforme exigência do cliente.

- ⬜ **B3 — Limite de payload de 50mb**
  `express.json({ limit: '50mb' })` é amplo (necessário para o mapa de avaria em base64).
  Avaliar reduzir o limite global e isolar o upload pesado em rota dedicada (superfície de DoS).

- ⬜ **B4 — Query não-sargável no guard diário**
  `findPendingTodayByMatricula` usa `DATE(data_inspecao) = CURDATE()` (não usa índice).
  Irrelevante no volume atual; reescrever com range (`>= CURDATE() AND < CURDATE()+1`) se a
  tabela `checklists` crescer.

- ⬜ **B5 — Sem testes automatizados**
  Projeto não possui testes (decisão atual). Caso evolua, priorizar testes dos serviços
  transacionais (`checklist.service`, `bdv.service` — locks `FOR UPDATE`, validação de KM).

- ⬜ **B6 — Housekeeping do repositório**
  Remover arquivos vazios soltos no working dir (`git`, `main`) e decidir sobre `LICENSE`
  (untracked). Adicionar ao `.gitignore` se necessário.

---

## ✅ Concluído (referência)

- ✅ **S1** — Escape de XSS em campos controlados no `admin.js` (`312a18d` + hardening em `29e3159`)
- ✅ **S2** — Assertion de `JWT_SECRET` no startup (`9712695`)
- ✅ **S3** — Rate limiting de login, 5 tentativas/IP/15min (`668ddc4`); refinado para contar só falhas + `trust proxy` (`29e3159`)
- ✅ Persistência do link `checklist_id` no BDV (`29e3159`)
- ✅ Correção de bypass do flow lock via botão voltar / bfcache (`f08ed77`, `a82b3d4`)
