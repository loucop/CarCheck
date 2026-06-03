const pool = require('../config/database');
const bdvService = require('../services/bdv.service');
const response = require('../utils/response');

const bdvController = {
    /**
     * POST /api/bdv
     * Motorista abre um novo BDV para o veículo selecionado
     */
    async open(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await bdvService.openBDV(conn, {
                ...req.body,
                matricula: req.user.matricula  // always from JWT, never trusted from body
            });

            return response.created(res, result, 'BDV aberto com sucesso');

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * GET /api/bdv/:id
     * Retorna BDV completo com todas as paradas
     */
    async findById(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await bdvService.getBDV(conn, parseInt(req.params.id));

            return response.success(res, result);

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * POST /api/bdv/:id/paradas
     * Registra uma nova parada dentro de um BDV aberto
     */
    async addParada(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await bdvService.addParada(
                conn,
                parseInt(req.params.id),
                req.user.matricula,
                req.body
            );

            return response.created(res, result, 'Parada registrada com sucesso');

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * PATCH /api/bdv/:id/paradas/:paradaId
     * Registra chegada (hora_chegada + km) em uma parada aberta
     */
    async closeParada(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await bdvService.closeParada(
                conn,
                parseInt(req.params.id),
                parseInt(req.params.paradaId),
                req.user.matricula,
                req.body
            );

            return response.success(res, result, 'Chegada registrada com sucesso');

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * PATCH /api/bdv/:id/encerrar
     * Encerra o BDV: registra km_final, combustível e status
     */
    async close(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const result = await bdvService.closeBDV(
                conn,
                parseInt(req.params.id),
                req.user.matricula,
                req.body
            );

            return response.success(res, result, 'BDV encerrado com sucesso');

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    },

    /**
     * GET /api/admin/bdv
     * Relatório de BDVs com filtros (admin)
     */
    async relatorio(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();

            const { matricula, veiculo_id, coligada, data_inicio, data_fim, limit, offset } = req.query;

            const result = await bdvService.getRelatorio(conn, {
                matricula,
                veiculo_id: veiculo_id ? parseInt(veiculo_id) : undefined,
                coligada,
                data_inicio,
                data_fim,
                limit,
                offset
            });

            return response.success(res, result);

        } catch (err) {
            return next(err);
        } finally {
            if (conn) conn.release();
        }
    }
};

module.exports = bdvController;
