const pool = require('../config/database');
const checklistService = require('../services/checklist.service');
const response = require('../utils/response');

const adminController = {
    /**
     * GET /api/admin/relatorio
     */
    async getRelatorio(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();
            
            const { funcionario_id, limit, offset } = req.query;
            
            const relatorios = await checklistService.getRelatorioAdmin(
                conn,
                funcionario_id,
                limit,
                offset
            );
            
            return response.success(res, relatorios);
            
        } catch (err) {
            next(err);
        } finally {
            if (conn) conn.release();
        }
    }
};

module.exports = adminController;
