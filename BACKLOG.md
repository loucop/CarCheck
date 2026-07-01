# BACKLOG — CarCheck

> Itens **pendentes** e **em andamento**, priorizados (Crítico → Baixo).
> Reconstruído a partir do código em **2026-06-10**; dividido por status em **2026-06-25**.
>
> Legenda de status: ⬜ pendente · 🔵 em andamento · ✅ concluído
>
> 📦 **Itens concluídos (✅)** e as porções já entregues dos itens 🔵 foram movidos para
> **[`BACKLOG_DONE.md`](BACKLOG_DONE.md)** (referência, raramente carregado). Os 🔵 abaixo
> trazem **só o que falta** — o histórico completo está no DONE.
>
> **Nota:** a numeração de segurança chegou até **S3** (todos concluídos → DONE). Se existiam
> itens **S4+** da auditoria original, foram perdidos com o chat — rodar `/security-review`
> para confirmar se sobrou algo.

---

## 🧭 Índice (escolha 1 item por sessão)

> Carregue **só esta tabela** para escolher o trabalho da sessão; o corpo detalhado de cada
> item está abaixo (faça `grep` pelo ID). Status: ⬜ pendente · 🔵 em andamento · ⛔ bloqueado.
> Domínio: **Front** (UI/JS cliente) · **Back** (Express/serviço) · **DB** (schema/queries) ·
> **Infra** (deploy/SO/processo) · **Arch** (multi-tenancy) · **Deps**/**Test**/**Docs**.

| ID | Domínio | Pri | St | Resumo |
|------|-----------|----|----|--------|
| A7 | Front | 🟠 | 🔵 | UI de correção do vistoriador (slice 4; backend pronto) |
| M1 | Back/Infra | 🟡 | 🔵 | Helmet (backend ✅); CSP do HTML via Cloudflare |
| M2 | Back/Infra | 🟡 | ⬜ | Rate limiter resiliente (store compartilhado) |
| M6 | Arch | 🟡 | ⬜ | Planejamento de multi-tenancy (RFC antes de código) |
| M7 | Back/Infra | 🟡 | 🔵 | Rate limit global (`/health` slice ✅; correção/paradas pendente) |
| M9 | Arch | 🟡 | ⬜ | Chokepoint central de escopo de tenant (pré-req M6) |
| M11 | Back+DB | 🟡 | ⬜ | Reconciliação de drift da âncora de KM (job/relatório) |
| M12 | DB | 🟡 | ⬜ | Invariantes no nível do banco (CHECK/unique) |
| M15 | Front/Infra | 🟡 | ⬜ | Offline/fila de submissão (PWA, exige HTTPS) |
| B2 | Back | 🟢 | ⬜ | Política de senha mais forte |
| B3 | Back | 🟢 | ⬜ | Limite de payload (rever se ainda distinto vs A4) |
| B5 | Test | 🟢 | ⬜ | Sem testes automatizados (priorizar serviços transacionais) |
| M1-b | Front | 🟢 | ⬜ | Handlers inline `on*=` → `addEventListener` (sub-M1) |
| M1-c | Front | 🟢 | ⬜ | Estilos inline → CSS (sub-M1) |
| B8 | Infra | 🟢 | ⛔ | NSSM serviço Windows (config ✅; instalação exige admin) |
| B9 | Test | 🟢 | ⬜ | Suíte de testes de integração (rotas da API) |
| B10 | DB/Infra | 🟢 | ⬜ | Sistema de migrations de banco (pré-req M6) |
| B11 | Docs/DB | 🟢 | ⬜ | `STORAGE.md` (medir tamanho real em produção) |
| B12 | Front | 🟢 | ⬜ | `bdv.html` ignora `json.code` (sem auto-roteamento) |
| B13 | Back+DB | 🟢 | ⬜ | Paginação keyset (OFFSET degrada em offsets profundos) |
| B14 | DB/Infra | 🟢 | ⬜ | Estratégia de retenção / particionamento |
| B15 | DB | 🟢 | ⬜ | `itens_status` JSON opaco em coluna TEXT |
| B16 | Back | 🟢 | ⬜ | Cap de paradas por BDV |
| B17 | DB/Infra | 🟢 | ⬜ | Versionar `schema.sql` no repo (pré-req B10/M9) |
| B18 | Back | 🟢 | ⬜ | Drain do pool no shutdown gracioso |
| B19 | Back/Infra | 🟢 | ⬜ | TLS no banco + remover `allowPublicKeyRetrieval` |
| B20 | DB | 🟢 | ⬜ | Verificar que `auto_increment` é `BIGINT` (checup único) |
| B22 | Back | 🟢 | ⬜ | Sem compressão (gzip/brotli) no backend |
| B24 | Front | 🟢 | ⬜ | Atributos de teclado mobile nos inputs |
| I1 | Infra | 🔴 | ⬜ | Windows Server 2012 fora de suporte (bloqueia público) |
| Deploy | Infra | — | ⬜ | Checklist de produção (HTTPS, CORS, CSP, HSTS, trust proxy) |

---

## 🔴 Crítico

_Nenhum item crítico pendente._ (C1 concluído → [`BACKLOG_DONE.md`](BACKLOG_DONE.md).)

---

## 🟠 Alto

- 🔵 **A7 — Capacidades de correção/override do vistoriador** *(backend slices 1–3 ✅ em prod; slice 4 (UI) pendente)*
  Backend completo e verificado em produção: tabelas de auditoria (`correcoes`/`correcoes_campos`),
  `correcao.service`, endpoints `PATCH /api/correcoes/*`, realinhamento de âncora de KM
  (`PATCH /correcoes/veiculo/:id/km`), histórico (`GET /api/correcoes`) e leitura dos dashboards admin
  relaxada para `authorize(VISTORIADOR, ADMIN)`. O vistoriador já pode executar todas as correções via
  API. **Especificação completa, decisões §6, schema SQL e slices 1–3 → [`BACKLOG_DONE.md`](BACKLOG_DONE.md).**
  - ⬜ **Slice 4 — UI:** afordância de "Correção" nas telas de auditoria (gated em
    `usuario.nivel_acesso in (vistoriador, admin)`), formulário pré-preenchido, **diff** (antigo→novo) +
    **`motivo` obrigatório** quando a edição quebra a monotonicidade (seta `km_override`), e **timeline de
    auditoria por registro** (lê `GET /api/correcoes`).
    > ⏸ **Deferido — pendente clarificação de fluxo operacional com o setor de logística:**
    > (a) o vistoriador reutiliza o `checklist.html` existente ou precisa de um formulário de inspeção
    > pós-retorno separado? (b) qual é o fluxo diário completo do vistoriador, do início ao fim?
  - ⚠️ Bug correlato **ainda pendente** no backend já entregue: **M11** (drift da âncora de KM).
    Liga-se a A6 (role-aware), A3, M6. (**A13** — flag `km_override` derivada no servidor — concluído,
    ver `BACKLOG_DONE.md`.)

- ⬜ **A11 fase 2 — Externalizar imagens para fora da linha (object storage)** *(diferida; fase 1 concluída — ver `BACKLOG_DONE.md`)*
  A fase 1 (não trafegar `mapa_avaria_base64` em listas + endpoint de detalhe sob demanda) está
  **concluída**. Resta a fase 2, de maior fôlego e dependente de infra: mover o PNG para fora da linha
  (filesystem / object storage Cloudflare R2/S3), guardando só a URL/chave — mantém `checklists`
  pequena/quente e torna o particionamento/arquivamento trivial. Pareia com **B14** (retenção) e só
  vale a pena junto da publicação/Cloudflare.

---

## 🟡 Médio

- 🔵 **M1 — Cabeçalhos de segurança (helmet)** *(backend endurecido; CSP do HTML admin deferido p/ Cloudflare)*
  `helmet` + CSP nonce-based já configurados no backend (`index.js`). Decisão (opção A): M1 é
  **endurecimento só do backend**; o CSP das páginas HTML admin (servidas pelo `:10081`) virá via
  **headers do Cloudflare** ao publicar (CSP por **hash**, não nonce), reativando `hsts` (HTTPS) nessa
  etapa. **Detalhes da config do helmet → [`BACKLOG_DONE.md`](BACKLOG_DONE.md).** Pendentes os sub-itens
  **M1-b** / **M1-c** (abaixo, na seção Baixo) — reduzem a dependência de `'unsafe-inline'` quando o CSP
  passar a valer para o HTML.

- ⬜ **M2 — Rate limiter resiliente**
  O limiter de login (`backend/index.js`) é **in-memory**: zera a cada restart e não funciona
  com múltiplas instâncias (PM2 cluster / réplicas). Migrar para store compartilhado (Redis)
  ou documentar que o deploy é single-process. Mensagem "15 minutos" está hardcoded — derivar
  de `LOGIN_WINDOW_MS`.

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

- 🔵 **M7 — Rate limiting além do login + `/health` como vetor de DoS** *(achado na auditoria 2026-06-24)*
  Hoje só `POST /api/login` é limitado; o resto é irrestrito. O guard de checklist-por-dia já limita
  bem o spam de checklist. **`/health` já resolvido** (slice concluído — ver DONE). Falta:
  - As rotas de correção (A7) são irrestritas — um token de vistoriador comprometido inunda a auditoria
    append-only.
  - `addParada` não tem cap (ver **B16**).
  - **Ação:** rate limiter global por IP/usuário antes de ir a público. Conecta ao store compartilhado
    do **M2** (o limiter atual é in-memory / single-process).

- ⬜ **M9 — Chokepoint central de escopo de tenant (pré-requisito arquitetural do M6)** *(achado na auditoria 2026-06-24)*
  Hoje `coligada` viaja no JWT mas **nenhuma query escopa por ela** — cada repositório recebe filtros
  explícitos e confia no chamador. Ao adicionar `tenant_id` (M6), o modo de falha é catastrófico e
  silencioso: **um único `WHERE tenant_id=?` esquecido em ~20 métodos de repositório = vazamento entre
  clientes.** Não retrofitar query-a-query na mão.
  - **Ação:** arquitetar um chokepoint **antes** de escrever código de tenant — wrapper de repositório /
    query builder que injeta o predicado de tenant centralmente, ou escopo de conexão por tenant — de
    modo que "esqueci de filtrar" seja **estruturalmente impossível**, não uma esperança de code-review.
    Subitem de planejamento do **M6**; pareia com **B10/B17** (migrations/schema versionado).

- ⬜ **M11 — Reconciliação de drift da âncora de KM** *(achado na auditoria 2026-06-24)*
  `veiculos.km_atual` é a âncora monotônica canônica, mas correções podem dessincronizá-la: o caminho de
  override **não** realinha a âncora (§6.2 deixa o realinhamento como endpoint manual com helper de
  recompute "disponível mas não auto-disparado"). Um vistoriador que corrige um registro mas esquece de
  realinhar deixa o piso de KM do próximo motorista errado.
  - **Ação:** ligar um **job periódico de reconciliação** (ou relatório admin "checar drift") que
    sinalize qualquer veículo onde `km_atual ≠ MAX(último checklist km_entrada, último BDV encerrado
    km_final)`. **Detecção, não auto-correção** — preserva o princípio §6.2 de "âncora é sempre decisão
    explícita". O helper de recompute já existe.

- ⬜ **M12 — Invariantes no nível do banco (defense-in-depth)** *(achado na auditoria 2026-06-24)*
  Toda regra vive em código de app; uma escrita direta no banco, um segundo escritor futuro ou um bug
  fura tudo. Adicionar invariantes no schema (MariaDB 10.4 impõe):
  - `CHECK (km_atual >= 0)`, `CHECK (km_entrada >= 0)`, etc.
  - "Um BDV aberto por veículo / por motorista" é imposto só por lógica de app + `FOR UPDATE`. O MariaDB
    não tem índice único filtrado, mas dá para garantir com uma tabela pequena `bdv_ativos`
    (`unique(veiculo_id)`, `unique(matricula)`) escrita na mesma transação. Hoje a serialização por
    `FOR UPDATE` é adequada; revisitar se surgir um segundo caminho de escrita.

- ⬜ **M15 — Sem capacidade offline / fila de submissão (campo com cobertura instável)** *(auditoria mobile 2026-06-24)*
  Não há service worker, `navigator.onLine`, retry, nem fila de submissão. Um checklist/parada enviado
  numa conexão que cai é **simplesmente perdido** — o `fetch` rejeita, exibe `alert` e o motorista
  precisa **redigitar tudo** (incl. redesenhar o mapa de avaria). Para o caso de uso central (motorista
  em área de cobertura ruim) isso é uma fraqueza real de disponibilidade.
  - **Atenuantes já existentes:** a recuperação server-side do **A6/A8** (`/bdv/ativo`,
    `/checklist/pendente` + hidratação) protege contra **perda de contexto** (veiculo_id) por
    eviction de `localStorage` no meio do fluxo; e os guards de duplicidade impedem **registro duplo**.
    Então o problema é re-trabalho/UX, não corrupção.
  - **Direção:** fila local (IndexedDB) + retry com backoff, idealmente via service worker
    (Background Sync) — **exige HTTPS** (deploy público / Cloudflare). Decisão de produto: quanto de
    offline o campo realmente exige. Relaciona-se ao item de PWA/HTTPS do checklist de deploy.

---

## 🟢 Baixo

- ⬜ **B2 — Política de senha fraca**
  `validate.middleware.js` exige senha com **mín. 6 caracteres** no cadastro. Considerar
  política mais forte (comprimento + complexidade) conforme exigência do cliente.

- ⬜ **B3 — Limite de payload de 50mb**
  `express.json({ limit: '50mb' })` é amplo (necessário para o mapa de avaria em base64).
  Avaliar reduzir o limite global e isolar o upload pesado em rota dedicada (superfície de DoS).
  *(Nota: o A4-H2 já trocou o `50mb` global por `100kb` default + `1mb` só no checklist — confirmar se
  este item ainda é distinto ou pode ser fechado contra o A4.)*

- ⬜ **B5 — Sem testes automatizados**
  Projeto não possui testes (decisão atual). Caso evolua, priorizar testes dos serviços
  transacionais (`checklist.service`, `bdv.service` — locks `FOR UPDATE`, validação de KM).

- ⬜ **M1-b — Converter handlers inline `on*=` para `addEventListener`** *(sub-item de M1)*
  Para chegar a `script-src 'self'` sem `'unsafe-inline'`/`script-src-attr`, eliminar os ~19
  handlers inline (`onclick`/`onload`/etc.) nas páginas admin + `verDetalhes` em `admin.js`.
  Nonce/hash **não** cobrem handlers inline — precisam virar `addEventListener`. Pré-requisito
  para um CSP de script estrito quando as páginas HTML passarem a receber CSP.

- ⬜ **M1-c — Mover estilos inline para CSS** *(sub-item de M1)*
  Para remover `'unsafe-inline'` de `style-src`, migrar os ~76 atributos `style="..."` (30 em
  HTML estático + 46 gerados em `admin.js`) e os ~652 linhas de blocos `<style>` para classes
  em `style.css`. Maior esforço; ganho cosmético/defesa-em-profundidade, não fecha exploit ativo.

- 🟡 **B8 — Gerenciamento de processo (NSSM como serviço do Windows)** *(config + docs completos e commitados 2026-06-18; instalação do serviço BLOQUEADA por falta de acesso de administrador)*
  Hoje o backend morre quando o terminal é fechado e não reinicia sozinho após crash. Configurar um
  serviço do Windows para manter o processo vivo, reiniciar em falha e subir no boot.
  Correção rápida. **Obrigatório antes do deploy público.**
  > **⛔ BLOQUEADO na instalação (2026-06-19):** a config NSSM e a doc do README estão **completas e
  > commitadas**, mas o serviço **não pode ser registrado** com a conta atual do servidor (`geral`),
  > que é um **usuário padrão sem direitos de Administrador** — registrar um serviço do Windows exige
  > admin. A instalação precisa ser feita pelo **administrador do servidor (gestor)** seguindo os
  > comandos NSSM da seção **"Running as a Windows Service"** do README. **Até lá, o CarCheck roda como
  > um processo `node` iniciado à mão — sem auto-restart e sem sobreviver a reboot.** Tudo do
  > B8 (Parte A *e* Parte B) fica pendente desse passo de admin.
  > **⚠️ Pivot PM2 → NSSM (2026-06-18):** o PM2 (pacote npm) herda o check de plataforma do Node, que
  > **recusa rodar no Windows Server 2012** do servidor; trocado por **NSSM** (`nssm.exe`, binário nativo
  > único). `ecosystem.config.js` **removido** (preservado no git; re-adicionar só se/quando o SO for
  > atualizado). A causa-raiz (2012 fora de suporte) virou o item **I1**.
  > **✅ Implementado (2026-06-18):** seção README **"Running as a Windows Service"** reescrita para NSSM
  > (framing Parte A / Parte B). `.gitignore` mantém `backend/logs/`.
  > **Setting load-bearing:** `AppDirectory = C:\xampp\htdocs\CarCheck\backend` (o dotenv lê `.env` do
  > CWD; errado → `JWT_SECRET` ausente → exit).
  > **Anti-thrash:** `AppExit Default Restart` + `AppExit 0 Exit` + `AppThrottle 10000` (run < 10s =
  > falha de start, com back-off) — evita loop de thrash num erro permanente. Logs via
  > `AppStdout`/`AppStderr` → `backend/logs/` com rotação (10 MB). Instância única (combina com o rate
  > limiter de login em memória).
  > - **Parte A (process management)** — `nssm install` + `AppDirectory` + logs + auto-restart/anti-thrash
  >   + `nssm start`. **Requer admin para `nssm install` — bloqueado (ver acima).**
  > - **Parte B (reboot persistence)** — `Start SERVICE_DELAYED_AUTO_START` (sobe no boot, atrasado p/ o
  >   MariaDB do XAMPP subir antes; opcional `DependOnService mysql`). **Pendente.**
  > **Verificação (Parte B):** no próximo reboot natural, `Get-Service CarCheckAPI` deve mostrar
  > **Running** (start pelo SCM no boot) + `/api/health` → `success:true`. Se `Stopped` → checar
  > `carcheck-error.log` (em geral DB não pronto a tempo; `AppThrottle` + `DependOnService mysql`
  > endereçam). Sem acesso ao servidor aqui — instalação e verificação são manuais.

- ⬜ **B9 — Suíte de testes de integração**
  No mínimo, testes de rota da API cobrindo: `login`, submissão de `checklist`, abertura/encerramento
  de `BDV`, e endpoints `admin`. Expande/concretiza o **B5**. **Obrigatório antes de fazer fork para o
  sistema de supervisor ou de vender a clientes externos** (rede de segurança contra regressões).

- ⬜ **B10 — Sistema de migrations de banco**
  Mudanças de schema são aplicadas **manualmente, sem rastreamento** (ver memória/decisão atual).
  Adotar uma ferramenta de migrations versionadas (ex.: node-pg-migrate equivalente p/ MariaDB, Umzug,
  Flyway) com histórico aplicado. **Obrigatório antes do deploy multi-cliente/multi-tenant** (M6) —
  sem isso, sincronizar schema entre tenants/ambientes é inviável.

- ⬜ **B11 — `STORAGE.md` — documentar armazenamento real por linha e projeção de capacidade**
  Documentar o custo de armazenamento por linha (sobretudo `checklists.mapa_avaria_base64` LONGTEXT e
  `itens_status`) e projeções de capacidade. **Fazer só DEPOIS que o sistema estiver rodando em
  produção com dados reais** — **medir o tamanho real das tabelas via `information_schema`** (ex.:
  `information_schema.TABLES` → `DATA_LENGTH`/`AVG_ROW_LENGTH`; `information_schema.COLUMNS`) em vez de
  estimar. Estimativas a priori (ex.: o cap de 500 KB do A4-H2) são tetos de validação, não o tamanho
  típico real — o payload medido foi ~1,1 kB. Relaciona-se ao A4-H2 (caps) e ao planejamento de M6.

- ⬜ **B12 — `bdv.html` ignora `json.code` no fluxo de abrir BDV (sem auto-roteamento)**
  `bdv.html` exibe as mensagens de `CHECKLIST_REQUIRED`/`VEHICLE_MISMATCH` via `alert()`, mas
  **ignora o campo `json.code`** — não há roteamento automático (ex.: redirecionar para
  `checklist.html` em `CHECKLIST_REQUIRED`, ou trocar o veículo em `VEHICLE_MISMATCH`). O motorista
  é informado do que fazer, mas precisa navegar manualmente. **Nice-to-have de UX, não correção.**

- ⬜ **B13 — Paginação keyset (OFFSET degrada em offsets profundos)** *(achado na auditoria 2026-06-24)*
  `LIMIT ? OFFSET ?` (relatórios, histórico, correções) varre e descarta `N×pageSize` linhas em páginas
  profundas. Irrelevante hoje; ao longo de anos de dados, paginação profunda fica lenta. Forma
  future-proof: keyset/seek (`WHERE id < :lastId ORDER BY id DESC`).

- ⬜ **B14 — Estratégia de retenção / particionamento** *(achado na auditoria 2026-06-24)*
  Não há plano de retenção: `checklists`, `bdv`, `bdv_paradas`, `correcoes*` crescem para sempre. Ao
  longo de muito tempo, `checklists` (com base64 inline) domina tudo. Planejar **particionamento por
  ano** em `data_inspecao`/`data_abertura`, ou arquivamento de linhas frias. Fica **trivial** se as
  imagens forem externalizadas antes (**A11 fase 2**, diferida). Concretiza/expande o **B11** (STORAGE.md).

- ⬜ **B15 — `itens_status` é JSON opaco em coluna TEXT** *(achado na auditoria 2026-06-24)*
  Guardado como string serializada → não dá para consultar/indexar dentro ("todos os checklists com
  freio=RUIM" = full-scan + parse no app). OK hoje; se analytics sobre condição de itens virar
  requisito, usar tipo `JSON` nativo ou tabela normalizada `checklist_itens`.

- ⬜ **B16 — Cap de paradas por BDV** *(achado na auditoria 2026-06-24)*
  `addParada` não limita o número de paradas por BDV; um motorista (ou cliente malcomportado) pode
  anexar paradas ilimitadas, cada uma com `observacao` de 1000 chars. DoS menor de amplificação de
  armazenamento por usuário autenticado. Um cap sensato (ex.: 200 paradas/BDV) fecha. Relaciona-se a **M10**.

- ⬜ **B17 — Versionar `schema.sql` no repositório** *(achado na auditoria 2026-06-24)*
  O DDL só existe no banco vivo (sem `.sql` no repo; o CLAUDE.md é prosa). Além de ser o **B10**
  (migrations), é um problema de **segurança de dados**: não há fonte de verdade versionada do schema —
  perda do banco + deploy manual = reconstrução de memória. No mínimo, commitar um snapshot `schema.sql`
  agora. Pré-requisito do **B10** e do **M9** (sync de schema entre tenants).

- ⬜ **B18 — Drain do pool no shutdown gracioso** *(achado na auditoria 2026-06-24)*
  SIGTERM/SIGINT fazem `process.exit(0)` sem drenar o pool — transações em voo são abandonadas. Menor;
  adicionar `pool.end()` + drain curto quando o wrapper de serviço (**B8**) entrar.

- ⬜ **B19 — `allowPublicKeyRetrieval: true` + TLS no banco** *(achado na auditoria 2026-06-24)*
  Inócuo num banco localhost/LAN, mas se o MariaDB for para um host separado/gerenciado, essa flag +
  conexão sem TLS é vetor de MITM/disclosure de credencial. Usar conexão TLS ao banco e remover a flag
  quando o banco deixar de ser local. (`backend/src/config/database.js`.)

- ⬜ **B20 — Verificar que colunas `auto_increment` são `BIGINT`** *(verificação única — auditoria 2026-06-24)*
  Auto-increment **não** é risco real (BIGINT + InnoDB + validação antes do INSERT → overflow inatingível
  no domínio; gaps por rollback são cosméticos). Único checup: confirmar no DDL vivo que nenhuma PK ficou
  `INT` (teto 2,14 bi). Se ficou, `ALTER ... MODIFY ... BIGINT` enquanto as tabelas estão pequenas.
  ```sql
  SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND EXTRA = 'auto_increment';
  ```

- ⬜ **B22 — Sem compressão (gzip/brotli) no backend** *(auditoria mobile 2026-06-24)*
  Nenhum middleware de compressão (sem dep `compression`). JSON trafega cru — caro em rede móvel,
  sobretudo relatórios com `mapa_avaria_base64` (base64 é altamente compressível, ~30–40% com gzip).
  Payloads do motorista são pequenos; o ganho maior é nos relatórios admin. Mitigado em parte quando
  o Cloudflare entrar (comprime no edge), mas `compression()` no Express é um ganho barato já na LAN.
  Relaciona-se a **A11** (**concluído** — base64 já não trafega nas listas).

- ⬜ **B24 — Atributos de teclado mobile nos inputs** *(auditoria mobile 2026-06-24)*
  Os inputs **críticos do motorista já estão certos** (`km` = `type=number` → teclado numérico;
  `hora_*` = `datetime-local` → picker nativo; viewport presente em todas as páginas ✓). Pendências
  menores: login `usuario` sem `inputmode`/`autocapitalize=off`/`autocorrect=off`/`autocomplete` (o
  teclado mobile pode autocapitalizar/autocorrigir a matrícula); CPF (admin) é `type=text` e deveria ter
  `inputmode=numeric`. Cosmético/UX — não bloqueia.

- 🔴 **I1 — Windows Server 2012 fora de suporte / abaixo da baseline de tooling (risco de infraestrutura)**
  O servidor de produção roda **Windows Server 2012**, cujo suporte estendido terminou em
  **2023-10-10** — sem patches de segurança desde então. Além do risco de OS sem correção, a versão
  já **bloqueia tooling ativamente**: o PM2 (B8) recusou instalar pelo check de plataforma do Node
  (`pm2` não reconhecido após o install), forçando o pivot para NSSM. Cada dependência nova que
  assuma um Windows/Node moderno tende a esbarrar nisto.
  - **Risco:** superfície de ataque sem patch + ferramentas modernas indisponíveis. **Bloqueante para
    deploy público** (M6) — um host público sem patches de SO é inaceitável.
  - **Ação:** migrar para um Windows Server suportado (2019/2022) ou Linux. Reavaliar PM2 pós-migração
    (re-adicionar `ecosystem.config.js`, removido em B8, a partir do histórico do git).
  - Relaciona-se a **B8** (NSSM como contorno) e ao planejamento de deploy público (**M6**).

---

## 🚀 Deploy em Produção (checklist)

Itens a executar/validar ao publicar o sistema (ex.: via Cloudflare). Vários se conectam
a decisões já registradas (A2, M1, S3 — esta última em [`BACKLOG_DONE.md`](BACKLOG_DONE.md)).

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

## ✅ Concluído

Itens concluídos (✅) e o histórico das fases já entregues dos 🔵 vivem em
**[`BACKLOG_DONE.md`](BACKLOG_DONE.md)** — incluindo C1, A1–A6, A9, A10, a auditoria de SQL injection,
M3, M4, M10, M13, M14, A12, B7, a série S1–S3, B6, e as porções concluídas de A7 (spec/slices 1–3), M1 (helmet) e M5/M5-b.
