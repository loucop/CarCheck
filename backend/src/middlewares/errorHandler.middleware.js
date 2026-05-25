const { ERROR_CODES } = require('../utils/constants');

/**
 * Error handler global
 * Captura erros não tratados nas rotas
 */
const errorHandler = (err, req, res, next) => {
    // Previne envio duplo de response
    if (res.headersSent) {
        return next(err);
    }

    // Log estruturado
    const errorLog = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.url,
        error: err.message,
        stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
        user: req.user?.matricula || 'anonymous'
    };
    
    console.error('[ERROR]', JSON.stringify(errorLog));

    // Erros de banco MariaDB
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            success: false,
            error: 'Registro duplicado',
            code: ERROR_CODES.DUPLICATE_ENTRY
        });
    }

    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({
            success: false,
            error: 'Referência inválida (chave estrangeira)',
            code: ERROR_CODES.DB_ERROR
        });
    }

    // Erro genérico de banco
    if (err.code && err.code.startsWith('ER_')) {
        return res.status(500).json({
            success: false,
            error: 'Erro no banco de dados',
            code: ERROR_CODES.DB_ERROR,
            details: process.env.NODE_ENV !== 'production' ? err.message : undefined
        });
    }

    // Erro customizado (do service)
    if (err.statusCode) {
        return res.status(err.statusCode).json({
            success: false,
            error: err.message,
            code: err.code || ERROR_CODES.INTERNAL_ERROR
        });
    }

    // Erro genérico
    return res.status(500).json({
        success: false,
        error: err.message || 'Erro interno do servidor',
        code: ERROR_CODES.INTERNAL_ERROR
    });
};

/**
 * Handler para rotas não encontradas
 */
const notFoundHandler = (req, res) => {
    return res.status(404).json({
        success: false,
        error: `Rota não encontrada: ${req.method} ${req.url}`,
        code: ERROR_CODES.RESOURCE_NOT_FOUND
    });
};

module.exports = {
    errorHandler,
    notFoundHandler
};
