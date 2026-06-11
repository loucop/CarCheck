const jwt = require('jsonwebtoken');
const response = require('../utils/response');
const { ERROR_CODES, ROLES } = require('../utils/constants');
const { TOKEN_COOKIE_NAME } = require('../utils/cookie');

/**
 * Middleware de autenticação JWT
 * Valida token e injeta req.user
 *
 * M4 Fase 1 (dual-read): lê o token do cookie httpOnly primeiro; se ausente,
 * cai para o header Authorization (retrocompat com o frontend atual). O
 * fallback de header sai na Fase 3, tornando a auth cookie-only.
 */
const authenticate = (req, res, next) => {
    try {
        let token = req.cookies?.[TOKEN_COOKIE_NAME];

        if (!token) {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return response.unauthorized(res, 'Token não fornecido', ERROR_CODES.TOKEN_INVALID);
            }
            token = authHeader.substring(7);
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Injeta dados do usuário na requisição
        req.user = {
            matricula: decoded.matricula,
            nivel_acesso: decoded.nivel_acesso
        };
        
        next();
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return response.unauthorized(res, 'Token expirado', ERROR_CODES.TOKEN_EXPIRED);
        }
        if (err.name === 'JsonWebTokenError') {
            return response.unauthorized(res, 'Token inválido', ERROR_CODES.TOKEN_INVALID);
        }
        return response.error(res, 'Erro na autenticação', ERROR_CODES.AUTH_FAILED);
    }
};

/**
 * Middleware de autorização por role
 * @param {string|string[]} allowedRoles - Role(s) permitida(s)
 */
const authorize = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return response.unauthorized(res, 'Usuário não autenticado', ERROR_CODES.AUTH_FAILED);
        }

        const hasRole = allowedRoles.includes(req.user.nivel_acesso);
        
        if (!hasRole) {
            return response.forbidden(
                res, 
                'Permissão insuficiente para esta operação', 
                ERROR_CODES.INSUFFICIENT_PERMISSION
            );
        }

        next();
    };
};

module.exports = {
    authenticate,
    authorize
};
