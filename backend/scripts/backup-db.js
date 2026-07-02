/**
 * BACKUP AGENDADO DO BANCO (A16)
 *
 * Faz um dump lógico do MariaDB via `mysqldump`, comprime com gzip e aplica
 * rotação (N diários + N semanais). Pensado para rodar sem intervenção pelo
 * Agendador de Tarefas do Windows, sob a conta padrão do servidor (NÃO exige
 * privilégio de administrador — ao contrário do serviço NSSM do B8).
 *
 * Uso:
 *   node scripts/backup-db.js          # dump + rotação (uso normal / agendado)
 *
 * Credenciais e caminhos vêm do backend/.env (carregado por caminho ABSOLUTO
 * abaixo, então o script independe do diretório de trabalho do agendador).
 * A senha é passada ao mysqldump via MYSQL_PWD (nunca na linha de comando).
 *
 * Layout do destino (BACKUP_DIR):
 *   backups/daily/   carcheck-<db>-<timestamp>.sql.gz   (mantém BACKUP_KEEP_DAILY)
 *   backups/weekly/  carcheck-<db>-<timestamp>.sql.gz   (mantém BACKUP_KEEP_WEEKLY)
 *
 * O dump é em nível de TABELA (sem --databases): o restore escolhe o banco de
 * destino explicitamente (ver restore-db.js), o que torna o teste de restore
 * seguro (restaura num banco de rascunho, confere, descarta).
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');

// .env por caminho absoluto — o Agendador de Tarefas roda com CWD = system32.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = process.env.DB_PORT || '3306';
const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;

const MYSQLDUMP = process.env.MYSQLDUMP_PATH || 'C:\\xampp\\mysql\\bin\\mysqldump.exe';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups');
const KEEP_DAILY = parseInt(process.env.BACKUP_KEEP_DAILY, 10) || 7;
const KEEP_WEEKLY = parseInt(process.env.BACKUP_KEEP_WEEKLY, 10) || 4;
const WEEKLY_INTERVAL_DAYS = 7;

const DAILY_DIR = path.join(BACKUP_DIR, 'daily');
const WEEKLY_DIR = path.join(BACKUP_DIR, 'weekly');

function timestamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// Executa mysqldump e escreve a saída comprimida em destPath. Rejeita (e o
// caller apaga o arquivo parcial) se o mysqldump falhar por qualquer motivo.
function runDump(destPath) {
    return new Promise((resolve, reject) => {
        const args = [
            `--host=${DB_HOST}`,
            `--port=${DB_PORT}`,
            `--user=${DB_USER}`,
            '--single-transaction', // snapshot consistente (InnoDB) sem travar escritas
            '--quick',              // não bufferiza linha a linha na RAM (tabelas grandes)
            '--routines',
            '--triggers',
            '--events',
            '--default-character-set=utf8mb4',
            DB_NAME,
        ];

        const env = { ...process.env };
        if (DB_PASSWORD) env.MYSQL_PWD = DB_PASSWORD;
        else delete env.MYSQL_PWD;

        const child = spawn(MYSQLDUMP, args, { env });
        const gzip = zlib.createGzip();
        const out = fs.createWriteStream(destPath);
        let stderr = '';
        let settled = false;
        let dumpExit = null;   // código de saída do mysqldump (null = ainda rodando)
        let fileDone = false;  // arquivo de saída totalmente gravado

        const fail = (err) => { if (!settled) { settled = true; reject(err); } };
        // Só resolve quando o mysqldump saiu com 0 E o gzip terminou de escrever.
        const maybeResolve = () => {
            if (settled) return;
            if (dumpExit === 0 && fileDone) { settled = true; resolve(); }
        };

        child.on('error', (err) =>
            fail(new Error(`Falha ao iniciar mysqldump em "${MYSQLDUMP}": ${err.message}`)));
        child.stderr.on('data', (d) => { stderr += d.toString(); });
        gzip.on('error', fail);
        out.on('error', fail);

        child.stdout.pipe(gzip).pipe(out);

        out.on('finish', () => { fileDone = true; maybeResolve(); });
        child.on('close', (code) => {
            dumpExit = code;
            if (code !== 0) fail(new Error(`mysqldump saiu com código ${code}.\n${stderr.trim()}`));
            else maybeResolve();
        });
    });
}

// Mantém os `keep` arquivos .sql.gz mais recentes de `dir`; apaga o resto.
function prune(dir, keep) {
    const files = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.sql.gz'))
        .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
        .sort((a, b) => b.t - a.t);

    for (const { f } of files.slice(keep)) {
        fs.unlinkSync(path.join(dir, f));
        console.log(`[PRUNE] removido ${path.relative(BACKUP_DIR, path.join(dir, f))}`);
    }
}

// Idade (em dias) do arquivo de backup mais novo em `dir`; Infinity se vazio.
function newestAgeDays(dir) {
    const times = fs.readdirSync(dir)
        .filter((f) => f.endsWith('.sql.gz'))
        .map((f) => fs.statSync(path.join(dir, f)).mtimeMs);
    if (!times.length) return Infinity;
    return (Date.now() - Math.max(...times)) / 86400000;
}

async function main() {
    if (!DB_USER || !DB_NAME) {
        console.error('[ERRO] DB_USER e DB_NAME são obrigatórios no .env.');
        process.exit(1);
    }
    if (!DB_PASSWORD) {
        console.warn('[AVISO] DB_PASSWORD vazio — conectando sem senha (normal no root do XAMPP).');
    }

    fs.mkdirSync(DAILY_DIR, { recursive: true });
    fs.mkdirSync(WEEKLY_DIR, { recursive: true });

    const fileName = `carcheck-${DB_NAME}-${timestamp()}.sql.gz`;
    const dailyPath = path.join(DAILY_DIR, fileName);

    console.log(`\n=== BACKUP CarCheck — ${DB_NAME}@${DB_HOST}:${DB_PORT} ===`);
    console.log(`Destino: ${dailyPath}`);

    try {
        await runDump(dailyPath);
    } catch (err) {
        // não deixa um .gz truncado/enganoso para trás
        if (fs.existsSync(dailyPath)) fs.unlinkSync(dailyPath);
        console.error(`\n[ERRO FATAL] ${err.message}`);
        process.exit(1);
    }

    const size = fs.statSync(dailyPath).size;
    console.log(`[OK] Dump gravado (${humanSize(size)}).`);

    // Promoção semanal: se o backup semanal mais novo tem >= 7 dias (ou não há
    // nenhum), copia o dump de hoje para weekly/. Robusto a qual dia a tarefa roda.
    if (newestAgeDays(WEEKLY_DIR) >= WEEKLY_INTERVAL_DAYS) {
        const weeklyPath = path.join(WEEKLY_DIR, fileName);
        fs.copyFileSync(dailyPath, weeklyPath);
        console.log(`[WEEKLY] promovido para ${path.relative(BACKUP_DIR, weeklyPath)}`);
    }

    prune(DAILY_DIR, KEEP_DAILY);
    prune(WEEKLY_DIR, KEEP_WEEKLY);

    console.log(`=== CONCLUÍDO — daily(mantém ${KEEP_DAILY}) / weekly(mantém ${KEEP_WEEKLY}) ===\n`);
    process.exit(0);
}

main();
