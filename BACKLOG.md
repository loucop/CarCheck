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

- ✅ **A1 — Auditar XSS em todas as páginas admin** *(concluído em 2026-06-10)*
  Auditadas todas as páginas admin. 6 lacunas corrigidas — destaque para o vetor **alto**:
  `mapa_avaria_base64` (controlado pelo motorista) era inserido sem escape no `src` de `<img>`
  em `admin.js` (stored XSS). Também corrigidos `formatarData` (fallback cru), `formatCPF` e
  `nivelBadge` (fallbacks crus), e `escHtml` endurecido em `admin-bdv.html`/`admin-funcionarios.html`.
  Pendência menor não crítica: `frota.js`/`checklist.js` (telas do motorista) não foram auditadas
  neste escopo — ver **B7**.

- ✅ **A2 — Restringir CORS** *(concluído em 2026-06-10)*
  Allowlist de origens em `backend/index.js`. Host LAN `http://10.10.1.100:10081` sempre
  permitido por padrão; origens extras via env `CORS_ORIGINS` (separadas por vírgula), sem
  alterar código. Requests sem `Origin` (curl/health/apps nativos) continuam permitidos.
  `.env.example` atualizado.
  > ⚠️ **Ao publicar via Cloudflare:** adicionar o domínio público em `CORS_ORIGINS`
  > (ex.: `CORS_ORIGINS=https://carcheck.seudominio.com`) no `.env` de produção, senão o
  > frontend público será bloqueado pelo navegador.

- ⬜ **A3 — Submissão confia em `req.body.matricula` em vez de `req.user.matricula` (IDOR/spoof de identidade)**
  `checklist.service.js::createChecklist` recebe `req.body` direto do controller
  (`checklist.controller.js`: `createChecklist(conn, req.body)`) e usa **`data.matricula`** tanto no
  guard de duplicidade (`findPendingTodayByMatricula`) quanto no `INSERT` do checklist. A matrícula
  **não** é derivada do JWT — qualquer cliente autenticado pode enviar a matrícula de **outro
  motorista** no corpo e registrar checklist sob a identidade alheia (a camada Zod valida o formato,
  não a posse). O frontend preenche `matricula` a partir de `localStorage.usuario`, mas o servidor
  confia no que chega no body.
  - **Correção (não aplicar ainda):** o servidor deve **derivar a matrícula de `req.user`** (do token,
    populado pelo `auth.middleware`) e **ignorar** qualquer `matricula` no corpo — ou, no mínimo,
    rejeitar se `req.body.matricula !== req.user.matricula`.
  - **Mesmo audit nos endpoints de BDV:** `bdv.service.js` / `bdv.controller.js` (abertura de BDV,
    paradas, encerramento) seguem o mesmo padrão de passar `req.body` adiante — confirmar se a
    `matricula` (e o `veiculo_id`/ownership do BDV) também vêm do corpo e migrar para `req.user`.
  - Risco real de **vazamento/atribuição cruzada entre motoristas**; agrava-se sob multi-tenancy (M6),
    onde a matrícula precisa ser escopada por tenant. Relaciona-se a M4 (sessão via cookie) e M6.

---

## 🟡 Médio

- 🔵 **M1 — Adicionar cabeçalhos de segurança (helmet)** *(em andamento — opção 1)*
  `helmet` instalado e configurado em `backend/index.js`: CSP com `script-src 'self'` +
  **nonce por requisição** (`res.locals.cspNonce`), `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data:` (mapa de avaria base64), `frame-ancestors 'none'`, `object-src 'none'`,
  `base-uri 'self'`. `X-Powered-By` removido; `nosniff` e `X-Frame-Options` ativos. `hsts: false`
  (app em HTTP/LAN). Helmet aplica `script-src-attr 'none'` por padrão → bloqueia handlers inline
  (ver M1-b).
  > ✅ **Decisão (opção A):** M1 fica como **endurecimento apenas do backend**. O CSP das
  > **páginas HTML do admin** (servidas pelo servidor estático `:10081`, fora do alcance deste
  > backend) será entregue via **headers do Cloudflare** quando o sistema for publicado. Como
  > são páginas **estáticas**, usar CSP **baseado em hashes** (não nonces) na config do Cloudflare.
  > Reativar `hsts` nessa etapa (HTTPS). Itens M1-b/M1-c continuam válidos para reduzir a
  > dependência de `'unsafe-inline'` quando o CSP passar a valer para o HTML.

- ⬜ **M2 — Rate limiter resiliente**
  O limiter de login (`backend/index.js`) é **in-memory**: zera a cada restart e não funciona
  com múltiplas instâncias (PM2 cluster / réplicas). Migrar para store compartilhado (Redis)
  ou documentar que o deploy é single-process. Mensagem "15 minutos" está hardcoded — derivar
  de `LOGIN_WINDOW_MS`.

- ✅ **M3 — Vazamento de detalhes em erros 500** *(concluído em 2026-06-10)*
  Branch genérico (500 inesperado) em `errorHandler.middleware.js` agora retorna mensagem
  genérica quando `NODE_ENV === 'production'`, expondo `err.message` apenas em dev (igual ao
  branch de erros de banco). Branches de `err.statusCode` mantidos — mensagens são hardcoded ou
  template apenas com números validados (auditado). `.env.example` agora documenta `NODE_ENV`
  (controla a exposição de detalhe de erro) + as demais vars antes ausentes
  (`DB_CONNECTION_LIMIT`, `JWT_EXPIRES_IN`, `HOST`).
  > Lembrete: `NODE_ENV=production` deve estar setado no deploy para o gate valer.

- ✅ **M4 — JWT em localStorage + ausência de logout server-side** *(concluído em 2026-06-15)*
  > ✅ **Fase 3 concluída (2026-06-15) — auth cookie-only, irreversível.**
  > `auth.middleware.js`: removido o fallback do header `Authorization` (lê o token **só** do cookie
  > httpOnly). `auth.controller.js`: o login **não retorna mais o token no body** — entrega só via
  > cookie; o body devolve apenas `{ user }`. Com isto o M4 está completo (Fases 0→3): `JWT_EXPIRES_IN=2h`,
  > sessão em cookie httpOnly, `POST /api/logout`, `GET /api/me`, CSRF por Origin/Referer, e todo o
  > frontend migrado para `apiFetch`. Revogação real / refresh-token rotation seguem como **Opção D**
  > (ao ir a público) — ver nota abaixo.
  > ⚠️ **Deploy:** rodar `npm ci` + reiniciar o backend e validar login → fluxo completo → logout no
  > servidor. Após este deploy, clientes que ainda enviem só o header `Authorization` (páginas não
  > atualizadas) recebem 401 — confirmar que o frontend da Fase 2 está publicado.

  **Achado completo:**
  - Token JWT guardado em `localStorage` → roubável via XSS (vetor que A1/S1 vêm mitigando).
  - **Não existe endpoint de logout no backend.** Logout é 100% client-side: `localStorage.clear()`
    + redirect para `login.html` (11 pontos de `clear()` no frontend). O JWT em si nunca é invalidado.
  - **Sem revogação:** JWT é stateless com validade de **12h** (`JWT_EXPIRES_IN`). Um token capturado
    continua válido pelas 12h mesmo após "logout" — não há como forçar invalidação (ex.: suspeita de
    comprometimento, ou quando um funcionário é desativado).
  - **Dispositivos compartilhados:** motoristas usam celulares/tablets compartilhados; sem invalidação
    real, a janela de exposição de um token vazado é grande.

  **Implementação proposta (esta fase):**
  1. Migrar o token para **cookie `httpOnly` + `Secure` + `SameSite`** (não acessível via JS → fora do
     alcance de XSS). Exige tratamento de CSRF (token CSRF ou checagem de origem) e remover as ~30
     leituras de `localStorage.getItem('token')` que montam o header `Authorization`.
  2. Adicionar **`POST /api/logout`** que limpa o cookie de sessão (e, no mínimo, serve de ponto único
     para futura denylist).
  3. Encurtar **`JWT_EXPIRES_IN` para `2h`** — mitigação barata que reduz a janela de exposição já agora.

  > 🎯 **Opção D (arquitetura-alvo ao ir a público):** **refresh token rotation** — access token curto
  > (ex.: 15 min) + refresh token rotativo e revogável (armazenado server-side). Permite logout real e
  > revogação imediata. Adotar nesta arquitetura quando o sistema for exposto publicamente; conecta-se
  > ao store compartilhado do **M2** (denylist/refresh store).

  ### Plano de implementação (decisões confirmadas)

  **Decisões:** `cookie-parser` ✅ · helper `apiFetch` ✅ · CSRF por checagem de Origin ✅ · `GET /api/me` ✅

  **Restrições de arquitetura (norteiam tudo):**
  - Frontend `:10081` e backend `:3000` → **mesmo host (same-site), origem diferente (cross-origin)**.
    Cookie `SameSite=Lax` é enviado (porta não afeta "site"); CORS precisa de `credentials: true` +
    origem específica (allowlist do A2) e `fetch` com `credentials: 'include'`.
  - **HTTP na LAN agora, HTTPS (Cloudflare) depois** → flag `secure` do cookie deve ser **dirigida por
    env** (`false` na LAN, `true` em produção). `SameSite=None` impossível em HTTP → usar `Lax`.
  - **httpOnly quebra os guards client-side:** JS não lê mais o cookie. Os ~30 `getItem('token')` usados
    como "estou logado?" passam a checar presença de **`usuario`** (UX) + tratamento de **401 → login**
    (enforcement real no servidor). Maior fonte de edições.
  - **Estratégia incremental (sem big-bang):** backend aceita **cookie OU header `Authorization`** na
    transição; remove o fallback de header só na Fase 3.

  **Fase 0 — quick win independente**
  - `backend/.env.example` (+ `.env` do servidor): `JWT_EXPIRES_IN=2h` (reduz a janela já agora).

  **Fase 1 — Backend, retrocompatível (frontend atual continua funcionando)** ✅ *(implementado em 2026-06-11 — pendente deploy/verificação no servidor)*
  - `backend/package.json` / `package-lock.json`: adicionar **`cookie-parser`**.
  - `backend/index.js`: `app.use(cookieParser())`; adicionar **`credentials: true`** ao `cors({...})`.
  - `backend/src/controllers/auth.controller.js`: em `login`, `res.cookie('token', token, { httpOnly,
    sameSite:'lax', secure:<env>, maxAge:<= expiry>, path:'/' })` (ainda retorna token no body nesta
    fase); novo handler **`logout`** → `res.clearCookie('token', {mesmas opts})`.
  - `backend/src/middlewares/auth.middleware.js`: ler token de **`req.cookies?.token` primeiro, fallback
    para header `Authorization`**.
  - `backend/src/middlewares/csrf.middleware.js` **(novo)**: checagem de Origin/Referer em `POST`/`PATCH`
    reusando a allowlist do CORS. Sem dependência nova.
  - `backend/src/routes/index.js`: adicionar **`POST /api/logout`** → `authController.logout` (público);
    adicionar **`GET /api/me`** (valida cookie, retorna `req.user`); aplicar o CSRF middleware nas rotas
    de escrita.
  - `backend/.env.example`: documentar `COOKIE_SECURE` (ou que `NODE_ENV=production` dirige `secure`);
    opcional `COOKIE_DOMAIN` para o público.
  - **→ Deploy + verificar:** login ainda funciona e o cookie passa a ser setado; nada quebra.

  > ✅ **Implementado (2026-06-11):** `cookie-parser` instalado; CORS com `credentials:true` e
  > allowlist extraída para `src/config/cors.js` (fonte única, compartilhada com o CSRF);
  > novo `src/utils/cookie.js` (nome do cookie + opções set/clear idênticas + `parseDurationMs`
  > → `maxAge` derivado de `JWT_EXPIRES_IN`); `login` grava cookie httpOnly (e ainda retorna token
  > no body); novos `logout` (limpa cookie, público) e `me` (`GET /api/me`, autenticado);
  > `auth.middleware` lê cookie primeiro, com fallback para header (dual-read); novo
  > `src/middlewares/csrf.middleware.js` (Origin/Referer vs. allowlist, aplicado global p/ métodos
  > de escrita). `.env.example`: `COOKIE_SECURE` (dirige `secure`, **não** via NODE_ENV),
  > `COOKIE_DOMAIN`, `JWT_EXPIRES_IN=2h`. **Pendente:** `npm ci` + deploy + verificação no servidor.

  **Fase 2 — Frontend (página por página, cada uma entregável isolada)**
  - `frontend/client/js/config.js`: adicionar helper **`apiFetch(path, opts)`** que injeta
    `credentials:'include'` e centraliza tratamento de 401 → `login.html`.
  - `frontend/client/js/auth.js`: login com `credentials:'include'`; **remover `setItem('token')`**
    (mantém `setItem('usuario')`).
  - `frontend/client/js/admin.js` (8), `checklist.js` (2), `frota.js` (2, e remover write morto de
    `veiculo_tipo`): trocar header `Authorization` + `getItem('token')` por `apiFetch`; guards de token
    → presença de `usuario`; `clear()` de logout → `POST /api/logout` então limpar `usuario`.
  - `frontend/client/pages/menu.html` (4), `checklist.html` (4), `bdv.html` (16), `admin-bdv.html` (6),
    `admin-funcionarios.html` (4): mesmo padrão.
  - `frontend/client/pages/admin-dashboard.html`: sem fetch, mas trocar o **guard** `getItem('token')`
    por presença de `usuario` (ou `GET /api/me`).
  - **→ Verificar fluxo completo** (login → menu → seleção → checklist → bdv → admin → logout).

  > ✅ **Fase 2 concluída (2026-06-15):** todo o frontend migrado para a sessão por cookie httpOnly.
  > - **Base:** `config.js` (helper `apiFetch` com `credentials:'include'`; em 401 limpa estado,
  >   redireciona ao login e lança Error com `isAuthRedirect` p/ o catch do chamador pular alertas
  >   duplicados) e `auth.js` (login com `credentials:'include'`, **removido `setItem('token')`**).
  > - **`menu.html`:** guard por presença de `usuario`; `bdv/ativo` via `apiFetch` (load + `pageshow`);
  >   `fazerLogout` chama `POST /api/logout`.
  > - **`frota.js` + `selecao.html`:** `/veiculos` via `apiFetch`; guard `usuario`; removido write
  >   morto de `veiculo_tipo` (`selecao.html` não precisou de mudança — já carrega `config.js`).
  > - **`checklist.html` + `checklist.js`:** guards de load/`pageshow`/submit por `usuario`;
  >   `bdv/ativo` e `POST /checklist` via `apiFetch`; 401 manual removido; flow lock preservado.
  > - **`bdv.html`:** 16 sites migrados — abrir/encerrar BDV, paradas (saída/chegada), KM e estados
  >   404→abrir preservados; `apiFetch` em todas as chamadas; 401 manual removido.
  > - **Fluxo admin (`admin.js`, `admin.html`, `admin-bdv.html`, `admin-funcionarios.html`,
  >   `admin-dashboard.html`):** guards `token`→`usuario`+nível; relatórios, histórico, CRUD de
  >   funcionários e contagem de paradas via `apiFetch`; 401 manual removido; supressão `isAuthRedirect`
  >   nos catches. Navegação admin padronizada no **hub `admin-dashboard.html`** (botões "Voltar" de
  >   `admin.html` e `admin-bdv.html` apontam ao painel).
  > - **Pendente de verificação no servidor** (deploy manual): rodar o fluxo completo
  >   (login → menu → seleção → checklist → bdv → admin → logout) confirmando que nada usa mais o
  >   header `Authorization` e que o cookie carrega a sessão.

  **Fase 3 — Limpeza do backend (após todo o frontend migrado — passo irreversível)** — ⬅️ **único passo restante do M4**
  - `backend/src/middlewares/auth.middleware.js`: **remover o fallback de header `Authorization`**
    (cookie-only).
  - `backend/src/controllers/auth.controller.js`: **parar de retornar `token` no body** do login.
  - `backend/.env.example` / `.env`: confirmar `JWT_EXPIRES_IN=2h` alinhado ao `maxAge` do cookie.
  > ⚠️ **Pré-requisito (passo irreversível):** só executar **após** a verificação da Fase 2 no
  > servidor (deploy manual) confirmar que nenhum cliente ainda depende do header/token no body —
  > caso contrário, sessões em páginas não atualizadas quebram.

  **Ordem:** Fase 0 → Fase 1 (cookie-parser+CORS → middleware dual-read → controller set/clear → rotas
  logout/me → CSRF) → deploy/verificar → Fase 2 (`config.js` primeiro, depois `auth.js`, depois demais
  páginas) → Fase 3.
  > ⚠️ **Sem acesso ao servidor (deploy manual):** cada fase exige verificação do usuário no servidor
  > (e `npm ci` após adicionar `cookie-parser`). Ao ir a público: virar `secure:true`; se frontend/API
  > ficarem em sites realmente distintos, mudar para `SameSite=None; Secure` + **CSRF double-submit** →
  > ponte para a **Opção D**.

- 🔵 **M5 — Vulnerabilidades de dependências (npm audit)** *(parcialmente concluído em 2026-06-10)*
  Estado inicial: 4 vulnerabilidades (2 moderadas, 2 altas). Após `npm audit fix`: **2 altas restantes**.
  - ✅ `qs` (**moderada**, DoS remoto em `qs.stringify`) via `express` — **corrigido**: `express`
    resolvido para `4.22.2` no `package-lock.json`.
  - ⚠️ `tar` ≤7.5.10 (**alta** ×2, path traversal/file overwrite na extração) via
    `@mapbox/node-pre-gyp` → `bcrypt`. **Não auto-corrigível** (`npm audit fix` e `--force` não
    alteram nada — npm sem caminho de fix). É **exploração só em tempo de instalação** (extração do
    binário nativo do bcrypt), **não alcançável no runtime do servidor** → **risco aceito** por ora.
    Eliminação real depende de trocar a cadeia nativa — ver **M5-b**.

- ⬜ **M5-b — Avaliar migração `bcrypt` → `bcryptjs`** *(sessão dedicada)*
  `bcryptjs` é puro-JS: remove `@mapbox/node-pre-gyp` + `tar` (zera as 2 altas restantes do M5) e
  elimina a dependência de build nativo. API quase drop-in. Requer ajuste em `auth.service.js` e no
  script `scripts/migrate-passwords.js`, além de teste no servidor (hashes `$2a$`/`$2b$` permanecem
  compatíveis). Fazer em sessão própria, com validação de login antes/depois.

- ⬜ **M6 — Planejamento de multi-tenancy (pré-requisito para vender a clientes externos)**
  Hoje o sistema é single-tenant (uma organização cliente). Antes de comercializar para **clientes
  externos**, planejar o isolamento de dados por tenant. Pontos a desenhar **antes** de escrever código:
  - **Modelo de isolamento:** coluna `tenant_id` em todas as tabelas (shared schema) vs. schema/DB por
    cliente. Avaliar o campo `coligada` já existente — é sub-divisão *dentro* de um tenant, não tenant.
  - **Escopo em TODAS as queries:** `funcionarios`, `veiculos`, `checklists`, `bdv`, `bdv_paradas`
    precisam filtrar por tenant; risco alto de vazamento entre clientes se esquecido em uma query.
  - **Auth/JWT:** incluir `tenant_id` no token e aplicar em `auth.middleware` + repositórios.
  - **Onboarding/admin:** criação de tenant, primeiro admin, billing, limites por plano.
  - **Conexão com M4/M2:** sessão, revogação e rate limit passam a ser por-tenant.
  Item de **planejamento/arquitetura** — produzir um RFC/decisão antes de implementar. Bloqueante para
  a meta de negócio de venda externa.

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

- ⬜ **B7 — Auditar XSS nas telas do motorista**
  A auditoria de A1 cobriu apenas as páginas admin. Revisar os sinks de `innerHTML` em
  `frota.js`, `checklist.js` e `bdv.html` (lado motorista) e confirmar escape consistente.
  Risco menor (dados em geral próprios do usuário), mas fecha a cobertura.

- ⬜ **M1-b — Converter handlers inline `on*=` para `addEventListener`** *(sub-item de M1)*
  Para chegar a `script-src 'self'` sem `'unsafe-inline'`/`script-src-attr`, eliminar os ~19
  handlers inline (`onclick`/`onload`/etc.) nas páginas admin + `verDetalhes` em `admin.js`.
  Nonce/hash **não** cobrem handlers inline — precisam virar `addEventListener`. Pré-requisito
  para um CSP de script estrito quando as páginas HTML passarem a receber CSP.

- ⬜ **M1-c — Mover estilos inline para CSS** *(sub-item de M1)*
  Para remover `'unsafe-inline'` de `style-src`, migrar os ~76 atributos `style="..."` (30 em
  HTML estático + 46 gerados em `admin.js`) e os ~652 linhas de blocos `<style>` para classes
  em `style.css`. Maior esforço; ganho cosmético/defesa-em-profundidade, não fecha exploit ativo.

- ⬜ **B8 — Gerenciamento de processo (PM2 ou serviço do Windows)**
  Hoje o backend morre quando o terminal é fechado e não reinicia sozinho após crash. Configurar
  **PM2** (ou um serviço do Windows) para manter o processo vivo, reiniciar em falha e subir no boot.
  Correção rápida (~30 min). **Obrigatório antes do deploy público.**

- ⬜ **B9 — Suíte de testes de integração**
  No mínimo, testes de rota da API cobrindo: `login`, submissão de `checklist`, abertura/encerramento
  de `BDV`, e endpoints `admin`. Expande/concretiza o **B5**. **Obrigatório antes de fazer fork para o
  sistema de supervisor ou de vender a clientes externos** (rede de segurança contra regressões).

- ⬜ **B10 — Sistema de migrations de banco**
  Mudanças de schema são aplicadas **manualmente, sem rastreamento** (ver memória/decisão atual).
  Adotar uma ferramenta de migrations versionadas (ex.: node-pg-migrate equivalente p/ MariaDB, Umzug,
  Flyway) com histórico aplicado. **Obrigatório antes do deploy multi-cliente/multi-tenant** (M6) —
  sem isso, sincronizar schema entre tenants/ambientes é inviável.

---

## 🚀 Deploy em Produção (checklist)

Itens a executar/validar ao publicar o sistema (ex.: via Cloudflare). Vários se conectam
a decisões já registradas acima (A2, M1, S3).

- ⬜ **Habilitar HTTPS via Cloudflare** (terminação TLS no edge).
- ⬜ **Adicionar o domínio público em `CORS_ORIGINS`** no `.env` de produção
  (ex.: `CORS_ORIGINS=https://carcheck.seudominio.com`) — ver **A2**.
- ⬜ **Configurar headers de CSP nos arquivos estáticos via Cloudflare Transform Rules**
  (**baseado em hashes**, substitui a abordagem de nonce do backend, que não alcança o HTML) — ver **M1**.
- ⬜ **Reativar HSTS no helmet** (`hsts` está desativado para HTTP/LAN em `backend/index.js`) — ver **M1**.
- ⬜ **Ajustar `trust proxy`** — aumentar a contagem de saltos se houver mais de um proxy
  na frente do Express (atualmente `app.set('trust proxy', 1)`), para que o rate limiter de
  login use o IP real do cliente — ver **S3**.

---

## ✅ Concluído (referência)

- ✅ **S1** — Escape de XSS em campos controlados no `admin.js` (`312a18d` + hardening em `29e3159`)
- ✅ **S2** — Assertion de `JWT_SECRET` no startup (`9712695`)
- ✅ **S3** — Rate limiting de login, 5 tentativas/IP/15min (`668ddc4`); refinado para contar só falhas + `trust proxy` (`29e3159`)
- ✅ Persistência do link `checklist_id` no BDV (`29e3159`)
- ✅ Correção de bypass do flow lock via botão voltar / bfcache (`f08ed77`, `a82b3d4`)
