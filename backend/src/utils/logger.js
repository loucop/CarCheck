/**
 * Logger com níveis (A14 / B1 backend) + sink de arquivo (M18).
 *
 * Sink único para todo o backend, substituindo os `console.*` espalhados.
 * O nível é controlado por LOG_LEVEL; abaixo do limiar, a chamada é no-op —
 * é assim que os logs de PII (matrícula/KM) viram `logger.debug` e ficam
 * SILENCIOSOS em produção por padrão (LGPD + redução de ruído de alto volume).
 *
 * LOG_LEVEL (env): error < warn < info < debug.
 *   - default em produção: 'info'  (debug suprimido → sem PII)
 *   - default fora de prod: 'debug'
 * Nível inválido cai no default do ambiente.
 *
 * Roteamento de stream (combina com AppStdout/AppStderr do NSSM, B8):
 *   error/warn → stderr · info/debug → stdout
 *
 * M18 — Sink de arquivo: além do console, cada linha (dentro do limiar) é
 * anexada a `logs/carcheck-<YYYY-MM-DD>.log` (rotação diária + retenção). Sem
 * isto, todo log morre com a janela do terminal enquanto o serviço NSSM (B8)
 * segue bloqueado por falta de admin. Sem dependência nova. O sink NUNCA
 * derruba o app: qualquer falha de I/O rebaixa para só-console.
 */

const fs = require('fs');
const path = require('path');
const util = require('util');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function resolveThreshold() {
    const isProd = process.env.NODE_ENV === 'production';
    const fallback = isProd ? 'info' : 'debug';
    const requested = (process.env.LOG_LEVEL || '').trim().toLowerCase();
    return LEVELS[requested] !== undefined ? LEVELS[requested] : LEVELS[fallback];
}

// Resolvido uma vez no carregamento (o nível não muda em runtime).
const threshold = resolveThreshold();

// --- Sink de arquivo (M18) ---
const LOG_DIR = process.env.LOG_DIR || path.join(__dirname, '..', '..', 'logs');
const RETENTION_DAYS = parseInt(process.env.LOG_RETENTION_DAYS, 10) || 30;

let fileSinkReady = false;

function logFilePath(date) {
    const d = date || new Date();
    const p = (n) => String(n).padStart(2, '0');
    const stamp = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    return path.join(LOG_DIR, `carcheck-${stamp}.log`);
}

// Apaga arquivos de log além da janela de retenção (rodado uma vez na carga).
function pruneOldLogs() {
    const cutoff = Date.now() - RETENTION_DAYS * 86400000;
    let files;
    try { files = fs.readdirSync(LOG_DIR); } catch { return; }
    for (const f of files) {
        const m = /^carcheck-(\d{4})-(\d{2})-(\d{2})\.log$/.exec(f);
        if (!m) continue;
        const t = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`).getTime();
        if (t < cutoff) {
            try { fs.unlinkSync(path.join(LOG_DIR, f)); } catch { /* ignora */ }
        }
    }
}

try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fileSinkReady = true;
    pruneOldLogs();
} catch (err) {
    // Nunca deixa o logging derrubar o app: segue só com console.
    console.error(new Date().toISOString(), 'WARN',
        `[LOGGER] sink de arquivo indisponível (${err.message}); usando só console`);
}

function formatArg(a) {
    return typeof a === 'string' ? a : util.inspect(a, { depth: 4, breakLength: Infinity });
}

// append síncrono: baixa vazão (info/warn/error) e garante que a última linha
// antes de um crash já esteja em disco (diagnosticabilidade > micro-latência).
function writeToFile(timestamp, levelUpper, args) {
    if (!fileSinkReady) return;
    const line = `${timestamp} ${levelUpper} ${args.map(formatArg).join(' ')}\n`;
    try {
        fs.appendFileSync(logFilePath(), line);
    } catch (err) {
        fileSinkReady = false;
        console.error(new Date().toISOString(), 'WARN',
            `[LOGGER] falha ao escrever no arquivo (${err.message}); sink de arquivo desabilitado`);
    }
}

function emit(level, sink, args) {
    if (LEVELS[level] > threshold) return;
    const timestamp = new Date().toISOString();
    const levelUpper = level.toUpperCase();
    sink(timestamp, levelUpper, ...args);
    writeToFile(timestamp, levelUpper, args);
}

const logger = {
    error: (...args) => emit('error', console.error, args),
    warn: (...args) => emit('warn', console.error, args),
    info: (...args) => emit('info', console.log, args),
    debug: (...args) => emit('debug', console.log, args)
};

module.exports = logger;
