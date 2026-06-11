const response = require('../utils/response');
const { ERROR_CODES } = require('../utils/constants');
const { corsOrigins } = require('../config/cors');

/**
 * Proteção CSRF por checagem de Origin/Referer.
 *
 * Com o token em cookie httpOnly (M4), o navegador passa a enviá-lo
 * automaticamente — o que reabre a superfície de CSRF. Como frontend e backend
 * são same-site (SameSite=Lax já barra a maioria dos vetores cross-site), esta
 * checagem é a segunda camada: em métodos que alteram estado, o cabeçalho
 * Origin (ou, na falta dele, o Referer) precisa bater com a allowlist do CORS.
 *
 * Requests sem Origin E sem Referer são permitidos (curl, health checks, apps
 * nativos) — coerente com a política do CORS, já que CSRF é um ataque de
 * navegador e clientes não-navegador não carregam credenciais ambientais.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const csrfProtection = (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) {
        return next();
    }

    const origin = req.headers.origin;
    const referer = req.headers.referer;

    // Sem Origin nem Referer -> cliente não-navegador; permite (igual ao CORS).
    if (!origin && !referer) {
        return next();
    }

    // Resolve a origem a verificar: prioriza Origin; senão deriva do Referer.
    let candidate = origin;
    if (!candidate && referer) {
        try {
            candidate = new URL(referer).origin;
        } catch {
            candidate = null;
        }
    }

    if (candidate && corsOrigins.includes(candidate)) {
        return next();
    }

    return response.forbidden(
        res,
        'Origem da requisição não permitida',
        ERROR_CODES.CSRF_DENIED
    );
};

module.exports = { csrfProtection };
