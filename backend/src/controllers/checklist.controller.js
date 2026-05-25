const pool = require("../config/database");
const checklistService = require("../services/checklist.service");
const response = require("../utils/response");

const checklistController = {
  /**
   * POST /api/checklist
   */
  async createChecklist(req, res, next) {
    let conn;

    try {
      conn = await pool.getConnection();

      const result = await checklistService.createChecklist(
        conn,
        req.body,
      );

      return response.created(
        res,
        result,
        "Checklist registrado com sucesso",
      );

    } catch (err) {
      return next(err);

    } finally {
      if (conn) {
        conn.release();
      }
    }
  },

  /**
   * GET /api/veiculos/:id/historico
   */
  async getHistoricoVeiculo(req, res, next) {
    let conn;

    try {
      conn = await pool.getConnection();

      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const result = await checklistService.getHistoricoVeiculo(
        conn,
        parseInt(id),
        parseInt(limit),
        parseInt(offset),
      );

      // Conversão segura de BigInt
      const formatted = {
        ...result,

        veiculo: result.veiculo
          ? {
              ...result.veiculo,
              id: String(result.veiculo.id),
            }
          : null,

        historico: Array.isArray(result.historico)
          ? result.historico.map((h) => ({
              ...h,
              id: String(h.id),
            }))
          : [],
      };

      return response.success(res, formatted);

    } catch (err) {
      return next(err);

    } finally {
      if (conn) {
        conn.release();
      }
    }
  },
};

module.exports = checklistController;