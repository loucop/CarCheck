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
| A8 | Front | 🟠 | 🔵 | Ordem dos guards em `bdv.html` (pendente verificação) |
| A11 | Back+DB | 🟠 | ⬜ | Tirar base64 das queries de lista (+ endpoint de detalhe) |
| A12 | DB | 🟠 | ⬜ | Índices em queries quentes (confirmar no banco vivo) |
| A13 | Back | 🟠 | ⬜ | Derivar `km_override` no servidor (bug de auditoria do A7) |
| A14 | Back+LGPD | 🟠 | ⬜ | Remover CPF do histórico + logger com níveis |
| M1 | Back/Infra | 🟡 | 🔵 | Helmet (backend ✅); CSP do HTML via Cloudflare |
| M2 | Back/Infra | 🟡 | ⬜ | Rate limiter resiliente (store compartilhado) |
| M6 | Arch | 🟡 | ⬜ | Planejamento de multi-tenancy (RFC antes de código) |
| M7 | Back/Infra | 🟡 | ⬜ | Rate limit global + `/health` como vetor de DoS |
| M8 | Back/DB | 🟡 | ⬜ | Pool: `acquireTimeout` + teto de starvation |
| M9 | Arch | 🟡 | ⬜ | Chokepoint central de escopo de tenant (pré-req M6) |
| M10 | Back | 🟡 | ⬜ | TOCTOU em `closeBDV`/paradas (re-lock na transação) |
| M11 | Back+DB | 🟡 | ⬜ | Reconciliação de drift da âncora de KM (job/relatório) |
| M12 | DB | 🟡 | ⬜ | Invariantes no nível do banco (CHECK/unique) |
| M13 | Back | 🟡 | ⬜ | Enumeração de usuário por timing no login |
| M14 | Front | 🟡 | ⬜ | Resiliência móvel (timeout + guard de double-submit) |
| M15 | Front/Infra | 🟡 | ⬜ | Offline/fila de submissão (PWA, exige HTTPS) |
| B1 | Front+Back | 🟢 | ⬜ | Remover `console.log` de debug (PII no console) |
| B2 | Back | 🟢 | ⬜ | Política de senha mais forte |
| B3 | Back | 🟢 | ⬜ | Limite de payload (rever se ainda distinto vs A4) |
| B4 | Back+DB | 🟢 | ⬜ | Query não-sargável no guard diário (sargável + anti-join) |
| B5 | Test | 🟢 | ⬜ | Sem testes automatizados (priorizar serviços transacionais) |
| B7 | Front | 🟢 | 🔵 | XSS nas telas do motorista (2 fixes: frota.js, bdv.html) |
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
| B21 | Front | 🟢 | ⬜ | jsPDF via CDN morto em `checklist.html` (app LAN) |
| B22 | Back | 🟢 | ⬜ | Sem compressão (gzip/brotli) no backend |
| B23 | Front | 🟢 | ⬜ | Cache-buster em `veiculo.png` (re-download móvel) |
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
  - ⚠️ Bugs/itens correlatos **ainda pendentes** no backend já entregue: **A13** (flag `km_override`
    auto-reportada pelo cliente) e **M11** (drift da âncora de KM). Liga-se a A6 (role-aware), A3, M6.

- 🔵 **A8 — `bdv.html`: guard de veículo roda antes da checagem de viagem ativa** *(corrigido, pendente verificação no servidor)*
  Um motorista **em viagem** com `localStorage.veiculo_id` vazio é mandado para `selecao.html` **antes**
  de `/bdv/ativo` ser checado → não consegue chegar à sua viagem ativa.
  > **Fix implementado (2026-06-17), pendente deploy (arquivos estáticos) + reteste:** `verificarBDVAtivo()`
  > virou o ponto de decisão no `DOMContentLoaded` (`await`ado); 200 (viagem ativa) → `andamento` **sem**
  > exigir `veiculo_id`; guard de veículo extraído para `exigirVeiculoParaNovaViagem()`, roda **antes** de
  > qualquer saída para o estado 'abrir'. Hidratação de órfão (A6) permanece antes da checagem.
  - **Repro:** abrir um BDV, limpar o `localStorage`, navegar para `bdv.html` → era jogado para
    `selecao.html` em vez da viagem ativa.
  - Separado do **A6** (recuperação de órfão): aqui o BDV **existe e está aberto** — é a ordem dos guards
    que impede chegar até ele.

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

- ⬜ **M14 — Resiliência de conexão em rede móvel (timeout + feedback + guard de double-submit)** *(auditoria mobile 2026-06-24)*
  O produto é usado por motoristas em campo, em celular, com cobertura instável — mas o cliente assume
  rede confiável. Lacunas:
  - **Sem timeout / `AbortController`:** todo `fetch`/`apiFetch` espera indefinidamente. Numa conexão
    móvel que trava (túnel, elevador, zona morta) a request **pendura para sempre**, sem feedback — o
    motorista não sabe se enviou. **Correção:** envolver as chamadas com `AbortController` + timeout
    (ex.: 15–20 s) e mensagem de "rede lenta, tente de novo".
  - **Sem guard de submissão em voo (double-submit):** `finalizarRelatorio` (checklist), `iniciarViagem`
    (abrir BDV), `addParada`/`closeParada` **não desabilitam o botão** durante o POST. Numa rede lenta o
    motorista toca de novo achando que não funcionou → **request duplicado**. Os guards de banco pegam
    checklist/BDV duplicado (409, mas com `alert` confuso); **paradas NÃO têm guard** (linhas
    duplicadas — liga ao TOCTOU do **M10**). **Correção:** desabilitar o botão no submit + reabilitar no
    fim/erro (padrão idempotente de UX).
  - Liga-se a **M8** (upload lento de 1 MB segura uma conexão do pool pela transferência inteira; payload
    real é pequeno por causa do canvas 600×300, então risco baixo hoje).

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

- ⬜ **B1 — Remover `console.log` de debug remanescentes**
  `admin.js:184-185` (`[DEBUG]` dumpando registro completo — PII no console),
  `auth.js:8,23`, `checklist.js`, `frota.js`, `pdf-engine.js`. Limpeza de higiene.

- ⬜ **B2 — Política de senha fraca**
  `validate.middleware.js` exige senha com **mín. 6 caracteres** no cadastro. Considerar
  política mais forte (comprimento + complexidade) conforme exigência do cliente.

- ⬜ **B3 — Limite de payload de 50mb**
  `express.json({ limit: '50mb' })` é amplo (necessário para o mapa de avaria em base64).
  Avaliar reduzir o limite global e isolar o upload pesado em rota dedicada (superfície de DoS).
  *(Nota: o A4-H2 já trocou o `50mb` global por `100kb` default + `1mb` só no checklist — confirmar se
  este item ainda é distinto ou pode ser fechado contra o A4.)*

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

- 🔵 **B7 — Auditar XSS nas telas do motorista** *(auditado 2026-06-24; 2 correções pendentes)*
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

- ⬜ **B21 — Dependência morta do jsPDF via CDN em `checklist.html` (peso + dependência de internet num app LAN)** *(auditoria mobile 2026-06-24)*
  `checklist.html` carrega `jspdf.umd.min.js` + `jspdf.plugin.autotable.min.js` do **CDN externo**
  (`cdnjs.cloudflare.com`), **render-blocking** (antes de `config.js`/`checklist.js`). Mas
  `js/pdf-engine.js` (que define `gerarPDF`) **não é incluído em nenhuma página** e `gerarPDF` **nunca é
  chamado** — o botão "FINALIZAR CHECKLIST E GERAR RELATÓRIO" só faz o POST, sem gerar PDF no cliente.
  - **Impacto mobile:** ~150 KB+ de JS baixados à toa por celular **e**, pior, uma **dependência de
    internet embutida num app de LAN** — se a LAN não tem saída para a internet, as requests ao cdnjs
    **penduram/falham** e atrasam a interatividade da página de checklist.
  - **Correção:** remover as duas tags de CDN (e o `pdf-engine.js` morto). Se PDF no cliente for
    desejado, **self-hostar** o jsPDF localmente (servir do `:10081`), **nunca via CDN** num app de LAN.

- ⬜ **B22 — Sem compressão (gzip/brotli) no backend** *(auditoria mobile 2026-06-24)*
  Nenhum middleware de compressão (sem dep `compression`). JSON trafega cru — caro em rede móvel,
  sobretudo relatórios com `mapa_avaria_base64` (base64 é altamente compressível, ~30–40% com gzip).
  Payloads do motorista são pequenos; o ganho maior é nos relatórios admin. Mitigado em parte quando
  o Cloudflare entrar (comprime no edge), mas `compression()` no Express é um ganho barato já na LAN.
  Relaciona-se a **A11** (a correção real é não trafegar base64 em listas).

- ⬜ **B23 — `veiculo.png` com cache-buster a cada checklist (re-download em dados móveis)** *(auditoria mobile 2026-06-24)*
  `checklist.js` carrega a imagem do veículo com `?t=${timestamp}` (`inicializarCanvas`), **derrotando o
  cache** — re-baixa uma imagem **estática** a cada abertura de checklist, gastando dados móveis. Remover
  o cache-buster e deixar o navegador cachear (a imagem não muda).

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
M3, M4, a série S1–S3, B6, e as porções concluídas de A7 (spec/slices 1–3), M1 (helmet) e M5/M5-b.
