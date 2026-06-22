const pool = require('../config/database');
const correcaoService = require('../services/correcao.service');
const response = require('../utils/response');

// A7 — correções de nível supervisor (vistoriador/admin). A identidade do corretor
// vem SEMPRE do JWT (req.user), nunca do corpo (mesmo padrão do A3).
const correcaoController = {
    /**
     * GET /api/correcoes
     */
    async getHistorico(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await correcaoService.getHistorico(conn, req.query);

            return response.success(res, result);

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * PATCH /api/correcoes/checklist/:id
     */
    async corrigirChecklist(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await correcaoService.corrigirChecklist(
                conn,
                parseInt(req.params.id),
                req.body,
                req.user
            );

            return response.success(res, result, 'Correção registrada com sucesso');

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * PATCH /api/correcoes/bdv/:id
     */
    async corrigirBDV(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await correcaoService.corrigirBDV(
                conn,
                parseInt(req.params.id),
                req.body,
                req.user
            );

            return response.success(res, result, 'Correção registrada com sucesso');

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * PATCH /api/correcoes/veiculo/:id/km
     */
    async corrigirKmVeiculo(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await correcaoService.corrigirKmVeiculo(
                conn,
                parseInt(req.params.id),
                req.body.km_novo,
                req.body.motivo,
                req.user
            );

            return response.success(res, result, 'Correção registrada com sucesso');

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * PATCH /api/correcoes/bdv/:id/paradas/:paradaId
     */
    async corrigirParada(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await correcaoService.corrigirParada(
                conn,
                parseInt(req.params.id),
                parseInt(req.params.paradaId),
                req.body,
                req.user
            );

            return response.success(res, result, 'Correção registrada com sucesso');

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    }
};

module.exports = correcaoController;
