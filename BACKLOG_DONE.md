# BACKLOG (concluído) — CarCheck

> Arquivo de **referência**: itens já **concluídos** (✅) e as porções já entregues de
> itens em andamento (🔵), movidos para fora do `BACKLOG.md` ativo em **2026-06-25** para
> reduzir o custo de tokens do backlog de trabalho. Raramente precisa ser carregado.
>
> O backlog **ativo** (pendentes + o que falta dos 🔵) vive em **`BACKLOG.md`**.
>
> Legenda: ⬜ pendente · 🔵 em andamento · ✅ concluído

---

## 🔴 Crítico — concluído

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

## 🟠 Alto — concluído

- ✅ **A12 — Índices em queries quentes** *(aplicado e verificado no banco vivo em 2026-07-01)*
  Auditoria do `information_schema` confirmou que **todas as FKs são reais** (índices single-col
  auto-criados em `bdv.checklist_id`/`matricula`/`veiculo_id`, `checklists.matricula`/`veiculo_id`,
  `bdv_paradas.bdv_id`) — nenhuma coluna de JOIN ficou sem índice. Faltavam só os **compostos** (range de
  data no guard diário, sort do histórico) e os índices de **sort puro** dos relatórios admin. DDL aplicado
  (registrado aqui porque não há `schema.sql` versionado — ver **B17**):
  ```sql
  CREATE INDEX idx_checklists_matricula_data ON checklists (matricula, data_inspecao);
  CREATE INDEX idx_checklists_veiculo_data   ON checklists (veiculo_id, data_inspecao);
  CREATE INDEX idx_checklists_data           ON checklists (data_inspecao);
  CREATE INDEX idx_bdv_matricula_status      ON bdv (matricula, status);
  CREATE INDEX idx_bdv_veiculo_status        ON bdv (veiculo_id, status);
  CREATE INDEX idx_bdv_data_abertura         ON bdv (data_abertura);
  ```
  - `bdv(checklist_id)` (FK `bdv_ibfk_1`, serve o anti-join `NOT EXISTS` do guard) e `bdv_paradas(bdv_id)`
    (FK) **já existiam** — não recriados.
  - **Bônus:** ao criar os compostos, o InnoDB **auto-dropou** os índices single-col redundantes
    (`bdv.matricula`/`veiculo_id`, `checklists.matricula`/`veiculo_id`) — os compostos passam a suportar as
    FKs pelo prefixo. Estado final sem redundância, sem drop manual.
  - Verificação: re-inventário do `information_schema.STATISTICS` mostrou os 6 `idx_*`. `EXPLAIN` nas tabelas
    pequenas de hoje ainda pode escolher scan (correto — o ganho aparece com o crescimento).

- ✅ **A8 — `bdv.html`: ordem dos guards (viagem ativa antes do guard de veículo)** *(fix em 2026-06-17; deployado e verificado em browser 2026-06-30)*
  Um motorista **em viagem** com `localStorage.veiculo_id` vazio era mandado para `selecao.html` **antes**
  de `/bdv/ativo` ser checado → não conseguia chegar à própria viagem ativa.
  - **Correção:** `verificarBDVAtivo()` virou o ponto de decisão no `DOMContentLoaded` (`await`ado).
    200 (viagem ativa) → renderiza `andamento` e retorna **sem** exigir `veiculo_id`; o guard de veículo
    foi extraído para `exigirVeiculoParaNovaViagem()`, que roda **só** nos caminhos de nova viagem
    ('abrir', não-200). Hidratação de órfão (A6) permanece antes da checagem. Frontend-only (`bdv.html`).
  - **Verificado em browser (2026-06-30):** logar como motorista → abrir BDV → apagar `veiculo_id` do
    localStorage → recarregar `bdv.html` → permanece na viagem ativa (antes: bounce para `selecao.html`).
    Não é curl-testável (lógica de ordenação client-side); retestado manualmente pelo usuário.
  - Separado do **A6** (recuperação de órfão): aqui o BDV **existe e está aberto** — era só a ordem dos guards.

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

- ✅ **A3 — Submissão confia em `req.body.matricula` em vez de `req.user.matricula` (IDOR/spoof de identidade)** *(concluído em 2026-06-16 — deployado, testado e commitado)*
  > ✅ **Gate de deploy+teste concluído (2026-06-16).** Os 4 arquivos backend foram deployados, o Node
  > reiniciado, e os 4 testes de fronteira de identidade **passaram** no servidor — depois commitados
  > (`fix: derive identity from JWT not request body + close BDV read IDOR (A3)`):
  >    - **T1 — spoof de checklist:** ✅ logado como motorista A, `POST /checklist` com `matricula: <B>` no
  >      corpo → checklist gravado sob **A** (JWT), campo do body ignorado.
  >    - **T2 — guard de duplicidade usa o JWT:** ✅ A com checklist pendente do dia → novo `POST /checklist`
  >      (com `matricula` de B no corpo) → **409** baseado em A, não no body.
  >    - **T3 — IDOR de leitura de BDV:** ✅ A faz `GET /bdv/:id` de um BDV de B → **403**; do próprio → **200**.
  >    - **T4 — admin preservado:** ✅ admin `GET /bdv/:id` de qualquer BDV → **200**; `admin-bdv.html` carrega
  >      as contagens de paradas.

  > ✅ **Auditoria + correção (2026-06-15):**
  > - **#1 `POST /checklist` (vuln confirmada):** `matricula` removida do schema Zod `createChecklist`;
  >   o controller injeta `{ ...req.body, matricula: req.user.matricula }`. O guard de duplicidade
  >   (`findPendingTodayByMatricula`) e o `INSERT` agora usam o valor do JWT.
  > - **#7 `GET /bdv/:id` (BOLA/IDOR de leitura, achado na auditoria):** `bdv.service.getBDV` agora
  >   recebe o solicitante e exige `nivel_acesso === 'admin'` **OU** `bdv.matricula === req.user.matricula`,
  >   senão 403. O relatório admin (`/admin/bdv` → `admin-bdv.html`) continua funcionando (role admin);
  >   o motorista lê apenas o próprio BDV.
  > - **Escritas de BDV já estavam corretas:** `open`/`paradas`/`encerrar` já usavam `req.user.matricula`
  >   e o service já barrava `bdv.matricula !== matricula` com 403 — nenhuma mudança necessária.
  > - **#8 `GET /veiculos/:id/historico` — aceito por ora:** qualquer usuário autenticado lê o histórico
  >   de inspeções de **qualquer** veículo (dado de frota, não de usuário). **Aceito por design** no
  >   modelo single-tenant atual; adicionar object-level authorization se/quando o produto for
  >   multi-tenant (M6) ou se o histórico passar a conter dado sensível por motorista.
  >   *(Atualização: o ângulo CPF/LGPD desse mesmo endpoint virou **A14** — ainda pendente.)*
  > - **Nota M6:** `POST /admin/funcionarios` recebe `coligada`/`nivel_acesso` do body (dado de criação,
  >   admin global — ok hoje). Sob multi-tenancy, escopar `coligada` ao tenant do admin; `coligada` ainda
  >   **não** está no JWT, então isso exigirá incluí-la no token. Relaciona-se a M6.

  **Achado original (referência):**
  `checklist.service.js::createChecklist` recebe `req.body` direto do controller
  (`checklist.controller.js`: `createChecklist(conn, req.body)`) e usa **`data.matricula`** tanto no
  guard de duplicidade (`findPendingTodayByMatricula`) quanto no `INSERT` do checklist. A matrícula
  **não** é derivada do JWT — qualquer cliente autenticado pode enviar a matrícula de **outro
  motorista** no corpo e registrar checklist sob a identidade alheia (a camada Zod valida o formato,
  não a posse). O frontend preenche `matricula` a partir de `localStorage.usuario`, mas o servidor
  confia no que chega no body.
  - **Correção:** o servidor deve **derivar a matrícula de `req.user`** (do token, populado pelo
    `auth.middleware`) e **ignorar** qualquer `matricula` no corpo.
  - **Mesmo audit nos endpoints de BDV:** confirmado que `open`/`paradas`/`encerrar` já usavam `req.user`.
  - Risco real de **vazamento/atribuição cruzada entre motoristas**; agrava-se sob multi-tenancy (M6).
    Relaciona-se a M4 (sessão via cookie) e M6.

- ✅ **A4 — Endurecimento de validação de input (Zod) — limites de tamanho e schemas frouxos** *(concluído em 2026-06-17; verificado no servidor em 2026-06-18)*
  Auditoria de validação/injeção em 2026-06-15. Camada Zod (`validate.middleware.js`) sem caps de
  tamanho e com schemas permissivos.
  > **✅ Concluído (2026-06-17) e verificado no servidor (2026-06-18):** H2 (2026-06-16) + **M1–M4 e L1**
  > implementados. Validado por 16 asserções de comportamento contra os payloads reais do
  > frontend (parse OK; malformados rejeitados; drop do `matricula` no `createChecklist` preservado).
  > **Verificação no servidor (2026-06-18):** checklist real submetido pela UI retorna **201** com a
  > validação de forma do M1, o formato base64 do M2 e o caminho não-strict do A3 (drop do `matricula`)
  > todos ativos em produção.
  > **L2** já estava coberto pelos caps do H2; **L3** é o único sub-item não endereçado (aceito na
  > escala atual — ver nota abaixo).
  - ✅ **H2 (alto) — sem `.max()` + `express.json({ limit: '50mb' })` = DoS/amplificação de armazenamento**
    *(corrigido em 2026-06-16)*. Payload real medido (checklist com avaria desenhada) ≈ 1,1 kB → caps
    apertados aplicados:
    - **`.max()` em todos os campos string** sem limite (`validate.middleware.js`): `mapa_avaria_base64`
      `500000`; branch string de `itens_status` `20000` (o branch `z.record` segue **sem cap** → A4-M1);
      locais `200`, `observacao` `1000`, `hora_*`/`data_*` `32`, `combustivel_retorno` `50`,
      `matricula`/`coligada`/`funcionario_id` `20`, `nome` `120`, `senha` `128`.
    - **Limite de body por rota** (`index.js`): default global `100kb`; só `POST /api/checklist` → `1mb`
      (via dispatcher — o parser global roda antes do router). Substitui o `50mb` global.
    - **Handler 413** (`errorHandler.middleware.js`): `entity.too.large`/413 → JSON limpo
      `"Requisição grande demais"` + novo código `PAYLOAD_TOO_LARGE`.
    - ✅ **Deployado e verificado no servidor (2026-06-16):** checklist normal grava **201**; campo de
      ~600 KB → **400** (cap Zod); body de 1,2 MB → **413 `PAYLOAD_TOO_LARGE`**; ciclo completo do
      motorista (checklist + abrir BDV / paradas / encerrar) funciona.
  - ✅ **M1 — forma de `itens_status` validada** *(2026-06-17)*: branch record agora é
    `z.record(z.object({ status: z.string(), obs: z.string().optional() }))`. Permissivo nas chaves
    (qualquer nome de item) e no `status` (string, não enum → não rejeita variação legada); `z.object`
    interno não-strict tolera chaves extras. Branch string mantido (`min(1).max(20000)`).
  - ✅ **M2 — formato de `mapa_avaria_base64` no schema** *(2026-06-17)*:
    `.regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/)` (mesmo formato do render do admin);
    `.max(500000)` e `.optional()` mantidos.
  - ✅ **M3 — campos de data/hora validados** *(2026-06-17)*: `DATETIME_RE` compartilhado em
    `addParada.hora_saida`, `closeParada.hora_chegada`, `relatorioBDV.data_inicio`/`data_fim`. Aceita
    `YYYY-MM-DD` (input type=date) e `YYYY-MM-DDTHH:mm[:ss][.fff][Z|±hh:mm]` (datetime-local / ISO),
    lenient p/ não quebrar o frontend; `.max(32)` mantido como teto.
  - ✅ **M4 — `coligada` unificada** *(2026-06-17)*: `relatorioBDV.coligada` passou de
    `z.string().max(20)` para `z.enum(['angels','cemax'])`, mantido `.optional()` (é filtro).
  - ✅ **L1 — `.strict()` decidido por schema** *(2026-06-17)*: **strict (9):** `login`,
    `createFuncionario`, `historicoVeiculo`, `openBDV`, `addParada`, `closeParada`, `closeBDV`,
    `bdvParams`, `paradaParams`. **Não-strict (3):** `createChecklist` (**obrigatório** — A3 depende do
    drop do `matricula` do body; comentado inline), `relatorioAdmin` e `relatorioBDV` (schemas de
    **query** — toleram parâmetros avulsos da query string).
  - ✅ **L2 — já coberto pelo H2:** os caps de `.max()` em `login`/`createFuncionario`
    (`senha` 128, `matricula` 20, `nome` 120) foram aplicados no H2 (2026-06-16). Nada a fazer.
  - ⬜ **L3 — `migrate-passwords.js` carrega todas as linhas sem `WHERE`** — **único sub-item não
    endereçado.** Fora do escopo desta mudança (`validate.middleware.js`); ok na escala atual, revisitar
    se `funcionarios` crescer. (O problema grave do script foi resolvido em **A5**.)

- ✅ **A5 — `scripts/migrate-passwords.js` está quebrado e é destrutivo de dados** *(corrigido em 2026-06-16)*
  > ✅ **Reconciliado e endurecido (2026-06-16).** O script foi reescrito:
  > - **Colunas corrigidas:** `SELECT matricula, nome, senha`; `UPDATE ... SET senha = ? WHERE matricula = ?`
  >   (PK `matricula`, coluna `senha` — alinhado a `funcionario.repository.js`).
  > - **Detecção de bcrypt completa:** regex `^\$2[aby]\$` cobre `$2a$`/`$2b$`/`$2y$` (skip), só re-hasheia texto plano real.
  > - **Null-guard:** linhas com `senha` nula/vazia são puladas antes de qualquer checagem de prefixo.
  > - **Transação:** `beginTransaction` → loop → `commit`; erro no meio dispara `rollback` (nenhuma senha alterada).
  > - **`--dry-run`** (read-only, reporta `[WOULD MIGRATE]` sem gravar) + **flag de segurança** `--i-know-its-fixed`
  >   (ou `MIGRATE_PASSWORDS_CONFIRMED=1`) que TRAVA o modo de gravação com mensagem explicando o achado da auditoria.
  > **Pré-execução recomendada:** rodar `--dry-run` contra o banco vivo + backup da tabela antes de gravar.
  > Relaciona-se a M5-b (`bcrypt`→`bcryptjs`).

  **Achado original (referência):** Achado na auditoria de 2026-06-15. **Não executar o script até ser reconciliado com o schema real.**
  - **Colunas/PK erradas:** o script usava `SELECT id, nome, senha_hash FROM funcionarios` e
    `UPDATE ... SET senha_hash = ? WHERE id = ?`. Mas, pelo schema e por **todos** os repositórios, a PK
    é **`matricula`** (não há `id`) e a coluna de senha é **`senha`** (não há `senha_hash`).
    - Pior caso: se existir uma coluna `senha_hash` obsoleta, migra o **campo errado** e deixa o `senha`
      real intacto — divergência silenciosa e irreversível.
  - **Detecção só de `$2b$`:** ignorava `$2a$`/`$2y$` (também bcrypt) → re-hash destrutivo e irreversível.
  - **Sem null-guard / sem transação / sem dry-run / sem backup.** Tudo corrigido acima. Relaciona-se a M5-b.

- ✅ **Auditoria de superfície de injeção SQL — limpa** *(2026-06-15)*
  Revisados os **4 repositórios** (`bdv`, `checklist`, `funcionario`, `veiculo`). **Todas as queries
  usam placeholders `?` com array de parâmetros — zero interpolação de input do usuário no SQL.** Os
  dois construtores dinâmicos são seguros: `bdv.repository.js::findAllBDV` e
  `checklist.repository.js::findRelatorio` concatenam apenas **fragmentos SQL constantes**
  (`'b.matricula = ?'`, `' LIMIT ?'`) e empurram os valores para `params` (com `Number()` no
  `limit`/`offset` do `findAllBDV`). Sem template literals com input interpolado e sem caminho de
  injeção de segunda ordem. A regra "só repositórios tocam SQL" (CLAUDE.md) está sendo mantida.

- ✅ **A6 — Soft-lock do motorista após checklist-sem-BDV** *(abordagem (a), escopo motorista — verificado no servidor 2026-06-17)*
  > **✅ Verificado no servidor (2026-06-17):** órfão fresco do mesmo dia roteia o motorista para
  > `bdv.html`, hidrata o **veículo CORRETO** (override de data-integrity confirmado — mostrou o veículo
  > do órfão, não o `localStorage` obsoleto), o lock se mantém até o BDV ser concluído e **libera** após
  > o encerramento. **Ciclo completo funciona.**
  >
  > **Progresso (2026-06-16):** implementado em duas fatias.
  > - ✅ **Slice 1 (backend):** novo `GET /api/checklist/pendente` (repo `findPendingDetailTodayByMatricula`
  >   com JOIN veiculos → `id, veiculo_id, km_entrada, placa, modelo`; service `getChecklistPendente`
  >   espelhando `getBDVAtivo` com 200-ou-404 e BigInt→string; controller derivando a matrícula do
  >   `req.user`; rota com `authenticate`).
  > - ✅ **Slice 2 (frontend):** guard de roteamento em `menu.html` (load + pageshow) e `checklist.html`
  >   (load + pageshow, check de órfão **gated a motorista**) — precedência `/bdv/ativo` → `bdv.html`;
  >   senão `/checklist/pendente` → `bdv.html`. Auto-hidratação de `bdv.html` (`DOMContentLoaded`): quando
  >   `localStorage.veiculo_id` está vazio, busca `/checklist/pendente`, grava veículo no localStorage e
  >   segue; KM pré-preenchido por `preencherKmInicial`. Abrir o BDV reusa o auto-link do backend.
  > - 🔧 **Fix override (2026-06-17):** a hidratação de `bdv.html` agora trata o **checklist órfão como
  >   fonte da verdade do seu veículo** e **sobrepõe** qualquer `localStorage` obsoleto (antes só hidratava
  >   quando vazio, podendo abrir o BDV no veículo errado).
  > - ⚠️ **Premissa da abordagem (a):** assume que o órfão é um checklist **legítimo** — a recuperação
  >   força o motorista a abrir/encerrar o BDV daquele checklist (único caminho de saída). A limpeza de
  >   **órfão equivocado** é preocupação de **vistoriador → ver A7** (correção role-aware), não do motorista.

  Se um motorista **envia o checklist mas sai antes de abrir o BDV**, o guard de duplicidade
  (`findPendingTodayByMatricula`) bloqueava **qualquer novo checklist naquele dia** sem rota de
  recuperação — motorista travado pelo resto do dia. Corrigido pela abordagem **(a)**: detectar o
  checklist-sem-BDV e rotear o motorista para **abrir o BDV daquele checklist**.
  - **Vistoriador faz inspeção sem viagem:** para **vistoriadores** um checklist é um **estado final
    válido** — o fluxo de BDV e o guard de duplicidade **NÃO** se aplicam. A recuperação do A6 é escopada
    **apenas a motoristas**. **Trabalho futuro (role-aware):** tornar o fluxo checklist→BDV ciente de
    papel — relaciona-se a A7.

- ✅ **A9 — `POST /api/bdv` sem `authorize`: qualquer usuário autenticado abre BDV** *(verificado no servidor 2026-06-17)*
  > **✅ Verificado no servidor (2026-06-17):** modelo de três papéis aplicado na camada de rota —
  > motorista chega ao `GET /bdv/ativo` (**404**, não bloqueado); admin e vistoriador recebem
  > **403 `INSUFFICIENT_PERMISSION`** nas rotas de motorista; admin ainda acessa o `admin-bdv.html`
  > via `GET /bdv/:id` sem gate (guard admin-OU-dono no service).
  > **Fix implementado (2026-06-17):** `VISTORIADOR: 'vistoriador'` adicionado ao enum `ROLES`
  > (`constants.js`), reconciliando com o enum `nivel_acesso` do banco. Gates `authorize` (após
  > `authenticate`) em `routes/index.js`: `POST /bdv`, `GET /bdv/ativo`, `POST /bdv/:id/paradas`,
  > `PATCH /bdv/:id/paradas/:paradaId`, `PATCH /bdv/:id/encerrar` → `authorize(MOTORISTA)`;
  > `POST /checklist` → `authorize(MOTORISTA, VISTORIADOR)` (admin não inspeciona); `GET /checklist/pendente`
  > → `authorize(MOTORISTA)`. `GET /bdv/:id` fica só com `authenticate` (o service já faz guard
  > admin-OU-dono — gate grosseiro trancaria o admin).
  > As rotas de **escrita de BDV** (`paradas`, `encerrar`) estão marcadas **A7-coupled**: podem ganhar
  > `VISTORIADOR` quando o papel de override/supervisor entrar.
  Liga-se ao trabalho role-aware de **A6/A7**.

- ✅ **A10 — Vínculo estrito 1:1 checklist→BDV no `openBDV`** *(verificado no servidor 2026-06-17)*
  > **✅ Verificado no servidor (2026-06-17):** sem checklist → **409 `CHECKLIST_REQUIRED`**;
  > veículo divergente → **409 `VEHICLE_MISMATCH`**; checklist do mesmo veículo → **201** com o
  > `checklist_id` corretamente vinculado.
  O `openBDV` antes fazia auto-link **permissivo** (vinculava o checklist órfão do dia **se existisse**,
  senão abria o BDV mesmo assim — podendo abrir no veículo errado). Agora o guard é **estrito**, dentro
  da transação sob o row-lock do veículo: exige um checklist órfão do dia (`findPendingTodayByMatricula`,
  agora também retornando `veiculo_id`) e compara `String(checklist.veiculo_id) === String(veiculo_id)`.
  Dois códigos novos em `constants.js` (`CHECKLIST_REQUIRED`, `VEHICLE_MISMATCH`, ambos 409).
  - Complementa, no backend, o override de hidratação do **A6**. UX de auto-roteamento dessas mensagens
    fica no **B12** (ainda pendente).

### A7 — Capacidades de correção/override do vistoriador — especificação completa (slices 1–3 ✅ em prod; slice 4 ativo em `BACKLOG.md`)

O papel **vistoriador** deve poder: **(1)** definir/corrigir qualquer valor de **KM**, inclusive
**sobrepondo a validação de monotonicidade do KM**; e **(2)** sinalizar e corrigir uma gama de erros em
**checklists/BDVs**. É um papel de **override de nível supervisor**, distinto de **motorista**. Esta é a
**especificação autoritativa de implementação**.

#### Onde o guard de KM mora hoje (4 checagens, não 1)
A monotonicidade não é uma checagem única — todas se ancoram em `veiculos.km_atual`, mutado sob
`findByIdWithLock` (`SELECT … FOR UPDATE`):
- `checklist.service.createChecklist` — `km_entrada < km_atual` → `KM_INVALID`; escreve `updateKm(km_entrada)`.
- `bdv.service.openBDV` — `km_inicial < km_atual`; escreve `updateKm(km_inicial)`.
- `bdv.service.addParada` — `km < lastParada.km` **e** `km < km_inicial`.
- `bdv.service.closeBDV` — `km_final < km_inicial` **e** `km_final < maxParadaKm`; escreve `updateKm(km_final)`.

`veiculos.km_atual` é a **âncora monotônica canônica**. Toda correção que mexe em KM precisa tratar
`km_atual` como campo corrigível de primeira classe.

#### (2) Trilha de auditoria — esquema de **duas tabelas** (decisão §6.4)
Cabeçalho + diff por campo. Uma ação de correção = 1 linha de cabeçalho + N linhas de campo.
**Append-only** (sem `UPDATE`/`DELETE`). Schema aplicado **manualmente** (sem migration).

```sql
-- Cabeçalho: uma linha por ação de correção (quem / quando / qual registro / por quê)
CREATE TABLE correcoes (
    id                    BIGINT       NOT NULL AUTO_INCREMENT,
    vistoriador_matricula VARCHAR(20)  NOT NULL,            -- quem (FK funcionarios.matricula)
    entidade              ENUM('checklist','bdv','bdv_parada','veiculo') NOT NULL,
    entidade_id           BIGINT       NOT NULL,            -- qual registro
    motivo                VARCHAR(500) NULL,                -- justificativa (ver §6.3)
    km_override           TINYINT(1)   NOT NULL DEFAULT 0,  -- true se a monotonicidade foi burlada
    coligada              VARCHAR(20)  NULL,                -- escopo de tenant (M6)
    criado_em             DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_entidade (entidade, entidade_id),
    KEY idx_vistoriador (vistoriador_matricula),
    KEY idx_criado_em (criado_em),
    CONSTRAINT fk_correcoes_func FOREIGN KEY (vistoriador_matricula)
        REFERENCES funcionarios (matricula)
);

-- Detalhe: uma linha por campo alterado
CREATE TABLE correcoes_campos (
    id            BIGINT      NOT NULL AUTO_INCREMENT,
    correcao_id   BIGINT      NOT NULL,
    campo         VARCHAR(64) NOT NULL,                     -- ex.: 'km_entrada', 'combustivel_retorno'
    valor_antigo  TEXT        NULL,                         -- snapshot antes (string/JSON)
    valor_novo    TEXT        NULL,                         -- snapshot depois
    PRIMARY KEY (id),
    KEY idx_correcao (correcao_id),
    CONSTRAINT fk_campos_correcao FOREIGN KEY (correcao_id)
        REFERENCES correcoes (id)
);
```

Decisões embutidas: `valor_antigo`/`valor_novo` como **TEXT** não tipado (audita km numérico, status
enum e `itens_status` JSON no mesmo lugar); **`km_override` no cabeçalho** (evento filtrável de primeira
classe); **`coligada` desnormalizada** (auditoria por tenant sem join de volta); **append-only**.

#### (3) Caminho de escrita separado: `correcao.service.js` (sem guard monotônico)
**Princípio: NÃO adicionar `if (role === vistoriador) skip guard` dentro dos services do motorista.**
Em vez disso, novo `correcao.service.js` com métodos próprios (`corrigirChecklist`, `corrigirBDV`,
`corrigirParada`, `corrigirKmVeiculo`) que **simplesmente nunca chamam a checagem monotônica** — o
bypass é a *ausência* do guard num caminho diferente e gated por papel. `checklist.service` /
`bdv.service` ficam **intocados**. Disciplina de transação + lock preservada; o `INSERT` de auditoria
acontece **na mesma transação** da correção (se a auditoria falhar, rollback — sem edições silenciosas).

#### (1) Modelo de permissão — gate no nível de rota
- **`authorize(ROLES.VISTORIADOR, ROLES.ADMIN)`** em todas as rotas `/api/correcoes/*`.
- **Não** alargar o `authorize` das rotas de motorista — elas impõem ownership + monotonicidade, que é
  exatamente o que uma correção **não** deve fazer. Correções vivem no namespace `/correcoes/*`.

#### (4) Campos corrigíveis vs. imutáveis
**Corrigíveis (com auditoria):**
- `checklists`: `km_entrada`, `itens_status`, `local_origem`, `local_destino`, `mapa_avaria_base64`.
- `bdv`: `km_inicial`, `km_final`, `combustivel_retorno`, `coligada`, `encerrado_fora_base`.
- `bdv_paradas`: `km`, `hora_saida`, `hora_chegada`, `local_saida`, `local_chegada`, `observacao`.
- `veiculos`: `km_atual` (a âncora).

**Imutáveis (nunca editáveis):** chaves primárias; procedência `matricula`/`veiculo_id` (re-parentear é
operação "reassign" separada, fora de escopo); `bdv.checklist_id` (vínculo 1:1 do A10); timestamps de
sistema `data_abertura`/`data_encerramento`; **`bdv.status`** (§6.1: field-only, **sem reabertura**); as
próprias tabelas de auditoria.

#### §6 — Decisões resolvidas (2026-06-18)
- **§6.1 — `bdv.status` imutável / correções field-only, sem reabertura.**
- **§6.2 — Realinhamento de âncora: set explícito + helper de recompute, sem auto-recompute.** O
  vistoriador **seta explicitamente** a âncora via `PATCH /api/correcoes/veiculo/:id/km` (sob row-lock).
  Helper de recompute (`km_atual = MAX(último checklist km_entrada, último BDV encerrado km_final)`)
  disponível mas **não** auto-disparado.
- **§6.3 — `motivo` obrigatório quando `km_override = 1`, opcional caso contrário.**
- **§6.4 — Auditoria em duas tabelas** (`correcoes` + `correcoes_campos`).

#### Pré-requisito (entregue no slice 3) — acesso de leitura do vistoriador aos dashboards
`GET /api/admin/relatorio` e `GET /api/admin/bdv` relaxados de `authorize(ADMIN)` para
`authorize(VISTORIADOR, ADMIN)` — o vistoriador não pode corrigir o que não vê. Reconciliar com A3
(acesso por objeto) e M6 (escopo de `coligada`/tenant). *(Nota: este relaxamento é o que torna o
ângulo CPF/LGPD do **A14** mais agudo — supervisor passa a ver CPF de todos.)*

#### Superfície de API (entregue)
Todos `authenticate` → `authorize(VISTORIADOR, ADMIN)` → `validate(...)`; CSRF já cobre mutações.

| Método | Path | Propósito |
|--------|------|-----------|
| PATCH | `/api/correcoes/checklist/:id` | Corrigir campos do checklist (body: campos + `motivo`) |
| PATCH | `/api/correcoes/bdv/:id` | Corrigir campos do BDV |
| PATCH | `/api/correcoes/bdv/:id/paradas/:paradaId` | Corrigir uma parada |
| PATCH | `/api/correcoes/veiculo/:id/km` | Setar a âncora de KM do veículo (§6.2) |
| GET | `/api/correcoes?entidade=&entidade_id=` | Ler o histórico de correções de um registro |

#### Fatiamento de entrega
1. ✅ **Tabelas de auditoria + `correcao.service` + endpoints PATCH** (checklist/bdv/parada) com gate
   `authorize(VISTORIADOR, ADMIN)` e auditoria-na-mesma-transação. *(deployado e verificado em prod)*
2. ✅ **Realinhamento de âncora** — `PATCH /correcoes/veiculo/:id/km` + helper de recompute (§6.2). *(prod)*
3. ✅ **Endpoint de histórico** — `GET /api/correcoes` + leitura dos dashboards relaxada. *(prod)*
4. ⬜ **UI** — **ainda pendente; rastreado no `BACKLOG.md` ativo (A7 slice 4).**

> ⚠️ **Bug conhecido no backend já entregue:** `km_override` era auto-reportado pelo cliente →
> corrigido em **A13** (abaixo). Drift da âncora → **M11** (pendente, em `BACKLOG.md`).

- ✅ **A13 — Derivar `km_override` no servidor (bug de auditoria do A7)** *(concluído em 2026-06-26 — deployado, testado e commitado)*
  No caminho de correção (A7), `km_override` chegava como **booleano do corpo** (schemas
  `correcaoChecklist`/`correcaoBDV`/`correcaoParada`): um vistoriador podia **baixar** um KM deixando a
  flag em `false`, gravando `km_override=0` **sem `motivo`** e omitindo o evento §6.4 da trilha.
  - **Correção:** `correcao.service::aplicarCorrecao` agora **deriva** a flag do diff via helper puro
    `deriveKmOverride(entidade, row, changed)` — override = valor **novo < valor antigo** em qualquer
    campo de KM alterado (`KM_FIELDS`). O booleano do corpo é descartado; `motivo` passa a ser exigido
    sempre que a flag derivada for `true` (segunda barreira além do Zod, espelha `corrigirKmVeiculo`).
  - **Harness local:** `backend/scripts/test-km-override.js` (sem DB, 14 casos) cobre redução/aumento/
    igual, os 3 campos de KM (checklist/bdv/parada), KM antigo NULL e coerção de string.
  - **Testado no servidor (vistoriador→admin, curl):** reduzir `km_entrada` sem motivo → **400**; com
    motivo → **200** + auditoria `km_override=1` (corpo dizia `false`); aumentar KM → **200** +
    `km_override=0`. Mesmo comportamento confirmado em `bdv.km_final`. Dados de teste restaurados.

- ✅ **A11 (fase 1) — Tirar base64 das queries de lista + endpoint de detalhe sob demanda** *(concluído em 2026-06-26 — deployado, testado e commitado)*
  `mapa_avaria_base64` (`LONGTEXT`, PNG inline, até 500 KB) vinha em **todas** as linhas dos caminhos
  de leitura mais quentes — relatório admin (`findRelatorio`, default 100 linhas) e histórico do
  veículo (`findHistoricoByVeiculo`, que nem renderiza a imagem) — inflando payload, banda, memória do
  browser e tempo de conexão presa no pool (10).
  - **Correção:** removido `c.mapa_avaria_base64` dos dois `SELECT` de lista; novo
    `findMapaById` + **`GET /api/checklist/:id/mapa`** (service `getMapaChecklist`, controller `getMapa`,
    schema `checklistMapaParams`) gated em `authorize(VISTORIADOR, ADMIN)`. No front, `admin.js::verDetalhes`
    virou lazy: mostra "Carregando mapa…" e busca a imagem via `carregarMapaAvaria` ao abrir o modal,
    mantendo o guard de XSS (regex data-URI + `escHtml`). Sem mudança de schema — só caminho de leitura.
  - **Testado no servidor (admin, curl):** `/admin/relatorio?limit=5` caiu de **~800 KB → ~60 KB** e
    **0** ocorrências de base64; idem `/veiculos/:id/historico`. `GET /checklist/53/mapa` → **200** com
    o PNG (172 KB); inexistente → **404**; id inválido → **400**; sem cookie → **401**. UI: modal carrega
    o mapa lazy. (Blank-map ainda renderiza `<img>` — comportamento **pré-existente**, fora do escopo.)
  - **Fase 2 (diferida):** mover as imagens para fora da linha (object storage R2/S3) — rastreada no
    `BACKLOG.md` ativo, pareia com **B14**.

- ✅ **A14 — Logs com PII sem gate de ambiente (LGPD)** *(item completo — fatia CPF em 2026-06-26; fatia logger em 2026-06-30, deployada/testada/commitada)*

  **Fatia CPF** — Remover `motorista_cpf` dos payloads de relatório/histórico *(concluído em 2026-06-26 — deployado, testado e commitado)*
  `GET /veiculos/:id/historico` (aberto a **qualquer** autenticado) e `GET /admin/relatorio` (exposto ao
  vistoriador pelo A7) retornavam `motorista_cpf` de toda inspeção — qualquer um lia o CPF de outros
  motoristas (PII/LGPD), sem que o frontend sequer renderizasse o campo.
  - **Correção:** removido `f.cpf as motorista_cpf` de `findRelatorio` e `findHistoricoByVeiculo`
    (`checklist.repository`). Nenhuma mudança de frontend — nada consumia `motorista_cpf`. CPF segue
    disponível só na gestão de funcionários (`/admin/funcionarios`, admin-scoped).
  - **Testado no servidor (admin, curl):** ambos os endpoints retornam **0** ocorrências de
    `motorista_cpf`, mantendo `motorista` (nome) e `motorista_matricula`.
  **Fatia logger** — Logger com níveis, gate de PII em `debug` *(concluído em 2026-06-30 — deployado, testado com submit real e commitado `d316bf8`)*
  - `checklist.service` e `veiculo.repository.updateKm` faziam `console.log` de matrícula/KM/tamanho do
    base64 em **toda** escrita, sem gate de env (PII + ruído de alto volume em produção).
  - **Correção:** novo `src/utils/logger.js` — logger zero-dependência com níveis (`error`/`warn`/`info`/
    `debug`), gated por `LOG_LEVEL`. Default `info` em produção (debug suprimido → **sem PII**), `debug`
    fora de prod. error/warn → stderr, info/debug → stdout (combina com AppStdout/AppStderr do NSSM, B8).
  - Todos os `console.*` do backend roteados pelo logger: os logs de PII viraram `logger.debug`
    (silenciosos em prod); `checklist.service`, `veiculo.repository`, `validate.middleware`,
    `errorHandler.middleware`, `database.js`, `index.js`. `LOG_LEVEL` documentado em `.env.example`.
    **Sem nova dependência** (só copiar os `.js`; sem `npm ci`).
  - **B1 segue aberto:** é só frontend (`admin.js`, `auth.js`, `checklist.js`, `frota.js`,
    `pdf-engine.js`) — não tocado aqui; esta fatia foi backend-only.
  - **Testado no servidor:** `/health`, login válido/inválido (400), e **submit real de checklist**
    (vistoriador, veículo 2, `km_atual` 60000 → 60001, HTTP 201) — log do servidor **silencioso** para o
    request (nenhuma linha de matrícula/KM), confirmando o gate de PII em prod.
  - Os `console.*` de `scripts/` (CLIs rodados à mão) foram deixados como estão — fora do escopo do sink.

---

## 🟡 Médio — concluído

- ✅ **M12 — Invariantes de KM no nível do banco (defense-in-depth)** *(concluído em 2026-07-01; DDL aplicado no banco vivo)*
  Toda regra de KM vivia só no código (Zod); uma escrita direta / futuro segundo escritor / bug furava tudo.
  Adicionados CHECK constraints (MariaDB 10.4 impõe) — aplicados no vivo, **todos os ALTER passaram sem erro**
  (⇒ dados existentes conformam):
  ```sql
  ALTER TABLE veiculos    ADD CONSTRAINT chk_veiculos_km_atual    CHECK (km_atual >= 0);
  ALTER TABLE checklists  ADD CONSTRAINT chk_checklists_km_entrada CHECK (km_entrada >= 0);
  ALTER TABLE bdv         ADD CONSTRAINT chk_bdv_km_inicial        CHECK (km_inicial >= 0);
  ALTER TABLE bdv         ADD CONSTRAINT chk_bdv_km_final          CHECK (km_final IS NULL OR km_final >= 0);
  ALTER TABLE bdv_paradas ADD CONSTRAINT chk_paradas_km           CHECK (km IS NULL OR km >= 0);
  ALTER TABLE bdv         ADD CONSTRAINT chk_bdv_km_final_ge_inicial CHECK (km_final IS NULL OR km_final >= km_inicial);
  ```
  A última (cross-column, opcional) também passou → nenhuma correção deixou `km_final < km_inicial`.
  Registrado aqui porque não há `schema.sql` versionado (ver **B17**).
  - **Deliberadamente FORA:** "um BDV aberto por veículo/motorista" via `unique` — o `FOR UPDATE` já serializa
    (ver **M10**); exigiria tabela `bdv_ativos`. Revisitar só se surgir um segundo caminho de escrita.

- ✅ **M7 — Rate limiting além do login + `/health` como vetor de DoS** *(concluído em 2026-07-01; deployado e testado no servidor vivo, em duas fatias)*
  Só `POST /api/login` era limitado; o resto era irrestrito, e `/health` esgotava o pool. Fechado:
  - **Fatia `/health` (`src/routes/index.js`):** era público, sem auth, e pegava uma conexão do pool
    (`SELECT 1`) a **cada** chamada — martelar esgotava as 10 conexões (pareia com o fail-fast do **M8**).
    Agora **cacheia o resultado** por `HEALTH_CACHE_MS` (env, default 5000) e **coalesce checagens
    concorrentes** numa única Promise em voo (`healthInFlight`, anti-thundering-herd): sob qualquer taxa, o
    pool é tocado no **máx. 1x por janela**. Verificado: 20 requests → `timestamp` idêntico; após a janela,
    avança.
  - **Fatia rate limiter global (`src/middlewares/rateLimit.middleware.js`, montado cedo no `index.js`):**
    limiter in-memory por IP em **métodos que alteram estado** (POST/PATCH/…); GET/HEAD/OPTIONS passam livres
    (dashboards fazem muitos GETs; `/health` já é cacheado). Cobre as rotas de correção (A7) e qualquer flood
    de escrita. Default `RATE_LIMIT_MAX=120` / `RATE_LIMIT_WINDOW_MS=60000` (env). Novo
    `ERROR_CODES.RATE_LIMIT_EXCEEDED` → `429`. Mesma premissa single-process do login limiter (store
    compartilhado fica no **M2**); chaveado por IP (por-usuário é refinamento futuro). Verificado no vivo:
    120 writes passam, o 121º → `429 RATE_LIMIT_EXCEEDED`; GET/`/health` seguem 200 durante o bloqueio.
  - **Fora do escopo do M7:** o **cap de negócio** de paradas por BDV (máx. N por viagem) continua sendo o
    **B16** — é um limite de contagem no serviço/DB, não rate limit por IP.

- ✅ **M8 — Pool de conexões: `acquireTimeout` + mapeamento 503** *(concluído em 2026-07-01; deployado e testado no servidor vivo)*
  Toda request segurava uma conexão do pool (10) por toda a sua vida; sob starvation (~10 leituras lentas
  concorrentes prendendo todas as conexões) a request pendente pendurava indefinidamente à espera de uma
  conexão livre — o **A11** (base64 fora das listas) já reduziu o tempo que cada conexão fica presa, mas
  faltava o teto de espera. Fechado:
  - **`acquireTimeout` no pool** (`config/database.js`): teto configurável via `DB_ACQUIRE_TIMEOUT`
    (default 10000 ms). Falha rápida com `ER_GET_CONNECTION_TIMEOUT` em vez de enfileirar a request.
  - **Mapeamento 503** (`errorHandler.middleware.js`): novo branch para `ER_GET_CONNECTION_TIMEOUT` →
    `503 SERVICE_UNAVAILABLE`, posicionado **antes** do branch genérico `ER_` (o code também começa com
    `ER_`) para não cair em `500 DB_ERROR`. Sobrecarga transitória ≠ falha do banco.
  - Novo `ERROR_CODES.SERVICE_UNAVAILABLE` (`utils/constants.js`); `DB_ACQUIRE_TIMEOUT` documentado no
    `.env.example`. Verificado: boot limpo com a nova opção do pool + smoke test (login + leitura autenticada)
    sem regressão. O caminho 503 é provado por construção (ordem dos branches + code confirmado) — saturar as
    10 conexões no servidor vivo não vale o risco.

- ✅ **M14 — Resiliência de conexão em rede móvel (timeout + guard de double-submit)** *(concluído em 2026-07-01; deployado e testado)*
  Motoristas em campo, em celular com cobertura instável — o cliente assumia rede confiável. Duas lacunas fechadas:
  - **Timeout de request (fim do hang infinito):** `apiFetch` (`config.js`) agora roda sob `AbortController`
    com teto de 20 s (`opts.timeoutMs` sobrescrevível). No estouro, lança Error com `isTimeout === true` e
    mensagem amigável ("conexão lenta ou instável…"); os chamadores exibem `err.message` no lugar do erro
    genérico. Cobre checklist, abrir/encerrar BDV, paradas e todos os GETs admin de graça. O login (`auth.js`,
    raw `fetch`) ganhou o mesmo `AbortController` à parte.
  - **Guard de double-submit:** novo helper compartilhado `bloquearBotao(btn, texto)` em `config.js` —
    desabilita o botão + troca o rótulo por "⏳ …" durante o POST, retorna uma fn de restauração chamada no
    `finally`. Ligado em `finalizarRelatorio`, `iniciarViagem`, `salvarParada`, `salvarChegada`,
    `encerrarViagem` e no login. **Paradas não têm dedup no banco**, então o bloqueio na UI é a única defesa
    contra a linha duplicada do toque-duplo (liga ao TOCTOU do M10).
  - Arquivos (frontend-only): `config.js`, `auth.js`, `checklist.js`, `bdv.html` (4 handlers + os 4
    `onclick="…(this)"`). `checklist.html` já passava `event`. Verificado com throttling do DevTools.

- ✅ **M10 — TOCTOU em `closeBDV` / paradas (re-lock dentro da transação)** *(concluído em 2026-06-30; verificado no servidor vivo)*
  `addParada`/`closeParada` rodavam **sem transação e sem row-lock**, e `closeBDV` checava o status do BDV
  **fora** da transação (travava só o veículo) — dois requests concorrentes (double-tap/retry) podiam ambos
  passar (paradas duplicadas / KM obsoleto / duplo encerramento sobrescrevendo `km_final`).
  - **Correção (`bdv.repository.js`):** novo `findBDVByIdForUpdate` — `SELECT ... FOR UPDATE` enxuto que
    trava **só a linha do `bdv`** (sem JOINs/paradas), para re-validação dentro da transação.
  - **Correção (`bdv.service.js`):**
    - `addParada` / `closeParada` agora abrem transação, travam a linha do BDV via `findBDVByIdForUpdate`,
      e só então fazem as checagens de ownership/status/KM e a escrita — tudo serializado sob o lock.
    - `closeBDV` mantém os rejects fail-fast fora da tx, mas dentro da tx **re-trava a linha do `bdv`** e
      **re-afirma `status='aberto'`**; o teto de `maxParadaKm` também foi movido para dentro do lock (um
      `addParada` concorrente não consegue mais empurrar um KM maior depois da checagem).
  - **Ordem de lock global `bdv → veiculo`** (igual ao `openBDV`, que trava só o veículo e insere uma linha
    nova de bdv) — sem ciclo de deadlock.
  - **Verificado (curl e2e, 10.10.1.100:3000):** fluxo completo do motorista (checklist → abrir BDV →
    parada → encerrar) sem regressão (201/200); **dois `encerrar` concorrentes** no mesmo BDV →
    sempre **um `200` + um `409` "BDV já encerrado"** (2 rodadas), nunca dois `200`, sem `500` nem
    deadlock; estado do veículo transita `em_uso → disponivel` com `km_atual` correto.
  - **Relacionado:** **B16** (cap de paradas/BDV) e **M14** (guard de double-submit no front) seguem abertos.

- ✅ **M13 — Enumeração de usuário por timing no login** *(concluído em 2026-06-30; verificado no servidor vivo)*
  `authService.login` retornava **imediatamente** no caminho "usuário inexistente", enquanto um usuário
  real pagava ~100ms de `bcrypt.compare` — a diferença permitia enumerar `matricula`/`CPF` válidos por
  tempo de resposta.
  - **Correção (`auth.service.js`):** `DUMMY_HASH = bcrypt.hashSync('timing-equalization-dummy', 10)`
    computado uma vez na carga do módulo (cost 10, igual aos hashes reais de `createFuncionario`/script de
    migração). No `if (!funcionario)`, roda um `await bcrypt.compare(senha, DUMMY_HASH)` descartável antes
    de lançar o 401, igualando o tempo ao do caminho "senha errada".
  - **Verificado (curl, 10.10.1.100:3000):** matrícula inexistente vs. matrícula real + senha errada agora
    ficam na mesma faixa (~0,227s vs. ~0,233s, diferença dentro do jitter de rede); antes o inexistente
    voltava quase instantâneo. Teste auto-reseta a janela do rate limiter via login bem-sucedido entre as
    medições.
  - **Caveat (fora do escopo, registrado):** senhas **legadas em texto plano** ainda comparam com `===`
    (instantâneo) — um usuário plaintext com senha errada continua distinguível por timing. O fix correto é
    concluir a migração para bcrypt (`scripts/migrate-passwords.js`), não adicionar atraso artificial. O
    admin (matrícula 3) já é bcrypt — confirmado pela faixa de ~0,23s no teste.
  - **Pendências relacionadas:** lockout por conta no deploy público segue em aberto (pesar contra
    DoS-por-lockout); o rate limiter por IP (M2) ajuda mas é compartilhado por NAT e reseta no restart.

- ✅ **M3 — Vazamento de detalhes em erros 500** *(concluído em 2026-06-10)*
  Branch genérico (500 inesperado) em `errorHandler.middleware.js` agora retorna mensagem
  genérica quando `NODE_ENV === 'production'`, expondo `err.message` apenas em dev. Branches de
  `err.statusCode` mantidos (mensagens hardcoded ou template com números validados). `.env.example`
  passou a documentar `NODE_ENV` + `DB_CONNECTION_LIMIT`, `JWT_EXPIRES_IN`, `HOST`.
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
  > servidor. Após este deploy, clientes que ainda enviem só o header `Authorization` recebem 401.

  **Achado completo:**
  - Token JWT guardado em `localStorage` → roubável via XSS (vetor que A1/S1 vêm mitigando).
  - **Não existia endpoint de logout no backend.** Logout era 100% client-side (`localStorage.clear()`
    + redirect). O JWT em si nunca era invalidado.
  - **Sem revogação:** JWT stateless; um token capturado continuava válido até expirar.
  - **Dispositivos compartilhados:** motoristas usam celulares/tablets compartilhados → janela de
    exposição de um token vazado é grande.

  > 🎯 **Opção D (arquitetura-alvo ao ir a público):** **refresh token rotation** — access token curto
  > (~15 min) + refresh token rotativo e revogável (server-side). Permite logout real e revogação
  > imediata. Conecta-se ao store compartilhado do **M2** (denylist/refresh store).

  ### Plano de implementação (registro histórico — todas as fases concluídas)

  **Decisões:** `cookie-parser` ✅ · helper `apiFetch` ✅ · CSRF por checagem de Origin ✅ · `GET /api/me` ✅

  **Restrições de arquitetura:**
  - Frontend `:10081` e backend `:3000` → **mesmo host (same-site), origem diferente (cross-origin)**.
    Cookie `SameSite=Lax` é enviado; CORS precisa de `credentials: true` + origem específica + `fetch`
    com `credentials: 'include'`.
  - **HTTP na LAN agora, HTTPS (Cloudflare) depois** → flag `secure` do cookie dirigida por **env**
    (`false` na LAN, `true` em produção). `SameSite=None` impossível em HTTP → usar `Lax`.
  - **httpOnly quebra os guards client-side:** os ~30 `getItem('token')` usados como "estou logado?"
    passaram a checar presença de **`usuario`** (UX) + tratamento de **401 → login** (enforcement real).

  **Fase 0 — quick win:** `JWT_EXPIRES_IN=2h`.

  **Fase 1 — Backend, retrocompatível** ✅ *(implementado em 2026-06-11)*
  - `cookie-parser` instalado; CORS com `credentials:true` e allowlist extraída para `src/config/cors.js`
    (fonte única, compartilhada com o CSRF).
  - `src/utils/cookie.js` (nome do cookie + opções set/clear idênticas + `parseDurationMs` → `maxAge`
    derivado de `JWT_EXPIRES_IN`).
  - `login` grava cookie httpOnly (e ainda retornava token no body nesta fase); novos `logout` (limpa
    cookie, público) e `me` (`GET /api/me`); `auth.middleware` dual-read (cookie primeiro, fallback header).
  - `src/middlewares/csrf.middleware.js` (Origin/Referer vs. allowlist, global p/ métodos de escrita).
  - `.env.example`: `COOKIE_SECURE` (dirige `secure`, **não** via NODE_ENV), `COOKIE_DOMAIN`,
    `JWT_EXPIRES_IN=2h`.

  **Fase 2 — Frontend (página por página)** ✅ *(concluída em 2026-06-15)*
  - `config.js`: helper `apiFetch` com `credentials:'include'`; em 401 limpa estado, redireciona ao
    login e lança Error com `isAuthRedirect` p/ o catch do chamador pular alertas duplicados.
  - `auth.js`: login com `credentials:'include'`, **removido `setItem('token')`**.
  - `menu.html`, `frota.js`+`selecao.html` (removido write morto de `veiculo_tipo`), `checklist.html`+
    `checklist.js`, `bdv.html` (16 sites), fluxo admin (`admin.js`, `admin.html`, `admin-bdv.html`,
    `admin-funcionarios.html`, `admin-dashboard.html`): guards `token`→`usuario`+nível; todas as chamadas
    via `apiFetch`; 401 manual removido; `fazerLogout` → `POST /api/logout`. Navegação admin padronizada
    no hub `admin-dashboard.html`.

  **Fase 3 — Limpeza do backend** ✅ *(concluída em 2026-06-15, irreversível)*
  - Removido o fallback de header `Authorization` (cookie-only); login parou de retornar `token` no body;
    `JWT_EXPIRES_IN=2h` alinhado ao `maxAge` do cookie.
  > ⚠️ Ao ir a público: virar `secure:true`; se frontend/API ficarem em sites realmente distintos, mudar
  > para `SameSite=None; Secure` + **CSRF double-submit** → ponte para a **Opção D**.

### M1 (porção concluída) — configuração do helmet no backend
`helmet` instalado e configurado em `backend/index.js`: CSP com `script-src 'self'` + **nonce por
requisição** (`res.locals.cspNonce`), `style-src 'self' 'unsafe-inline'`, `img-src 'self' data:` (mapa
de avaria base64), `frame-ancestors 'none'`, `object-src 'none'`, `base-uri 'self'`. `X-Powered-By`
removido; `nosniff` e `X-Frame-Options` ativos. `hsts: false` (app em HTTP/LAN). Helmet aplica
`script-src-attr 'none'` por padrão → bloqueia handlers inline (ver M1-b).
> ✅ **Decisão (opção A):** M1 fica como **endurecimento apenas do backend**. O CSP das **páginas HTML
> do admin** (servidas pelo `:10081`) será entregue via **headers do Cloudflare** quando publicado (CSP
> por **hash**, não nonce); reativar `hsts` (HTTPS) nessa etapa. *(M1-b/M1-c continuam pendentes em
> `BACKLOG.md`.)*

- ✅ **M5 / M5-b — Vulnerabilidades de dependências + migração `bcrypt`→`bcryptjs`** *(fechado em 2026-06-25 — `npm audit` no `backend/` → **0 vulnerabilidades**)*
  - ✅ `qs` (**moderada**, DoS remoto em `qs.stringify`) via `express` — **corrigido**: `express`
    resolvido para `4.22.2` no `package-lock.json`.
  - ✅ `tar` ≤7.5.10 (**alta** ×2, path traversal na extração) via `@mapbox/node-pre-gyp` → `bcrypt`:
    eram só exploráveis em tempo de instalação (extração do binário nativo do bcrypt), não no runtime.
    **Eliminadas** ao trocar a cadeia nativa por `bcryptjs` (M5-b) — `package.json` lista `bcryptjs
    ^2.4.3` (sem `bcrypt`) e a lockfile não tem mais `tar`/`@mapbox/node-pre-gyp`.
  - ✅ **M5-b (bcryptjs):** `bcryptjs` puro-JS, remove `@mapbox/node-pre-gyp` + `tar`, elimina build
    nativo, API drop-in (hashes `$2a$`/`$2b$` compatíveis). `auth.service.js` e
    `scripts/migrate-passwords.js` já fazem `require('bcryptjs')`. **Confirmado em 2026-06-25** por
    `npm audit --prefix backend` → `found 0 vulnerabilities`. Sem ação de servidor pendente (mudança já
    no `package.json`/lockfile commitados).

---

## 🟢 Baixo — concluído

- ✅ **B20 — PKs `auto_increment` migradas de `int(11)` para `bigint(20)`** *(concluído em 2026-07-01; DDL aplicado no banco vivo + fix de app deployado e testado)*
  O checup revelou que os PKs core **eram `int(11)`** (não `bigint`, ao contrário do que o CLAUDE.md dizia) —
  só `correcoes*` (A7) já eram `bigint`. Overflow era inatingível no domínio (teto 2,14 bi), mas migrado como
  seguro para o futuro público/multi-tenant **enquanto as tabelas estavam com mock data descartável**.
  - **Schema (DDL no vivo, registrado aqui pois não há `schema.sql` versionado — ver B17):** `matricula`
    (funcionarios), `id` (veiculos, checklists, bdv, bdv_paradas) → `bigint … AUTO_INCREMENT`, e as 7 colunas
    FK que os referenciam, em lockstep (drop FK → `MODIFY` → re-add FK com os nomes originais `*_ibfk_*` /
    `fk_correcoes_func`). Nullability preservada (`bdv.checklist_id` continua NULL).
  - **Fix de app OBRIGATÓRIO (`src/config/database.js`):** o driver `mariadb` v3 devolve `BIGINT` como
    **BigInt** JS. Sem tratamento, o guard de posse `bdv.matricula !== req.user.matricula` (bdv.service, 4
    sites) quebra — `BigInt !== Number` é sempre `true` → **403 para o próprio dono**. Confirmado ao vivo: os
    403 apareceram exatamente após a migração. Resolvido com `bigIntAsNumber: true` + `insertIdAsNumber: true`
    (+ `checkNumberRange: true`): campos numéricos voltam a ser `Number` (teto efetivo 2^53, ~4 mi× o `int`),
    tornando o app agnóstico a int/bigint. **Requer re-login** (o token antigo trazia `matricula` string).
  - **Verificado no vivo pós-fix:** cadeia completa do motorista — checklist → abrir BDV → **addParada 201**
    → **encerrar 200** (os guards de posse passam); relatórios admin, histórico, `/correcoes` e ambos os
    logins → 200. Ver [[schema-pk-bigint-and-driver-config]].

- ✅ **B2 — Política de senha mais forte** *(concluído em 2026-07-01; deployado e testado no servidor vivo)*
  `createFuncionario` (`validate.middleware.js`) exigia só **mín. 6 caracteres**. Agora: **mín. 8** +
  ao menos **uma letra** e **um número** (regex Zod). Vale só para usuários **novos** — não afeta logins
  existentes (senhas legadas/plaintext seguem via dual-support no `auth.service`). Verificado no vivo:
  `"123"` → 400 (curto + sem letra); `"abcdefgh"` → 400 (sem número); sem usuário criado (falha antes do INSERT).

- ✅ **B16 — Cap de paradas por BDV** *(concluído em 2026-07-01; deployado e testado no servidor vivo)*
  `addParada` era escrita ilimitada por viagem (token comprometido / bug de UI inflava `bdv_paradas` sem
  teto). Agora `bdv.service.addParada` conta as paradas **sob o lock do BDV** (`countParadas` no repo, mesma
  serialização do guard de KM — inserts concorrentes não furam o cap) e rejeita com **409** ao atingir
  `BDV_MAX_PARADAS` (env, default 200). Verificado por construção (contagem sob lock + threshold) + boot limpo;
  prova do 409 disponível baixando o teto via env sob demanda.

- ✅ **B18 — Drain do pool no shutdown gracioso** *(concluído em 2026-07-01; deployado)*
  SIGTERM/SIGINT faziam `process.exit(0)` na hora — matavam requests em voo e deixavam as conexões do pool
  penduradas. Agora (`index.js`): captura o `server` do `app.listen`, no sinal para de aceitar conexões
  (`server.close`), deixa as em andamento drenarem, fecha o pool (`pool.end()`) e sai; timeout de 10s
  (`unref`) força a saída se o drain travar, e um flag `encerrando` ignora sinais repetidos. Não é
  curl-testável — verificado por boot limpo (server/shutdown novos carregam) + log `[SHUTDOWN] … pool
  encerrados` no restart.

- ✅ **B22 — Compressão gzip/brotli no backend** *(concluído em 2026-07-01; deployado e testado no servidor vivo)*
  Não havia middleware de compressão — JSON trafegava cru, caro em rede móvel (relatórios admin com
  `mapa_avaria_base64` são grandes e base64 é altamente compressível). Adicionado `compression()`
  (dep `compression` no `package.json`) cedo na cadeia do `index.js`. Verificado no vivo: relatório admin
  **111.432 → 2.454 bytes** no fio (`Content-Encoding: br`, ~45×). Nota BREACH: app em HTTP/LAN; o JWT vive
  em cookie httpOnly (não ecoa no corpo), então o vetor é baixo ao ir a HTTPS.

- ✅ **B7 — XSS nas telas do motorista** *(concluído em 2026-07-01; deployado e testado)*
  A auditoria de A1 cobriu só as páginas admin; esta fechou os sinks do lado motorista (auditados 2026-06-24):
  - **`frota.js` (era a aresta afiada):** os cards eram montados com `innerHTML +=` interpolando
    `v.modelo`/`v.placa`/`v.id` crus **no texto HTML** e, pior, **dentro de `onclick="iniciarChecklist('${v.id}', …)"`
    com aspas simples** — um `'`/`<` no modelo/placa quebrava a string JS do atributo → JS arbitrário.
    Reescrito com `createElement` + `textContent` + `addEventListener` (nada é parseado como HTML/JS);
    remove também um handler inline (alinha ao M1-b).
  - **`bdv.html`:** `renderizarParadas` escapava os campos de texto, mas `formatarData` devolvia a entrada
    **crua** no fallback não-data e `${p.km}` era interpolado cru, ambos em `innerHTML`. Escapado o fallback de
    `formatarData` e `km` via `escHtml(String(...))`. Difícil de alcançar (servidor valida `hora_*`/`km`), mas
    fecha o mesmo padrão do A1.
  - **`checklist.js` (já limpo):** o único sink de `innerHTML` interpola o array **constante** `itensChecklist`
    (hardcoded), não dado de servidor/usuário. Sem vetor.
  - Arquivos (frontend-only): `frota.js`, `bdv.html`.

- ✅ **B1 — Remover `console.log` de debug remanescentes** *(concluído em 2026-06-30)*
  Removidos os `console.log` de debug do frontend, mantendo `console.error`/`console.warn` (log legítimo de
  erro): `admin.js` (dump `[DEBUG]` do registro completo + `itens_status` — **PII no console**), `auth.js`
  (`"Iniciando tentativa de login..."` + `Sucesso! Bem-vindo, ${nome}` — vazava o nome do usuário),
  `checklist.js` (`[✓] Canvas carregado`), `frota.js` (`[ID SALVO]`). O `pdf-engine.js` (que tinha o log
  `[✓] PDF gerado`) foi removido inteiro pelo **B21**. Higiene; verificado por `grep` (nenhum `console.log`
  restante em `frontend/client/js/`) + eyeball do usuário no console do navegador.

- ✅ **B21 — Dependência morta do jsPDF via CDN em `checklist.html`** *(concluído em 2026-06-30)*
  Removidas as duas tags `<script>` de CDN externo (`cdnjs.cloudflare.com`: `jspdf.umd.min.js` +
  `jspdf.plugin.autotable.min.js`) do `checklist.html` e **deletado** o `js/pdf-engine.js` (morto:
  `gerarPDF` nunca era incluído em página nem chamado). Elimina ~150 KB de JS render-blocking baixado à toa
  e — mais importante — uma **dependência de internet embutida num app de LAN** (sem saída p/ internet, as
  requests ao cdnjs penduravam/atrasavam a página). Se PDF no cliente voltar a ser desejado, self-hostar o
  jsPDF no `:10081`, nunca via CDN. Verificado por `grep` (nenhuma referência a `jspdf`/`pdf-engine`) +
  eyeball do usuário (Network sem requests ao cdnjs).

- ✅ **B23 — `veiculo.png` com cache-buster a cada checklist** *(concluído em 2026-06-30)*
  Removido o `?t=${timestamp}` do `src` de `veiculo.png` em `inicializarCanvas` (`checklist.js`). A imagem é
  **estática**; sem o cache-buster o navegador a cacheia em vez de re-baixar a cada abertura de checklist
  (economia de dados móveis). Verificado por eyeball do usuário (Network: `veiculo.png` sem query string,
  canvas ainda carrega e desenha).

- ✅ **B4 — Query não-sargável no guard diário (sargável + anti-join)** *(concluído em 2026-06-30 — deployado, testado por curl e commitado `dbefece`)*
  `findPendingTodayByMatricula` (roda em **todo** submit de checklist & abertura de BDV) e seu irmão
  A6 `findPendingDetailTodayByMatricula` combinavam dois problemas de escala: `DATE(data_inspecao) =
  CURDATE()` (derrota índice) + `id NOT IN (subquery)` que varre `bdv` crescendo.
  - **Correção:** reescritos para range sargável (`data_inspecao >= CURDATE() AND < CURDATE() + INTERVAL
    1 DAY`) + `NOT EXISTS (SELECT 1 FROM bdv b WHERE b.checklist_id = c.id)`. `NOT EXISTS` é imune ao trap
    de NULL do `NOT IN`, então o antigo `WHERE checklist_id IS NOT NULL` foi dispensado. Pareia com o
    índice `(matricula, data_inspecao)` do **A12** (ainda pendente). Sem mudança de comportamento.
  - **Testado no servidor (curl):** vistoriador com checklist pendente do dia (id 54, sem BDV vinculado)
    → re-submit retorna **409 `DUPLICATE_ENTRY`** (guard detecta o órfão pela query reescrita), rejeitado
    antes do INSERT. A direção de exclusão (checklist já vinculado não bloqueia) é transform idêntico ao
    `NOT IN` que rodava em prod — confirmada por inspeção (predicado de anti-join padrão).

- ✅ **B6 — Housekeeping do repositório** *(resolvido 2026-06-19)*
  Remover arquivos vazios soltos no working dir (`git`, `main`) e decidir sobre `LICENSE` (untracked).
  > **✅ Resolvido (2026-06-19):** os arquivos vazios `git`/`main` não existem mais; `LICENSE` foi
  > **commitado/rastreado** (entrou no `d47f48e` via `git add -A`). Nada a ignorar.

---

## ✅ Concluído (referência) — série S e correções pontuais

- ✅ **S1** — Escape de XSS em campos controlados no `admin.js` (`312a18d` + hardening em `29e3159`)
- ✅ **S2** — Assertion de `JWT_SECRET` no startup (`9712695`)
- ✅ **S3** — Rate limiting de login, 5 tentativas/IP/15min (`668ddc4`); refinado para contar só falhas + `trust proxy` (`29e3159`)
- ✅ Persistência do link `checklist_id` no BDV (`29e3159`)
- ✅ Correção de bypass do flow lock via botão voltar / bfcache (`f08ed77`, `a82b3d4`)
