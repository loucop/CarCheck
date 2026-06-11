const pool = require('../config/database');
const authService = require('../services/auth.service');
const funcionarioRepository = require('../repositories/funcionario.repository');
const response = require('../utils/response');
const {
    TOKEN_COOKIE_NAME,
    setCookieOptions,
    clearCookieOptions
} = require('../utils/cookie');

const authController = {
    /**
     * POST /api/login
     */
    async login(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const { matricula, senha } = req.body;

            const result = await authService.login(conn, matricula, senha);

            // M4 Fase 1: além de retornar o token no body (retrocompat com o
            // frontend atual que lê de localStorage), grava o token em cookie
            // httpOnly. O frontend será migrado para o cookie na Fase 2; o body
            // deixa de carregar o token na Fase 3.
            res.cookie(TOKEN_COOKIE_NAME, result.token, setCookieOptions());

            return response.success(res, result, 'Login realizado com sucesso');

        } catch (err) {
            next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * POST /api/logout
     * Limpa o cookie de sessão. Público (deve funcionar mesmo com token já
     * expirado) e ponto único para uma futura denylist de tokens (Opção D).
     */
    async logout(req, res) {
        res.clearCookie(TOKEN_COOKIE_NAME, clearCookieOptions());
        return response.success(res, null, 'Logout realizado com sucesso');
    },

    /**
     * GET /api/me
     * Valida a sessão (via authenticate) e devolve o usuário do token.
     * Permite ao frontend checar "estou logado?" sem ler o cookie httpOnly.
     */
    async me(req, res) {
        return response.success(res, req.user);
    },

    /**
     * POST /api/admin/funcionarios
     */
    async createFuncionario(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();
            
            const funcionario = await authService.createFuncionario(conn, req.body);
            
            return response.created(res, funcionario, 'Funcionário cadastrado com sucesso');
            
        } catch (err) {
            next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * GET /api/admin/funcionarios
     */
    async listFuncionarios(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();
            
            const funcionarios = await funcionarioRepository.findAll(conn);
            
            return response.success(res, funcionarios);
            
        } catch (err) {
            next(err);
        } finally {
            if (conn) conn.release();
        }
    }
};

module.exports = authController;
