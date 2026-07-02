/**
 * RESTORE DO BANCO A PARTIR DE UM BACKUP (A16)
 *
 * Restaura um dump gerado por backup-db.js (.sql.gz ou .sql) para um banco de
 * destino EXPLÍCITO. Como o dump é em nível de tabela (sem CREATE DATABASE/USE),
 * o destino é escolhido aqui — o que permite TESTAR o restore com segurança num
 * banco de rascunho sem tocar na produção.
 *
 * Uso:
 *   # Teste seguro (banco de rascunho — cria, restaura, você confere e descarta):
 *   node scripts/restore-db.js backups/daily/<arquivo>.sql.gz --target-db=carcheck_restore_test
 *
 *   # Restore REAL sobre a produção (destrutivo — exige confirmação explícita):
 *   node scripts/restore-db.js backups/daily/<arquivo>.sql.gz --target-db=carcheck --yes
 *
 * O banco de destino é criado se não existir (CREATE DATABASE IF NOT EXISTS).
 * Restaurar SOBRE o banco de produção (DB_NAME do .env) sobrescreve as tabelas
 * existentes e por isso é bloqueado sem a flag --yes.
 *
 * Ao final, imprime a contagem de linhas das tabelas principais para verificação.
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;
const MYSQL = process.env.MYSQL_PATH || 'C:\\xampp\\mysql\\bin\\mysql.exe';

const args = process.argv.slice(2);
const CONFIRMED = args.includes('--yes');
const file = args.find((a) => !a.startsWith('--'));
const targetArg = args.find((a) => a.startsWith('--target-db='));
const TARGET_DB = targetArg ? targetArg.split('=')[1] : null;

function usage(msg) {
    if (msg) console.error(`\n[ERRO] ${msg}`);
    console.error(`
Uso:
  node scripts/restore-db.js <arquivo.sql.gz> --target-db=NOME [--yes]

  --target-db=NOME   banco de destino (obrigatório). Use um nome de RASCUNHO
                     para testar o restore sem risco (ex.: carcheck_restore_test).
  --yes              obrigatório apenas se o destino for o banco de PRODUÇÃO
                     (DB_NAME=${DB_NAME || '?'}) — o restore sobrescreve as tabelas.
`);
    process.exit(1);
}

// Base de args de conexão do cliente mysql. A senha vai por MYSQL_PWD.
function connArgs(extra = []) {
    return [
        `--host=${DB_HOST}`,
        `--port=${DB_PORT}`,
        `--user=${DB_USER}`,
        '--default-character-set=utf8mb4',
        ...extra,
    ];
}

function childEnv() {
    const env = { ...process.env };
    if (DB_PASSWORD) env.MYSQL_PWD = DB_PASSWORD;
    else delete env.MYSQL_PWD;
    return env;
}

// Roda o cliente mysql. Se `inputStream` vier, é canalizado para o stdin (restore).
// Se `capture` for true, resolve com o stdout (para queries de verificação).
function runMysql(mysqlArgs, { inputStream = null, capture = false } = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(MYSQL, mysqlArgs, { env: childEnv() });
        let stderr = '';
        let stdout = '';
        child.on('error', (err) =>
            reject(new Error(`Falha ao iniciar mysql em "${MYSQL}": ${err.message}`)));
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        if (capture) child.stdout.on('data', (d) => { stdout += d.toString(); });

        if (inputStream) {
            inputStream.on('error', reject);
            inputStream.pipe(child.stdin);
        }
        child.on('close', (code) => {
            if (code === 0) resolve(stdout);
            else reject(new Error(`mysql saiu com código ${code}.\n${stderr.trim()}`));
        });
    });
}

async function main() {
    if (!DB_USER) usage('DB_USER ausente no .env.');
    if (!file) usage('informe o arquivo de backup.');
    if (!fs.existsSync(file)) usage(`arquivo não encontrado: ${file}`);
    if (!TARGET_DB) usage('--target-db=NOME é obrigatório.');

    const isProd = TARGET_DB === DB_NAME;
    if (isProd && !CONFIRMED) {
        usage(`o destino "${TARGET_DB}" é o banco de PRODUÇÃO. Isso SOBRESCREVE os dados. `
            + `Adicione --yes para confirmar, ou use um --target-db de rascunho para testar.`);
    }

    console.log(`\n=== RESTORE CarCheck ===`);
    console.log(`Arquivo : ${file}`);
    console.log(`Destino : ${TARGET_DB}${isProd ? '  *** PRODUÇÃO ***' : '  (rascunho)'}`);

    // 1) Garante o banco de destino.
    await runMysql(connArgs(['-e',
        `CREATE DATABASE IF NOT EXISTS \`${TARGET_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`]));
    console.log(`[OK] Banco "${TARGET_DB}" pronto.`);

    // 2) Restaura (descomprime .gz em stream, canaliza para o mysql --database).
    const raw = fs.createReadStream(file);
    const input = file.endsWith('.gz') ? raw.pipe(zlib.createGunzip()) : raw;
    await runMysql(connArgs([TARGET_DB]), { inputStream: input });
    console.log(`[OK] Dump aplicado em "${TARGET_DB}".`);

    // 3) Verificação: contagem das tabelas principais.
    const out = await runMysql(connArgs([TARGET_DB, '-N', '-e',
        `SELECT 'funcionarios', COUNT(*) FROM funcionarios
         UNION ALL SELECT 'veiculos',    COUNT(*) FROM veiculos
         UNION ALL SELECT 'checklists',  COUNT(*) FROM checklists
         UNION ALL SELECT 'bdv',         COUNT(*) FROM bdv
         UNION ALL SELECT 'bdv_paradas', COUNT(*) FROM bdv_paradas`]),
        { capture: true });

    console.log('\n=== Verificação (linhas por tabela) ===');
    console.log(out.trim() || '(sem saída)');
    console.log('=======================================');

    if (!isProd) {
        console.log(`\nRestore de TESTE concluído. Se os números batem com a produção, o backup é bom.`);
        console.log(`Descarte o rascunho quando terminar:`);
        console.log(`  "${MYSQL}" ${connArgs().join(' ')} -e "DROP DATABASE \\\`${TARGET_DB}\\\`"`);
    } else {
        console.log(`\nRestore de PRODUÇÃO concluído.`);
    }
    process.exit(0);
}

main().catch((err) => {
    console.error(`\n[ERRO FATAL] ${err.message}`);
    process.exit(1);
});
