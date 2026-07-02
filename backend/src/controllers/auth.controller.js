const pool = require('../config/database');
const authService = require('../services/auth.service');
const funcionarioRepository = require('../repositories/funcionario.repository');
const response = require('../utils/response');
const logger = require('../utils/logger');
const { ERROR_CODES } = require('../utils/constants');
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

            // M4 Fase 3: a sessão é entregue SOMENTE via cookie httpOnly. O token
            // não volta mais no body — o frontend usa apenas `user` (UI) e o
            // cookie carrega a credencial em toda requisição.
            res.cookie(TOKEN_COOKIE_NAME, result.token, setCookieOptions());

            // M18: trilha de auth. Matrícula + IP têm finalidade legítima (LGPD),
            // diferente do PII de debug (KM). Nível info → visível em produção.
            logger.info(`[AUTH] login OK matricula=${result.user.matricula} ip=${req.ip}`);

            return response.success(res, { user: result.user }, 'Login realizado com sucesso');

        } catch (err) {
            // M18: registra a TENTATIVA falha (credencial inválida) em warn — sinal
            // de segurança (grep/brute-force). Outros erros seguem para o handler.
            if (err && err.code === ERROR_CODES.AUTH_FAILED) {
                logger.warn(`[AUTH] login FALHOU matricula=${req.body?.matricula ?? '?'} ip=${req.ip}`);
            }
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
        // M18: rota pública (cookie-only), então a matrícula não é conhecida aqui —
        // registra o evento com o IP.
        logger.info(`[AUTH] logout ip=${req.ip}`);
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
