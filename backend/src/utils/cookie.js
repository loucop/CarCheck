/**
 * Helpers para o cookie de sessão (token JWT).
 *
 * M4: o token migra de localStorage para um cookie httpOnly (fora do alcance
 * de XSS). As opções de set e clear precisam ser IDÊNTICAS (path/sameSite/
 * secure/domain/httpOnly), senão o navegador não remove o cookie no logout.
 */

const TOKEN_COOKIE_NAME = 'token';

/**
 * Converte uma duração no formato do jsonwebtoken (ex.: '2h', '12h', '7d',
 * '30m', '45s', ou um número em segundos) para milissegundos — necessário
 * para o maxAge do cookie. Default: 2h (alinhado à postura JWT_EXPIRES_IN=2h).
 */
function parseDurationMs(value, defaultMs = 2 * 60 * 60 * 1000) {
    if (value == null || value === '') return defaultMs;

    // Número puro -> segundos (semântica do jsonwebtoken)
    if (/^\d+$/.test(String(value).trim())) {
        return Number(value) * 1000;
    }

    const match = /^(\d+)\s*(s|m|h|d)$/i.exec(String(value).trim());
    if (!match) return defaultMs;

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const unitMs = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
    return amount * unitMs[unit];
}

/**
 * Opções base do cookie (sem maxAge), compartilhadas por set e clear.
 *
 * `secure` é dirigido por COOKIE_SECURE (e NÃO por NODE_ENV): o servidor LAN
 * roda em HTTP com NODE_ENV=production, então amarrar `secure` ao NODE_ENV
 * impediria o cookie de trafegar. Manter COOKIE_SECURE=false na LAN e
 * COOKIE_SECURE=true ao publicar via HTTPS.
 *
 * SameSite=Lax: frontend (:10081) e backend (:3000) são o mesmo site (a porta
 * não conta para "site"), então o cookie acompanha as requisições.
 */
function baseCookieOptions() {
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.COOKIE_SECURE === 'true',
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: '/'
    };
}

/** Opções para res.cookie(...) — inclui maxAge derivado de JWT_EXPIRES_IN. */
function setCookieOptions() {
    return {
        ...baseCookieOptions(),
        maxAge: parseDurationMs(process.env.JWT_EXPIRES_IN)
    };
}

/** Opções para res.clearCookie(...) — devem casar com as de set (sem maxAge). */
function clearCookieOptions() {
    return baseCookieOptions();
}

module.exports = {
    TOKEN_COOKIE_NAME,
    parseDurationMs,
    setCookieOptions,
    clearCookieOptions
};
