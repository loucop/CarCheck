-- ============================================================================
-- CarCheck — Diagnóstico READ-ONLY do banco (auditoria de escala 2026-06-24)
-- ----------------------------------------------------------------------------
-- TODAS as instruções aqui são SELECT / EXPLAIN. Não há INSERT/UPDATE/DELETE/
-- ALTER/DROP — rodar este arquivo NÃO altera dado nem schema.
--
-- Como usar:
--   1) Selecione o banco do CarCheck antes de rodar (ajuste o nome):
--        USE carcheck_db;
--      Todas as queries usam DATABASE(), então o resultado segue o banco ativo.
--   2) Rode o arquivo inteiro ou seção por seção.
--   3) Cada seção referencia o item do BACKLOG que ela ajuda a confirmar.
--
-- Contexto: não há DDL versionado no repo (ver B17). Estas queries lêem o
-- schema VIVO via information_schema para confirmar/derrubar as suposições da
-- auditoria (índices, engine, tipos auto_increment, peso do base64, drift de KM).
-- ============================================================================

USE carcheck_db;  -- <<< AJUSTE se o nome do banco for outro (.env DB_NAME)


-- ============================================================================
-- [A12] Índices existentes por tabela
-- Confirma se os índices das queries quentes existem. Esperado/desejado:
--   bdv(matricula,status) · bdv(veiculo_id,status) · bdv(checklist_id)
--   checklists(matricula,data_inspecao) · checklists(veiculo_id,data_inspecao)
--   bdv_paradas(bdv_id) · índices em data_inspecao / data_abertura p/ ORDER BY
-- ============================================================================
SELECT TABLE_NAME,
       INDEX_NAME,
       GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS colunas,
       NON_UNIQUE,
       INDEX_TYPE
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
GROUP BY TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE
ORDER BY TABLE_NAME, INDEX_NAME;


-- ============================================================================
-- [A12] Foreign keys declaradas
-- No MariaDB uma FK declarada cria o índice de apoio automaticamente. Se uma
-- coluna de FK (checklists.veiculo_id/matricula, bdv.veiculo_id/matricula,
-- bdv_paradas.bdv_id) NÃO aparecer aqui, os JOINs de relatório podem estar
-- fazendo full-scan — adicionar índice manual.
-- ============================================================================
SELECT TABLE_NAME, COLUMN_NAME, CONSTRAINT_NAME,
       REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = DATABASE()
  AND REFERENCED_TABLE_NAME IS NOT NULL
ORDER BY TABLE_NAME, COLUMN_NAME;


-- ============================================================================
-- [B20] Colunas auto_increment: confirmar BIGINT (não INT)
-- Auto-increment NÃO é risco real (BIGINT + InnoDB → overflow inatingível).
-- Único checup: se alguma PK aparecer como `int(...)` (teto 2,14 bi signed),
-- planejar ALTER ... MODIFY ... BIGINT enquanto a tabela está pequena.
-- ============================================================================
SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, DATA_TYPE
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND EXTRA = 'auto_increment'
ORDER BY TABLE_NAME;

-- [B20] Valor atual do contador auto_increment por tabela (distância do teto).
-- INT signed estoura em 2.147.483.647; BIGINT em 9.2e18. Sanidade.
SELECT TABLE_NAME, ENGINE, TABLE_ROWS, AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
  AND AUTO_INCREMENT IS NOT NULL
ORDER BY AUTO_INCREMENT DESC;


-- ============================================================================
-- [B11/B14] Engine + tamanho por tabela (storage e plano de retenção)
-- ENGINE deve ser InnoDB em todas (o código usa SELECT ... FOR UPDATE).
-- DATA_LENGTH/INDEX_LENGTH em bytes — esperado que `checklists` domine por
-- causa do mapa_avaria_base64 inline (ver A11).
-- ============================================================================
SELECT TABLE_NAME,
       ENGINE,
       TABLE_ROWS,
       DATA_LENGTH,
       INDEX_LENGTH,
       (DATA_LENGTH + INDEX_LENGTH)            AS total_bytes,
       ROUND((DATA_LENGTH + INDEX_LENGTH)/1024/1024, 2) AS total_mb,
       AVG_ROW_LENGTH
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = DATABASE()
ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC;


-- ============================================================================
-- [A11/B11] Peso real do base64 inline em checklists
-- Mede o problema do A11 com dado real: quantos checklists têm imagem, e o
-- tamanho médio/máx/total do LONGTEXT trafegado em cada query de relatório.
-- ============================================================================
SELECT COUNT(*)                                   AS total_checklists,
       SUM(mapa_avaria_base64 IS NOT NULL)         AS com_imagem,
       ROUND(AVG(LENGTH(mapa_avaria_base64)))      AS avg_bytes_img,
       MAX(LENGTH(mapa_avaria_base64))             AS max_bytes_img,
       ROUND(SUM(LENGTH(mapa_avaria_base64))/1024/1024, 2) AS total_mb_img
FROM checklists;


-- ============================================================================
-- [A12/B4] EXPLAIN das queries quentes — full-scan vs índice
-- Trocar 'REPLACE_MATRICULA' e 999 por valores reais antes de rodar.
-- Olhar a coluna `type` (ALL = full scan, ruim) e `key` (índice usado).
-- EXPLAIN é read-only.
-- ============================================================================

-- Guard diário de checklist órfão (roda em todo submit + abertura de BDV).
-- Hoje: DATE(data_inspecao) é não-sargável + subquery NOT IN sobre bdv (ver B4).
EXPLAIN
SELECT id, veiculo_id FROM checklists
WHERE matricula = 'REPLACE_MATRICULA'
  AND DATE(data_inspecao) = CURDATE()
  AND id NOT IN (SELECT checklist_id FROM bdv WHERE checklist_id IS NOT NULL)
ORDER BY id DESC LIMIT 1;

-- Versão sargável proposta (B4) — comparar o EXPLAIN com a de cima.
EXPLAIN
SELECT c.id, c.veiculo_id FROM checklists c
WHERE c.matricula = 'REPLACE_MATRICULA'
  AND c.data_inspecao >= CURDATE() AND c.data_inspecao < CURDATE() + INTERVAL 1 DAY
  AND NOT EXISTS (SELECT 1 FROM bdv b WHERE b.checklist_id = c.id)
ORDER BY c.id DESC LIMIT 1;

-- BDV ativo do motorista (roda em todo load de menu/checklist/bdv).
EXPLAIN
SELECT id, veiculo_id, matricula, coligada, status, data_abertura, km_inicial
FROM bdv WHERE matricula = 'REPLACE_MATRICULA' AND status = 'aberto' LIMIT 1;

-- BDV ativo por veículo (roda em toda abertura de BDV).
EXPLAIN
SELECT id FROM bdv WHERE veiculo_id = 999 AND status = 'aberto' LIMIT 1;

-- Histórico de checklists por veículo (ORDER BY data_inspecao DESC).
EXPLAIN
SELECT c.id, c.data_inspecao FROM checklists c
WHERE c.veiculo_id = 999 ORDER BY c.data_inspecao DESC LIMIT 50 OFFSET 0;


-- ============================================================================
-- [M11] Drift da âncora de KM
-- veiculos.km_atual DEVERIA ser MAX(último checklist km_entrada, último BDV
-- encerrado km_final). Linhas retornadas = âncoras dessincronizadas (revisar;
-- não corrigir automaticamente — §6.2). Nota: veículo sem histórico aparece
-- com esperado=0; é esperado, ignorar esses.
-- ============================================================================
SELECT v.id, v.placa, v.km_atual,
       GREATEST(COALESCE(c.max_km, 0), COALESCE(b.max_km, 0)) AS esperado,
       v.km_atual - GREATEST(COALESCE(c.max_km, 0), COALESCE(b.max_km, 0)) AS diff
FROM veiculos v
LEFT JOIN (SELECT veiculo_id, MAX(km_entrada) AS max_km
           FROM checklists GROUP BY veiculo_id) c ON c.veiculo_id = v.id
LEFT JOIN (SELECT veiculo_id, MAX(km_final) AS max_km
           FROM bdv WHERE status = 'encerrado' GROUP BY veiculo_id) b ON b.veiculo_id = v.id
HAVING v.km_atual <> esperado
ORDER BY ABS(diff) DESC;


-- ============================================================================
-- [M12] Invariantes de "um BDV aberto por veículo / por motorista"
-- Hoje imposto só por lógica de app + FOR UPDATE. Qualquer linha aqui é uma
-- violação do invariante (não deveria existir).
-- ============================================================================
SELECT veiculo_id, COUNT(*) AS abertos
FROM bdv WHERE status = 'aberto'
GROUP BY veiculo_id HAVING COUNT(*) > 1;

SELECT matricula, COUNT(*) AS abertos
FROM bdv WHERE status = 'aberto'
GROUP BY matricula HAVING COUNT(*) > 1;


-- ============================================================================
-- [A6] Checklists órfãos (sem BDV vinculado) — visão operacional
-- Contagem por dia de checklists que nunca viraram BDV (motorista travado, ou
-- inspeção de vistoriador sem viagem). Só leitura, para dimensionar o fenômeno.
-- ============================================================================
SELECT DATE(c.data_inspecao) AS dia, COUNT(*) AS orfaos
FROM checklists c
WHERE NOT EXISTS (SELECT 1 FROM bdv b WHERE b.checklist_id = c.id)
GROUP BY DATE(c.data_inspecao)
ORDER BY dia DESC
LIMIT 30;


-- ============================================================================
-- [Auth] Senhas ainda em texto plano / formato legado
-- Conta funcionarios cuja `senha` NÃO é bcrypt ($2a/$2b/$2y). >0 indica que o
-- scripts/migrate-passwords.js ainda precisa rodar (ver A5). Read-only.
-- ============================================================================
SELECT
  SUM(senha IS NOT NULL AND senha NOT REGEXP '^\\$2[aby]\\$') AS texto_plano_ou_legado,
  SUM(senha REGEXP '^\\$2[aby]\\$')                           AS bcrypt,
  SUM(senha IS NULL OR senha = '')                            AS vazias,
  COUNT(*)                                                    AS total
FROM funcionarios;


-- ============================================================================
-- [M6/M9] Distribuição por coligada (preparação multi-tenant)
-- Mostra como os dados se distribuem hoje pelo campo `coligada` — referência
-- para o planejamento de escopo por tenant.
-- ============================================================================
SELECT 'funcionarios' AS tabela, coligada, COUNT(*) AS linhas FROM funcionarios GROUP BY coligada
UNION ALL
SELECT 'bdv', coligada, COUNT(*) FROM bdv GROUP BY coligada
ORDER BY tabela, coligada;
