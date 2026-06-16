/**
 * SCRIPT DE MIGRAÇÃO: Senhas Texto Plano → Bcrypt
 *
 * ⚠️ ESTE SCRIPT FOI ENCONTRADO QUEBRADO NA AUDITORIA DE 2026-06-15 (item A5 do BACKLOG).
 * A versão original usava colunas inexistentes (`id`, `senha_hash`) e detecção de hash
 * incompleta — risco de destruir senhas de forma irreversível. Foi reconciliado com o
 * schema real (PK `matricula`, coluna `senha`) e endurecido. Mesmo assim:
 *
 *   >>> VERIFIQUE O SCHEMA VIVO E RODE PRIMEIRO EM --dry-run ANTES DE GRAVAR. <<<
 *
 * Uso:
 *   node scripts/migrate-passwords.js --dry-run          # read-only: mostra o que MUDARIA
 *   node scripts/migrate-passwords.js --i-know-its-fixed  # grava (transação)
 *
 * O modo de gravação RECUSA rodar sem a flag --i-know-its-fixed
 * (ou a env MIGRATE_PASSWORDS_CONFIRMED=1). --dry-run é sempre permitido (não grava nada).
 *
 * Comportamento:
 * - Lê funcionarios(matricula, nome, senha).
 * - Pula linhas já hasheadas em bcrypt ($2a$ / $2b$ / $2y$).
 * - Pula linhas com `senha` nula/vazia (não chama .startsWith() nelas).
 * - Converte apenas texto plano real para bcrypt (10 rounds).
 * - Envolve todo o loop de UPDATE numa transação: falha no meio → rollback total.
 */

const bcrypt = require('bcrypt');
const pool = require('../src/config/database');

// Prefixos de bcrypt válidos: 2a, 2b, 2y (todos bcrypt). Texto plano não casa.
const BCRYPT_PREFIX = /^\$2[aby]\$/;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const CONFIRMED =
    args.includes('--i-know-its-fixed') ||
    process.env.MIGRATE_PASSWORDS_CONFIRMED === '1';

function refuse() {
    console.error(`
========================================================================
  MIGRAÇÃO DE SENHAS — EXECUÇÃO BLOQUEADA
========================================================================
  Este script foi encontrado QUEBRADO na auditoria (A5): a versão antiga
  apontava para colunas inexistentes (id / senha_hash) e podia re-hashear
  e DESTRUIR senhas de forma irreversível.

  Ele foi reconciliado com o schema real (matricula / senha), mas o modo
  de GRAVAÇÃO é intencionalmente travado até você confirmar.

  Faça nesta ordem:
    1) node scripts/migrate-passwords.js --dry-run
       (read-only — confirme as colunas e quais linhas mudariam)
    2) Confira que os números fazem sentido contra o banco vivo.
    3) node scripts/migrate-passwords.js --i-know-its-fixed
       (ou MIGRATE_PASSWORDS_CONFIRMED=1)

  *** Faça backup da tabela funcionarios antes do passo 3. ***
========================================================================
`);
    process.exit(1);
}

async function migratePasswords() {
    if (!DRY_RUN && !CONFIRMED) {
        refuse();
    }

    let conn;
    let inTransaction = false;
    try {
        console.log(
            `\n=== MIGRAÇÃO DE SENHAS ${DRY_RUN ? '(DRY-RUN — nada será gravado)' : '(GRAVAÇÃO)'} ===\n`
        );

        conn = await pool.getConnection();

        const funcionarios = await conn.query(
            'SELECT matricula, nome, senha FROM funcionarios'
        );

        console.log(`Total de funcionários: ${funcionarios.length}`);

        let migrated = 0;
        let skippedHashed = 0;
        let skippedEmpty = 0;

        if (!DRY_RUN) {
            await conn.beginTransaction();
            inTransaction = true;
        }

        for (const func of funcionarios) {
            const senha = func.senha;

            // Null-guard: nunca chamar .startsWith() em null/vazio.
            if (senha == null || senha === '') {
                console.log(`[SKIP] ${func.nome} (${func.matricula}) - senha nula/vazia`);
                skippedEmpty++;
                continue;
            }

            // Já hasheada em bcrypt ($2a$/$2b$/$2y$) → não tocar.
            if (BCRYPT_PREFIX.test(senha)) {
                console.log(`[SKIP] ${func.nome} (${func.matricula}) - já possui hash bcrypt`);
                skippedHashed++;
                continue;
            }

            // Texto plano real → converter.
            if (DRY_RUN) {
                console.log(`[WOULD MIGRATE] ${func.nome} (${func.matricula}) - texto plano → bcrypt`);
                migrated++;
                continue;
            }

            const hashedPassword = await bcrypt.hash(senha, 10);
            await conn.query(
                'UPDATE funcionarios SET senha = ? WHERE matricula = ?',
                [hashedPassword, func.matricula]
            );
            console.log(`[OK] ${func.nome} (${func.matricula}) - senha convertida para bcrypt`);
            migrated++;
        }

        if (inTransaction) {
            await conn.commit();
            inTransaction = false;
        }

        console.log(`\n=== ${DRY_RUN ? 'DRY-RUN CONCLUÍDO' : 'MIGRAÇÃO CONCLUÍDA'} ===`);
        console.log(`${DRY_RUN ? 'Mudariam' : 'Migradas'}: ${migrated}`);
        console.log(`Ignoradas (já hasheadas): ${skippedHashed}`);
        console.log(`Ignoradas (nula/vazia):   ${skippedEmpty}`);
        console.log('================================\n');

        process.exit(0);
    } catch (err) {
        if (inTransaction && conn) {
            try {
                await conn.rollback();
                console.error('\n[ROLLBACK] Transação revertida — nenhuma senha foi alterada.');
            } catch (rbErr) {
                console.error('\n[ERRO NO ROLLBACK]', rbErr.message);
            }
        }
        console.error('\n[ERRO FATAL]', err.message);
        process.exit(1);
    } finally {
        if (conn) conn.release();
    }
}

migratePasswords();
