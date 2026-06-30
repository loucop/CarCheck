/**
 * Logger com níveis (A14 / B1 backend).
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
 */

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

function resolveThreshold() {
    const isProd = process.env.NODE_ENV === 'production';
    const fallback = isProd ? 'info' : 'debug';
    const requested = (process.env.LOG_LEVEL || '').trim().toLowerCase();
    return LEVELS[requested] !== undefined ? LEVELS[requested] : LEVELS[fallback];
}

// Resolvido uma vez no carregamento (o nível não muda em runtime).
const threshold = resolveThreshold();

function emit(level, sink, args) {
    if (LEVELS[level] > threshold) return;
    sink(new Date().toISOString(), level.toUpperCase(), ...args);
}

const logger = {
    error: (...args) => emit('error', console.error, args),
    warn: (...args) => emit('warn', console.error, args),
    info: (...args) => emit('info', console.log, args),
    debug: (...args) => emit('debug', console.log, args)
};

module.exports = logger;
