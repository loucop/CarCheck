/**
 * Utilitário para respostas HTTP padronizadas
 */

const success = (res, data, message = 'Operação realizada com sucesso', statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        data,
        message
    });
};

const error = (res, errorMessage, code = 'INTERNAL_ERROR', statusCode = 500) => {
    return res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code
    });
};

const created = (res, data, message = 'Recurso criado com sucesso') => {
    return success(res, data, message, 201);
};

const badRequest = (res, errorMessage, code = 'BAD_REQUEST') => {
    return error(res, errorMessage, code, 400);
};

const unauthorized = (res, errorMessage = 'Não autorizado', code = 'UNAUTHORIZED') => {
    return error(res, errorMessage, code, 401);
};

const forbidden = (res, errorMessage = 'Acesso negado', code = 'FORBIDDEN') => {
    return error(res, errorMessage, code, 403);
};

const notFound = (res, errorMessage = 'Recurso não encontrado', code = 'NOT_FOUND') => {
    return error(res, errorMessage, code, 404);
};

const conflict = (res, errorMessage, code = 'CONFLICT') => {
    return error(res, errorMessage, code, 409);
};

module.exports = {
    success,
    error,
    created,
    badRequest,
    unauthorized,
    forbidden,
    notFound,
    conflict
};
