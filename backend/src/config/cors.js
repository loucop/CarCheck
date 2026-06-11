/**
 * Allowlist de origens CORS — fonte única de verdade.
 *
 * Usada tanto pelo middleware de CORS (backend/index.js) quanto pelo
 * middleware de CSRF (checagem de Origin/Referer). Mantê-las sincronizadas
 * é essencial: o CSRF reaproveita exatamente a mesma allowlist do CORS.
 *
 * O host LAN é sempre permitido por padrão; origens adicionais (ex.: domínio
 * Cloudflare em produção) entram via a env CORS_ORIGINS (separadas por vírgula),
 * sem mexer no código.
 */
const DEFAULT_CORS_ORIGINS = ['http://10.10.1.100:10081'];

const corsOrigins = [
    ...DEFAULT_CORS_ORIGINS,
    ...(process.env.CORS_ORIGINS || '')
        .split(',')
        .map(o => o.trim())
        .filter(Boolean)
];

module.exports = { corsOrigins };
