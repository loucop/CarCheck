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

- ⬜ **M4 — JWT em localStorage**
  Token guardado em `localStorage` é roubável via XSS. Considerar cookie `httpOnly`+`SameSite`
  (exige ajuste de CSRF). Decisão arquitetural — avaliar custo/benefício.

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
