const jwt = require('jsonwebtoken');
const response = require('../utils/response');
const { ERROR_CODES, ROLES } = require('../utils/constants');
const { TOKEN_COOKIE_NAME } = require('../utils/cookie');

/**
 * Middleware de autenticação JWT
 * Valida token e injeta req.user
 *
 * M4 Fase 3 (cookie-only): o token vem EXCLUSIVAMENTE do cookie httpOnly. O
 * fallback do header Authorization (dual-read da Fase 1) foi removido — todo
 * cliente precisa enviar o cookie de sessão (`credentials:'include'`).
 */
const authenticate = (req, res, next) => {
    try {
        const token = req.cookies?.[TOKEN_COOKIE_NAME];

        if (!token) {
            return response.unauthorized(res, 'Token não fornecido', ERROR_CODES.TOKEN_INVALID);
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
