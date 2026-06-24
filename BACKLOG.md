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
  - **Correção (não aplicar ainda):** o servidor deve **derivar a matrícula de `req.user`** (do token,
    populado pelo `auth.middleware`) e **ignorar** qualquer `matricula` no corpo — ou, no mínimo,
    rejeitar se `req.body.matricula !== req.user.matricula`.
  - **Mesmo audit nos endpoints de BDV:** `bdv.service.js` / `bdv.controller.js` (abertura de BDV,
    paradas, encerramento) seguem o mesmo padrão de passar `req.body` adiante — confirmar se a
    `matricula` (e o `veiculo_id`/ownership do BDV) também vêm do corpo e migrar para `req.user`.
  - Risco real de **vazamento/atribuição cruzada entre motoristas**; agrava-se sob multi-tenancy (M6),
    onde a matrícula precisa ser escopada por tenant. Relaciona-se a M4 (sessão via cookie) e M6.

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
  - **Colunas/PK erradas:** o script usa `SELECT id, nome, senha_hash FROM funcionarios` e
    `UPDATE ... SET senha_hash = ? WHERE id = ?`. Mas, pelo schema (CLAUDE.md) e por **todos** os
    repositórios, a PK é **`matricula`** (não há `id`) e a coluna de senha é **`senha`** (não há
    `senha_hash`) — `funcionario.repository.js` lê/grava `senha`, e o login autentica contra
    `funcionario.senha`.
    - Melhor caso: lança `Unknown column 'id'/'senha_hash'` e não faz nada (falha rápido).
    - Pior caso: se existir uma coluna `senha_hash` obsoleta, migra o **campo errado** e deixa o `senha`
      real intacto — divergência silenciosa e irreversível.
  - **Detecção só de `$2b$`:** `func.senha_hash.startsWith('$2b$')` ignora `$2a$` e `$2y$` (também bcrypt).
    Qualquer hash desses seria tratado como texto plano e **re-hasheado**, destruindo a senha de forma
    irreversível.
  - **Sem null-guard:** `.startsWith()` em coluna nula/vazia lança `TypeError` no meio da execução.
  - **Sem transação / sem dry-run / sem backup:** operação destrutiva e irreversível (texto plano →
    bcrypt); falha no meio deixa a tabela parcialmente migrada.
  - **Correção (não aplicar ainda):** reconciliar nomes de coluna (`matricula`/`senha`); ampliar a
    checagem de prefixo para `$2[aby]$`; adicionar null-guard; envolver em transação + flag `--dry-run`;
    **verificar o schema vivo antes de rodar de novo.** Relaciona-se a M5-b (`bcrypt`→`bcryptjs`).

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
  > - ✅ **Slice 1 (backend) — feito:** novo `GET /api/checklist/pendente` (repo
  >   `findPendingDetailTodayByMatricula` com JOIN veiculos → `id, veiculo_id, km_entrada, placa, modelo`;
  >   service `getChecklistPendente` espelhando `getBDVAtivo` com 200-ou-404 e BigInt→string; controller
  >   derivando a matrícula do `req.user`; rota com `authenticate`). **Pendente deploy+verificação.**
  > - ✅ **Slice 2 (frontend) — feito:** guard de roteamento em `menu.html` (load + pageshow) e
  >   `checklist.html` (load + pageshow, novo check de órfão **gated a motorista** — vistoriador usa a
  >   mesma página) — precedência `/bdv/ativo` ok → `bdv.html`; senão `/checklist/pendente` ok →
  >   `bdv.html`. Auto-hidratação de `bdv.html` (`DOMContentLoaded`): quando `localStorage.veiculo_id`
  >   está vazio, busca `/checklist/pendente`, grava veículo no localStorage e segue (em vez de cair em
  >   selecao.html); o KM é pré-preenchido pelo `preencherKmInicial` existente. Abrir o BDV reusa o
  >   auto-link já existente no backend (`openBDV` → `findPendingTodayByMatricula`). Tudo via `apiFetch`
  >   com supressão de `isAuthRedirect`. **Pendente verificação no servidor** (deploy de arquivos
  >   estáticos — sem restart do backend): motorista que envia checklist e sai antes do BDV é roteado
  >   de volta a `bdv.html` e consegue abrir/encerrar o BDV; vistoriador não é afetado em nenhum caminho.
  > - 🔧 **Fix override (2026-06-17) — pendente verificação no servidor:** a hidratação de `bdv.html`
  >   agora trata o **checklist órfão como fonte da verdade do seu veículo** e **sobrepõe** qualquer
  >   `localStorage.veiculo_id`/`veiculo_atual`/`modelo_veiculo` obsoleto (antes só hidratava quando o
  >   localStorage estava vazio, podendo abrir o BDV no veículo errado). **Precisa deploy (arquivos
  >   estáticos) + reteste.**
  > - ⚠️ **Premissa da abordagem (a):** assume que o órfão é um checklist **legítimo** — a recuperação
  >   força o motorista a abrir/encerrar o BDV daquele checklist (único caminho de saída). A limpeza de
  >   **órfão equivocado** (descartar/corrigir sem forçar uma viagem) é uma preocupação de **vistoriador
  >   → ver A7** (correção/override role-aware), não do fluxo do motorista.

  Se um motorista **envia o checklist mas sai antes de abrir o BDV**, o guard de duplicidade de
  checklist (`findPendingTodayByMatricula`) bloqueia **qualquer novo checklist naquele dia**, mas
  **nenhum fluxo o roteia para recuperação** — o checklist órfão não está ligado a um BDV e fica
  inacessível. A checagem `GET /bdv/ativo` retorna **404** (não há BDV aberto), então o flow lock
  também **não** o redireciona. Resultado: motorista travado pelo resto do dia, sem caminho de volta.
  - **Precisa de um caminho de recuperação** — decidir a abordagem ao implementar:
    - **(a)** `menu`/`checklist` detecta um checklist-sem-BDV não-vinculado e roteia o motorista para
      **abrir o BDV daquele checklist**;
    - **(b)** permitir **reentrada no checklist** (reabrir/editar o existente);
    - **(c)** **auto-expirar/limpar** checklists não-vinculados (ex.: job ou checagem no load).
  - **Decidir abordagem na implementação.** Relaciona-se ao flow lock linear (CLAUDE.md: "Linear Flow
    Lock") e ao link `checklist_id` ↔ BDV (C1).
  - **Vistoriador faz inspeção sem viagem:** para **vistoriadores**, um checklist é um **estado final
    válido** — o fluxo de BDV e o guard de duplicidade **NÃO** devem se aplicar. A correção de
    recuperação do A6 é escopada **apenas a motoristas**. **Trabalho futuro:** tornar o fluxo
    checklist→BDV **role-aware**, de modo que checklists de vistoriador não disparem o soft-lock nem
    exijam um BDV.

- 🔵 **A7 — Capacidades de correção/override do vistoriador (papel de supervisor)** *(backend completo e verificado em prod 2026-06-22; slice 4 (UI) pendente clarificação de fluxo operacional)*
  O papel **vistoriador** deve poder: **(1)** definir/corrigir qualquer valor de **KM**, inclusive
  **sobrepondo a validação de monotonicidade do KM** (caso um motorista tenha digitado errado); e
  **(2)** sinalizar e corrigir uma gama de erros em **checklists/BDVs**. É um papel de **override de
  nível supervisor**, distinto de **motorista**. Esta é a **especificação autoritativa de implementação**
  (substitui o placeholder "documentar apenas").

  ### Onde o guard de KM mora hoje (4 checagens, não 1)
  A monotonicidade não é uma checagem única — todas se ancoram em `veiculos.km_atual`, mutado sob
  `findByIdWithLock` (`SELECT … FOR UPDATE`):
  - `checklist.service.createChecklist` — `km_entrada < km_atual` → `KM_INVALID`; escreve `updateKm(km_entrada)`.
  - `bdv.service.openBDV` — `km_inicial < km_atual`; escreve `updateKm(km_inicial)`.
  - `bdv.service.addParada` — `km < lastParada.km` **e** `km < km_inicial`.
  - `bdv.service.closeBDV` — `km_final < km_inicial` **e** `km_final < maxParadaKm`; escreve `updateKm(km_final)`.

  `veiculos.km_atual` é a **âncora monotônica canônica**. Toda correção que mexe em KM precisa tratar
  `km_atual` como campo corrigível de primeira classe — corrigir o KM de um registro sem realinhar a
  âncora deixa o piso da próxima submissão de motorista errado.

  ### (2) Trilha de auditoria — requisito central. Esquema de **duas tabelas** (decisão §6.4)
  Cabeçalho + diff por campo. Uma ação de correção = 1 linha de cabeçalho + N linhas de campo (um
  único `motivo` e timestamp, mas consultável por campo). **Append-only** (sem `UPDATE`/`DELETE` no
  repositório; idealmente o usuário de banco do app só recebe `INSERT`/`SELECT` nessas tabelas).
  Schema aplicado **manualmente** (sem arquivo de migration — convenção do projeto).

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

  Decisões embutidas:
  - **`valor_antigo`/`valor_novo` como TEXT, não tipados** — a mesma tabela audita `km` numérico,
    `status` enum e `itens_status` JSON. Guarda o snapshot literal; para JSON guarda o blob serializado
    inteiro (sem diff interno — isso fica na UI).
  - **`km_override` no cabeçalho** — torna "o vistoriador quebrou a monotonicidade de propósito" um
    evento filtrável de primeira classe, distinto de um conserto de campo de rotina.
  - **`coligada` desnormalizada no cabeçalho** — auditoria escopada por tenant (M6) sem join de volta
    pelo registro corrigido (cujo `coligada` pode ter sido o campo corrigido).
  - **Append-only** — o modo de falha a projetar para fora é a auditoria corrigindo a auditoria.

  ### (3) Caminho de escrita separado: `correcao.service.js` (sem guard monotônico)
  **Princípio: NÃO adicionar `if (role === vistoriador) skip guard` dentro dos services do motorista.**
  Isso entrelaça dois papéis num mesmo caminho e faz um bug na checagem de papel desativar o guard para
  todos. Em vez disso:
  - **Caminho de escrita separado** — novo `correcao.service.js` com métodos próprios
    (`corrigirChecklist`, `corrigirBDV`, `corrigirParada`, `corrigirKmVeiculo`). Esses métodos
    **simplesmente nunca chamam a checagem monotônica** — o bypass é a *ausência* do guard num caminho
    diferente e gated por papel, não um condicional dentro do caminho guardado. `checklist.service` /
    `bdv.service` ficam **intocados** — o fluxo do motorista fica comprovadamente inalterado.
  - **Disciplina de transação + lock preservada** — correções que tocam KM ainda fazem
    `findByIdWithLock` na linha do veículo e rodam dentro de `beginTransaction`/`commit`.
  - **Regra de auditoria na mesma transação** — o `INSERT` de auditoria acontece **na mesma transação**
    da correção: se a escrita de auditoria falhar, a correção sofre `rollback`. **Sem edições silenciosas.**

  ### (1) Modelo de permissão — gate no nível de rota
  - **`authorize(ROLES.VISTORIADOR, ROLES.ADMIN)`** em todas as rotas `/api/correcoes/*` (espelha a
    decisão "gate na rota" do A9, mantendo o gate visível em `routes/index.js`). A resposta a "quem pode
    quebrar a monotonicidade?" fica inteiramente em dois lugares: o `authorize(VISTORIADOR, ADMIN)` da
    rota e a existência de `correcao.service`.
  - **Não** alargar o `authorize` das rotas de motorista (apesar do comentário `A7-coupled` nelas) — as
    rotas de motorista impõem ownership + monotonicidade, que é exatamente o que uma correção **não**
    deve fazer. Correções vivem no namespace dedicado `/correcoes/*`.

  ### (4) Campos corrigíveis vs. imutáveis
  **Corrigíveis (com auditoria):**
  - `checklists`: `km_entrada`, `itens_status`, `local_origem`, `local_destino`, `mapa_avaria_base64`.
  - `bdv`: `km_inicial`, `km_final`, `combustivel_retorno`, `coligada`, `encerrado_fora_base`.
  - `bdv_paradas`: `km`, `hora_saida`, `hora_chegada`, `local_saida`, `local_chegada`, `observacao`.
  - `veiculos`: `km_atual` (a âncora).

  **Imutáveis (nunca editáveis, nem pelo vistoriador):**
  - **Chaves primárias** (`id` em toda tabela).
  - **Procedência `matricula` / `veiculo_id`** — *quem* fez e *qual veículo*. Corrigir "motorista errado"
    ou "veículo errado" re-parenteia o registro; fica **fora de escopo** (eventual operação "reassign"
    separada e mais pesada, não uma edição de campo).
  - **`bdv.checklist_id`** — o vínculo 1:1 checklist→BDV imposto pelo A10. Estrutural, imutável.
  - **Timestamps de sistema** `data_abertura` / `data_encerramento` — carimbados pelo sistema; imutáveis.
  - **`bdv.status`** — **§6.1: imutável.** Correções são **field-only**; **não há reabertura** de BDV
    encerrado (`encerrado`→`aberto`) via correção. Reabrir é materialmente diferente de consertar um campo.
  - **As próprias tabelas de auditoria.**

  ### §6 — Decisões resolvidas (2026-06-18)
  - **§6.1 — `bdv.status` imutável / correções field-only, sem reabertura.** Sem transição
    `encerrado`→`aberto` pela correção.
  - **§6.2 — Realinhamento de âncora: set explícito + helper de recompute, sem auto-recompute.** Quando
    uma correção muda o KM do registro que hoje define `km_atual`, o vistoriador **seta explicitamente** a
    âncora via `PATCH /api/correcoes/veiculo/:id/km` (sob o row-lock). Um **helper de recompute**
    (`km_atual = MAX(último checklist km_entrada, último BDV encerrado km_final)`) fica disponível como
    apoio, mas **não** dispara automaticamente — a âncora é sempre uma decisão explícita e auditada.
  - **§6.3 — `motivo` obrigatório quando `km_override = 1`, opcional caso contrário.** Override de KM
    exige justificativa; consertos comuns de campo, não.
  - **§6.4 — Auditoria em duas tabelas** (`correcoes` + `correcoes_campos`), conforme schema acima.

  ### Pré-requisito — mudança deliberada de controle de acesso
  O vistoriador **precisa de acesso de leitura aos dashboards de auditoria**, hoje `authorize(ADMIN)`
  apenas (`GET /api/admin/relatorio`, `GET /api/admin/bdv`). O vistoriador não pode corrigir o que não
  vê. Decisão deliberada: **relaxar esses gates de GET para incluir `VISTORIADOR`** (ou adicionar
  endpoints de relatório escopados ao vistoriador). Tratar como mudança de access-control explícita —
  reconciliar com A3 (acesso por objeto) e M6 (escopo de `coligada`/tenant).

  ### Superfície de API (novos endpoints)
  Todos `authenticate` → `authorize(VISTORIADOR, ADMIN)` → `validate(...)`; o middleware CSRF já cobre
  métodos de mutação.

  | Método | Path | Propósito |
  |--------|------|-----------|
  | PATCH | `/api/correcoes/checklist/:id` | Corrigir campos do checklist (body: campos alterados + `motivo`) |
  | PATCH | `/api/correcoes/bdv/:id` | Corrigir campos do BDV |
  | PATCH | `/api/correcoes/bdv/:id/paradas/:paradaId` | Corrigir uma parada |
  | PATCH | `/api/correcoes/veiculo/:id/km` | Setar a âncora de KM do veículo (§6.2) |
  | GET | `/api/correcoes?entidade=&entidade_id=` | Ler o histórico de correções de um registro |

  ### UI (alto nível)
  - Acesso de leitura do vistoriador aos dashboards de auditoria (pré-requisito acima).
  - Afordância "Correção" em cada registro nas telas de auditoria (gated em
    `usuario.nivel_acesso in (vistoriador, admin)` no front, seguindo o padrão de papel via localStorage).
    Abre um formulário pré-preenchido.
  - No salvar: **mostrar o diff** (antigo → novo por campo) e **exigir `motivo`** quando aplicável; uma
    edição de KM que quebra a monotonicidade mostra confirmação explícita de "override" que seta `km_override`.
  - **Timeline de auditoria por registro** (lê `GET /api/correcoes`) — quem mudou o quê, quando e por quê.

  ### Fatiamento de entrega
  1. ✅ **Tabelas de auditoria + `correcao.service` + endpoints PATCH** (checklist/bdv/parada) com gate
     `authorize(VISTORIADOR, ADMIN)` e regra de auditoria-na-mesma-transação. *(deployado e verificado em prod)*
  2. ✅ **Realinhamento de âncora** — `PATCH /correcoes/veiculo/:id/km` + helper de recompute (§6.2). *(deployado e verificado em prod)*
  3. ✅ **Endpoint de histórico** — `GET /api/correcoes` + pré-requisito de leitura dos dashboards
     (`GET /api/admin/relatorio` e `GET /api/admin/bdv` relaxados para `authorize(VISTORIADOR, ADMIN)`). *(deployado e verificado em prod)*
  4. ⬜ **UI** — afordância de correção, diff + `motivo`, timeline de auditoria.
     > ⏸ **Deferido — pendente clarificação de fluxo operacional com o setor de logística.**
     > Questões em aberto antes de desenhar a UI: (a) o vistoriador reutiliza o `checklist.html`
     > existente ou precisa de um formulário de inspeção pós-retorno separado?
     > (b) qual é o fluxo diário completo do vistoriador, do início ao fim?
     > O backend (slices 1–3) é totalmente funcional — o vistoriador já pode executar todas as
     > correções via API enquanto a UI aguarda definição.

  - Liga-se ao trabalho **role-aware** de checklist/BDV da nota de vistoriador do **A6**. Também se
    relaciona ao controle de acesso por objeto (A3) e ao planejamento multi-tenant (M6, escopo de
    `coligada`/tenant para correções).

- 🔵 **A8 — `bdv.html` bug de ordenação: guard de veículo roda antes da checagem de viagem ativa** *(corrigido, pendente verificação no servidor)*
  > **Fix implementado (2026-06-17), pendente deploy (arquivos estáticos) + reteste:** `verificarBDVAtivo()`
  > virou o ponto de decisão no `DOMContentLoaded` (agora `await`ado). 200 (viagem ativa) → `andamento`,
  > **sem** exigir `veiculo_id`. O guard de veículo foi extraído para `exigirVeiculoParaNovaViagem()` e
  > roda **antes de qualquer saída para o estado 'abrir'** (404, fall-through não-200 e catch de erro) —
  > nunca antes do `/bdv/ativo` resolver. Hidratação de órfão (A6) permanece antes da checagem.
  Um motorista **em viagem** com `localStorage.veiculo_id` vazio é mandado para `selecao.html`
  **antes** de `/bdv/ativo` ser checado — então ele **não consegue chegar à sua viagem ativa**.
  - **Repro:** abrir um BDV, limpar o `localStorage` (ou sessão/dispositivo novo), navegar para
    `bdv.html` → é jogado para `selecao.html` em vez da viagem ativa.
  - **Fix:** checar `/bdv/ativo` (e `/checklist/pendente`) **antes** de exigir `veiculo_id`, de modo
    que uma viagem ativa ou um órfão seja detectado antes do guard de contexto de veículo rodar.
  - Separado do **A6** (recuperação de órfão, já verificada): aqui o BDV **existe e está aberto**, mas
    a ordem dos guards em `bdv.html` impede chegar até ele.

- ✅ **A9 — `POST /api/bdv` sem `authorize`: qualquer usuário autenticado abre BDV** *(verificado no servidor 2026-06-17)*
  > **✅ Verificado no servidor (2026-06-17):** modelo de três papéis aplicado na camada de rota —
  > motorista chega ao `GET /bdv/ativo` (**404**, não bloqueado); admin e vistoriador recebem
  > **403 `INSUFFICIENT_PERMISSION`** nas rotas de motorista; admin ainda acessa o `admin-bdv.html`
  > via `GET /bdv/:id` sem gate (guard admin-OU-dono no service).
  > **Fix implementado (2026-06-17):** `VISTORIADOR: 'vistoriador'`
  > adicionado ao enum `ROLES` (`constants.js`), reconciliando com o enum `nivel_acesso` do banco.
  > Gates `authorize` (após `authenticate`) em `routes/index.js`: `POST /bdv`, `GET /bdv/ativo`,
  > `POST /bdv/:id/paradas`, `PATCH /bdv/:id/paradas/:paradaId`, `PATCH /bdv/:id/encerrar` →
  > `authorize(MOTORISTA)`; `POST /checklist` → `authorize(MOTORISTA, VISTORIADOR)` (admin não
  > inspeciona); `GET /checklist/pendente` → `authorize(MOTORISTA)`. `GET /bdv/:id` fica só com
  > `authenticate` (o service já faz guard admin-OU-dono — gate grosseiro trancaria o admin).
  > As rotas de **escrita de BDV** (`paradas`, `encerrar`) estão marcadas **A7-coupled**: podem
  > ganhar `VISTORIADOR` quando o papel de override/supervisor entrar.
  > **Reteste:** motorista abre/registra parada/encerra normalmente; admin/vistoriador recebem
  > **403** nas rotas de BDV de motorista; checklist funciona p/ motorista e vistoriador.
  `POST /api/bdv` tem apenas `authenticate`, **sem `authorize`** — qualquer usuário autenticado
  (inclusive admin/vistoriador) consegue abrir um BDV. Além disso, o enum `ROLES`
  (`utils/constants.js`) **não tem `VISTORIADOR`**, apesar de o enum `nivel_acesso` do banco
  incluí-lo. Adicionar `authorize(MOTORISTA)` na rota e reconciliar o enum `ROLES`.
  - Liga-se ao trabalho role-aware de **A6/A7**.

- ✅ **A10 — Vínculo estrito 1:1 checklist→BDV no `openBDV`** *(verificado no servidor 2026-06-17)*
  > **✅ Verificado no servidor (2026-06-17):** sem checklist → **409 `CHECKLIST_REQUIRED`**;
  > veículo divergente → **409 `VEHICLE_MISMATCH`**; checklist do mesmo veículo → **201** com o
  > `checklist_id` corretamente vinculado.
  O `openBDV` antes fazia auto-link **permissivo** (vinculava o checklist órfão do dia **se existisse**,
  senão abria o BDV mesmo assim — podendo abrir no veículo errado). Agora o guard é **estrito**, dentro
  da transação sob o row-lock do veículo: exige um checklist órfão do dia (`findPendingTodayByMatricula`,
  agora também retornando `veiculo_id`) e compara `String(checklist.veiculo_id) === String(veiculo_id)`.
  Dois códigos novos em `constants.js` (`CHECKLIST_REQUIRED`, `VEHICLE_MISMATCH`, ambos 409).
  - Complementa, no backend, o override de hidratação do **A6** (que já evitava abrir o BDV no veículo
    errado pelo lado do frontend). UX de auto-roteamento dessas mensagens fica no **B12**.

- ⬜ **A11 — Imagens base64 inline em `checklists` (maior gargalo de escalabilidade)** *(achado na auditoria de escala 2026-06-24)*
  `mapa_avaria_base64` é `LONGTEXT` guardando um PNG em base64 **dentro da linha**, e vaza para os
  caminhos de leitura mais quentes:
  - `checklist.repository.findRelatorio` (dashboard admin) faz `SELECT` de `c.mapa_avaria_base64` em
    **todas** as linhas (default 100); `admin.js` carrega o resultado inteiro — base64 incluso — em
    `window.relatoriosCache` e renderiza tudo. Rede **e** memória do navegador seguram cada imagem de
    cada checklist listado, mesmo na visão de lista.
  - `findHistoricoByVeiculo` faz o mesmo no histórico do veículo.
  - base64 infla o armazenamento **+33%**; o cap é **500 KB/imagem** (A4-H2). O payload típico medido
    hoje (~1,1 kB) é função do quão pouco os motoristas desenham — não é um piso.
  - Conforme `checklists` cresce, cada página de relatório puxa **MB por página** e segura uma conexão
    do pool (de apenas 10) por toda a transferência → custo de armazenamento + banda + memória do
    browser + starvation de pool, tudo junto. Relaciona-se a **M7/M8** (pool) e **B14** (retenção).
  - **Correção (maior alavancagem):** (1) parar de selecionar `mapa_avaria_base64` em queries de
    lista/relatório; adicionar endpoint de detalhe (`GET /api/checklist/:id/mapa`) que busca a imagem
    só quando a linha é expandida (`admin.js::verDetalhes` já renderiza lazy — o dado é que não deve
    trafegar na lista). (2) A prazo, mover as imagens para fora da linha (filesystem / object storage
    Cloudflare R2/S3), guardando só a URL/chave — mantém a tabela `checklists` pequena e quente e torna
    o particionamento/arquivamento (B14) trivial.

- ⬜ **A12 — Índices ausentes em queries quentes** *(achado na auditoria de escala 2026-06-24)*
  Não há DDL no repo (schema só vive no banco — ver **B17**), então confirmar no banco vivo. As
  formas das queries indicam os índices necessários; todas rodam a cada page-load / submit, então
  degradam de seek para full-scan conforme as tabelas crescem:
  | Query | Roda em | Índice |
  |-------|---------|--------|
  | `findActiveBDVByMatricula` (`matricula=? AND status='aberto'`) | todo load de menu/checklist/bdv | `(matricula, status)` |
  | `findActiveBDVByVeiculoId` (`veiculo_id=? AND status='aberto'`) | toda abertura de BDV | `(veiculo_id, status)` |
  | `findPendingTodayByMatricula` | todo submit de checklist & abertura de BDV | `(matricula, data_inspecao)` + `bdv(checklist_id)` (ver **B4**) |
  | `findRelatorio` / `findAllBDV` (`ORDER BY data_* DESC`) | todo relatório | índice em `data_inspecao` / `data_abertura` |
  | `findHistoricoByVeiculo` (`veiculo_id=? ORDER BY data_inspecao DESC`) | histórico do veículo | `(veiculo_id, data_inspecao)` |
  - **Confirmar que as colunas de FK são `FOREIGN KEY` reais** (`checklists.veiculo_id`/`matricula`,
    `bdv.veiculo_id`/`matricula`, `bdv_paradas.bdv_id`): no MariaDB uma FK declarada cria o índice de
    apoio automaticamente. Se forem só FKs lógicas, os JOINs de todo relatório fazem scan. C1 já criou
    a FK de `bdv.checklist_id`; verificar as demais.
  - Auditar o estado atual:
    ```sql
    SELECT TABLE_NAME, INDEX_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) cols
    FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE()
    GROUP BY TABLE_NAME, INDEX_NAME;
    ```

- ⬜ **A13 — Flag `km_override` é auto-reportada pelo cliente (bypass de auditoria)** *(achado na auditoria 2026-06-24)*
  No caminho de correção (A7), `km_override` é um **booleano vindo do corpo** (schemas
  `correcaoChecklist`/`correcaoBDV`/`correcaoParada`, default `false`). O `correcao.service` **não tem
  guard monotônico por design** e **nunca** compara o KM novo contra `veiculos.km_atual`. Logo, um
  vistoriador pode baixar um `km_entrada` abaixo da âncora e, deixando a flag em `false`, gravar
  `km_override=0` **sem `motivo` obrigatório** (motivo só é exigido quando a flag é `true`).
  - Isso **fura o objetivo §6.4**: "o vistoriador quebrou a monotonicidade de propósito" deveria ser um
    evento de primeira classe filtrável; do jeito atual o evento pode ser silenciosamente omitido.
  - **Correção:** **derivar** `km_override` no servidor (em `aplicarCorrecao`), comparando o valor novo
    com a restrição monotônica (âncora do veículo / registros vizinhos), em vez de confiar no booleano —
    e exigir `motivo` sempre que a flag derivada for `true`. Torna a trilha à prova de adulteração pelos
    próprios operadores, que é o ponto da auditoria append-only.

- ⬜ **A14 — Exposição de CPF / PII (LGPD)** *(achado na auditoria 2026-06-24)*
  - `GET /veiculos/:id/historico` retorna `motorista_cpf` de **toda** inspeção do veículo a **qualquer
    usuário autenticado** — qualquer motorista lê o **CPF** de outros motoristas (dado pessoal sensível
    sob a LGPD) + os mapas de avaria. O **A3 #8** aceitou o IDOR de *histórico de frota* como
    "single-tenant por design", mas não pesou o ângulo **CPF/LGPD**. **Correção:** remover
    `motorista_cpf` do payload de histórico (não é necessário para renderizar) e reservar CPF a visões
    admin-scoped. Vale também agora que o A7 expôs os relatórios admin ao vistoriador — decisão
    consciente sobre supervisor ver CPF de todos.
  - **Logs com PII:** `checklist.service` e `veiculo.repository.updateKm` fazem `console.log` de
    matrícula/KM/tamanho do base64 em **toda** escrita, **sem gate de env** — PII + ruído de alto volume
    em produção (LGPD + log-bloat). Estende o **B1**; passar tudo por um logger com níveis.

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

- 🔵 **M5-b — Avaliar migração `bcrypt` → `bcryptjs`** *(aparentemente JÁ FEITO — confirmar e fechar — auditoria 2026-06-24)*
  > ⚠️ **Auditoria 2026-06-24:** `package.json` já lista **`bcryptjs ^2.4.3`** (sem `bcrypt` nativo) e
  > tanto `auth.service.js` quanto `scripts/migrate-passwords.js` já fazem `require('bcryptjs')`. Não há
  > mais cadeia `@mapbox/node-pre-gyp`/`tar` — as 2 altas restantes do **M5** devem ter sumido junto.
  > **Ação:** rodar `npm audit` para confirmar e então **fechar M5 e M5-b**.

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

- ⬜ **M7 — Rate limiting além do login + `/health` como vetor de DoS** *(achado na auditoria 2026-06-24)*
  Hoje só `POST /api/login` é limitado; o resto é irrestrito. O guard de checklist-por-dia já limita
  bem o spam de checklist, mas:
  - `GET /health` é **público, sem auth, e pega uma conexão do pool** (`SELECT 1`) a cada chamada.
    Martelar `/health` pode **esgotar o pool de 10 conexões e derrubar o app inteiro**. Tornar a
    resposta mais barata/cacheada e/ou limitar.
  - As rotas de correção (A7) são irrestritas — um token de vistoriador comprometido inunda a auditoria
    append-only.
  - `addParada` não tem cap (ver **B16**).
  - **Ação:** rate limiter global por IP/usuário antes de ir a público. Conecta ao store compartilhado
    do **M2** (o limiter atual é in-memory / single-process).

- ⬜ **M8 — Pool de conexões: `acquireTimeout` + teto de starvation** *(achado na auditoria 2026-06-24)*
  Toda request segura uma conexão do pool (10) por toda a sua vida; queries de relatório (esp. com
  base64, ver **A11**) seguram a sua pela transferência inteira. ~10 leituras lentas concorrentes
  travam todas as escritas. O limiter in-memory do **M2** já prende o deploy a **single-process**,
  então não dá para escalar horizontalmente para escapar disto — o caminho é baratear a query.
  - **Ação:** definir `acquireTimeout` no pool (falha rápida em vez de pendurar a request); corrigir
    **A11** (não trafegar base64 em listas) reduz o tempo que cada conexão fica presa.

- ⬜ **M9 — Chokepoint central de escopo de tenant (pré-requisito arquitetural do M6)** *(achado na auditoria 2026-06-24)*
  Hoje `coligada` viaja no JWT mas **nenhuma query escopa por ela** — cada repositório recebe filtros
  explícitos e confia no chamador. Ao adicionar `tenant_id` (M6), o modo de falha é catastrófico e
  silencioso: **um único `WHERE tenant_id=?` esquecido em ~20 métodos de repositório = vazamento entre
  clientes.** Não retrofitar query-a-query na mão.
  - **Ação:** arquitetar um chokepoint **antes** de escrever código de tenant — wrapper de repositório /
    query builder que injeta o predicado de tenant centralmente, ou escopo de conexão por tenant — de
    modo que "esqueci de filtrar" seja **estruturalmente impossível**, não uma esperança de code-review.
    Subitem de planejamento do **M6**; pareia com **B10/B17** (migrations/schema versionado).

- ⬜ **M10 — TOCTOU em `closeBDV` / paradas (re-lock dentro da transação)** *(achado na auditoria 2026-06-24)*
  - `addParada` e `closeParada` rodam **sem transação e sem row-lock**: leem o BDV, checam
    `status='aberto'` e a monotonicidade de KM, depois escrevem. Dois requests concorrentes (double-tap,
    retry) podem ambos passar — paradas duplicadas, ou duas paradas que satisfazem um `lastParada.km`
    obsoleto. Baixa severidade hoje (um motorista, um device), mas real.
  - `closeBDV` lê o status do BDV **fora** da transação (fail-fast), abre a tx e trava só a linha do
    **veículo**, sem re-checar o status do BDV sob o lock. Dois `encerrar` concorrentes podem ambos
    prosseguir; o segundo sobrescreve `km_final` e re-roda `updateKm`.
  - **Correção:** re-`SELECT ... FOR UPDATE` na linha do `bdv` dentro da transação e re-afirmar
    `status='aberto'` antes de escrever (mesma disciplina do lock de veículo).

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

- ⬜ **M13 — Enumeração de usuário por timing no login** *(achado na auditoria 2026-06-24)*
  `authService.login` retorna **imediatamente** quando o usuário não existe, mas roda `bcrypt.compare`
  (~100 ms) quando existe. Essa diferença de tempo permite enumerar `matricula`/`CPF` válidos — e CPF é
  enumerável. O limiter por IP ajuda, mas é compartilhado por NAT e reseta no restart (M2).
  - **Correção:** equalizar o tempo com um `bcrypt.compare` dummy no caminho "não encontrado". Considerar
    lockout por conta no deploy público (pesando contra DoS-por-lockout).

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

- ⬜ **B4 — Query não-sargável no guard diário** *(escopo ampliado na auditoria 2026-06-24)*
  `findPendingTodayByMatricula` combina **dois** problemas de escala e roda nos dois caminhos de escrita
  mais frequentes (todo submit de checklist & abertura de BDV):
  - `DATE(data_inspecao) = CURDATE()` derrota qualquer índice em `data_inspecao`.
  - `id NOT IN (SELECT checklist_id FROM bdv WHERE checklist_id IS NOT NULL)` faz um subquery que
    varre `bdv` crescendo para sempre.
  Reescrever sargável + anti-join (faz par com o índice `(matricula, data_inspecao)` do **A12**):
  ```sql
  WHERE c.matricula = ?
    AND c.data_inspecao >= CURDATE() AND c.data_inspecao < CURDATE() + INTERVAL 1 DAY
    AND NOT EXISTS (SELECT 1 FROM bdv b WHERE b.checklist_id = c.id)
  ```
  Fazer **antes** das tabelas crescerem, não depois.

- ⬜ **B5 — Sem testes automatizados**
  Projeto não possui testes (decisão atual). Caso evolua, priorizar testes dos serviços
  transacionais (`checklist.service`, `bdv.service` — locks `FOR UPDATE`, validação de KM).

- ✅ **B6 — Housekeeping do repositório** *(resolvido 2026-06-19)*
  Remover arquivos vazios soltos no working dir (`git`, `main`) e decidir sobre `LICENSE`
  (untracked). Adicionar ao `.gitignore` se necessário.
  > **✅ Resolvido (2026-06-19):** os arquivos vazios `git`/`main` não existem mais no working dir;
  > `LICENSE` foi **commitado/rastreado** (entrou junto no `d47f48e` via `git add -A`). Nada a ignorar.

- 🔵 **B7 — Auditar XSS nas telas do motorista** *(auditado 2026-06-24; 1 correção pendente)*
  A auditoria de A1 cobriu apenas as páginas admin. Revisão dos sinks de `innerHTML` no lado motorista
  (`frota.js`, `checklist.js`, `bdv.html`) concluída em 2026-06-24:
  - ⬜ **`frota.js` (Médio — corrigir):** `carregarVeiculos` monta os cards com `innerHTML +=`
    interpolando `v.modelo`/`v.placa`/`v.id` **sem escape**, tanto no texto HTML (`<h3>${v.modelo}</h3>`)
    quanto **dentro de um atributo `onclick` com aspas simples**
    (`onclick="iniciarChecklist('${v.id}', '${v.placa}', '${tipoVeiculo}', '${v.modelo}')"`). Um `'` ou
    `<` no `modelo`/`placa` quebra a string JS do atributo → injeção de JS arbitrário (a aresta mais
    afiada). Fonte hoje é admin/inserção manual no banco (risco menor), mas **escala para alto** na meta
    multi-tenant/pública (M6/M9), onde dados de veículo podem ser preenchidos pelo cliente.
    **Correção:** escapar via helper **e** trocar o `onclick` inline por `addEventListener` + `data-*`
    (passa os valores por `dataset`, sem interpolar em string de atributo) — também remove um handler
    inline (alinha com **M1-b**, rumo a CSP estrito).
  - ⬜ **`bdv.html` (Baixo — defense-in-depth):** `renderizarParadas` escapa os campos de texto
    (`escHtml` em `local_saida`/`local_chegada`/`observacao` ✓), mas `formatarData` **retorna a string
    crua** quando a entrada não é data (`if (isNaN(d)) return str;`) e `${p.km}` é interpolado **cru**.
    Difícil de alcançar (servidor valida `hora_*` por `DATETIME_RE` e `km` como número), mas escapar o
    fallback de `formatarData` fecha o mesmo padrão já apontado no A1 (versão admin de `formatarData`).
  - ✅ **`checklist.js` (limpo):** o único sink de `innerHTML` (`renderizarItens`) interpola o array
    **constante** `itensChecklist` (hardcoded no arquivo), não dado de servidor/usuário. Sem vetor.
  - Observação: `escHtml` (bdv.html) escapa `& < >` mas **não** aspas — adequado para contexto de texto
    entre tags (onde é usado), insuficiente se algum dia for usado dentro de valor de atributo.

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
  > **⚠️ Pivot PM2 → NSSM (2026-06-18):** a tentativa inicial com **PM2** falhou — o PM2 é pacote npm e
  > herda o check de plataforma do Node, que **recusa rodar no Windows Server 2012** do servidor (`pm2`
  > não reconhecido após o install). Trocado por **NSSM** (`nssm.exe`, binário nativo único, sem
  > requisito de versão de Node). `ecosystem.config.js` **removido** (preservado no histórico do git;
  > re-adicionar só se/quando o SO for atualizado — PM2 é a melhor ferramenta quando a plataforma
  > suportar). A causa-raiz (2012 fora de suporte, abaixo da baseline de tooling) virou o item **I1**.
  > **✅ Implementado (2026-06-18):** seção README **"Running as a Windows Service"** reescrita para NSSM,
  > mantendo o framing Parte A / Parte B. `.gitignore` mantém `backend/logs/`.
  > **Setting load-bearing:** `AppDirectory = C:\xampp\htdocs\CarCheck\backend` (análogo exato do antigo
  > `cwd: ./backend` do PM2 — o dotenv lê `.env` do CWD; errado → `JWT_SECRET` ausente → exit).
  > **Anti-thrash:** `AppExit Default Restart` + `AppExit 0 Exit` (crash reinicia; saída graciosa 0 fica
  > parada) + `AppThrottle 10000` (run < 10s = falha de start, com back-off) — evita loop de thrash num
  > erro permanente (ex.: `.env` faltando). Logs via `AppStdout`/`AppStderr` → `backend/logs/` com
  > rotação (`AppRotate*`, 10 MB). Instância única (combina com o rate limiter de login em memória).
  > - **Parte A (process management)** — `nssm install` + `AppDirectory` + logs + auto-restart/anti-thrash
  >   + `nssm start`. Entrega sobrevivência a fechamento de terminal + auto-restart em crash.
  >   **Requer admin para `nssm install` — bloqueado (ver acima).**
  > - **Parte B (reboot persistence)** — `Start SERVICE_DELAYED_AUTO_START` (sobe no boot, sem login;
  >   atrasado p/ o MariaDB do XAMPP subir antes; opcional `DependOnService mysql`). O servidor
  >   **auto-reinicia sozinho** (hardware/agendado), mas o processo Node **não** volta sem isto. **Pendente.**
  > **Verificação (Parte B):** pega o **próximo reboot natural** da máquina — sem iniciar nada à mão,
  > `Get-Service CarCheckAPI` deve mostrar **Running** (start pelo SCM no boot, não manual — timestamp do
  > log bate com o boot) + `/api/health` → `success:true`. Se `Stopped` → checar `carcheck-error.log`
  > (em geral o DB não pronto a tempo; `AppThrottle` + `DependOnService mysql` endereçam). Sem acesso ao
  > servidor aqui — instalação e verificação são manuais.

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
  imagens forem externalizadas antes (**A11**). Concretiza/expande o **B11** (STORAGE.md).

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
