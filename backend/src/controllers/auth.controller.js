const pool = require('../config/database');
const authService = require('../services/auth.service');
const funcionarioRepository = require('../repositories/funcionario.repository');
const response = require('../utils/response');

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
            
            return response.success(res, result, 'Login realizado com sucesso');
            
        } catch (err) {
            next(err);
        } finally {
            if (conn) conn.release();
        }
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
