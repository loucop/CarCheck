const { ERROR_CODES } = require('../utils/constants');

// ==========================================
// RATE LIMITER GLOBAL (M7)
// ==========================================
// Além do /api/login (que tem seu próprio limiter mais estrito), nenhuma rota
// era limitada — um token de vistoriador comprometido podia inundar as rotas de
// correção (append-only) e o addParada não tinha teto de taxa. Este limiter
// protege TODAS as rotas que alteram estado (POST/PATCH/...). Métodos seguros
// (GET/HEAD/OPTIONS) passam livres: os dashboards admin fazem muitos GETs e o
// /health já é cacheado (M7), então não faz sentido limitá-los aqui.
//
// Store em memória: aceito para o deploy single-process atual (reseta no
// restart, não compartilha estado entre instâncias) — mesma premissa do login
// limiter. Migrar para store compartilhado (Redis) junto dele quando o deploy
// virar multi-instância (M2).
//
// Chaveado por IP. Atrás de um NAT compartilhado todos os usuários dividem o
// mesmo balde, por isso o teto default é generoso (writes humanos são raros:
// abrir BDV, enviar checklist, algumas paradas por viagem). Ajuste via env se
// a organização inteira sair por um único IP. Chavear por usuário é refinamento
// futuro (exige rodar após o auth — ver M2).

const MAX = parseInt(process.env.RATE_LIMIT_MAX) || 120;
const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60 * 1000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const hits = new Map(); // key: IP, value: { count, resetAt }

function apiRateLimiter(req, res, next) {
    if (SAFE_METHODS.has(req.method)) return next();

    const now = Date.now();

    // Limpa entradas expiradas a cada request (mesmo padrão do login limiter).
    for (const [ip, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(ip);
    }

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const entry = hits.get(ip);

    if (entry && entry.resetAt > now) {
        if (entry.count >= MAX) {
            return res.status(429).json({
                success: false,
                error: 'Muitas requisições. Aguarde um momento e tente novamente.',
                code: ERROR_CODES.RATE_LIMIT_EXCEEDED
            });
        }
        entry.count += 1;
    } else {
        hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    }

    next();
}

module.exports = { apiRateLimiter };
