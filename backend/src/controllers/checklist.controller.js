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

      // A3: a identidade vem SEMPRE do JWT, nunca do corpo. A matrícula injetada
      // aqui é a usada tanto no guard de duplicidade quanto no INSERT (service).
      const result = await checklistService.createChecklist(
        conn,
        { ...req.body, matricula: req.user.matricula },
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
   * GET /api/checklist/pendente
   * Checklist órfão (do dia, sem BDV vinculado) do motorista autenticado.
   * A matrícula vem do JWT (req.user), nunca do body (A3). 200 ou 404 (A6).
   */
  async getPendente(req, res, next) {
    let conn;

    try {
      conn = await pool.getConnection();

      const result = await checklistService.getChecklistPendente(
        conn,
        req.user.matricula,
      );

      return response.success(res, result);

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

  /**
   * GET /api/checklist/:id/mapa
   * A11: imagem de avaria de um checklist, sob demanda (fora das listas).
   */
  async getMapa(req, res, next) {
    let conn;

    try {
      conn = await pool.getConnection();

      const { id } = req.params;
      const data = await checklistService.getMapaChecklist(conn, parseInt(id));

      return response.success(res, data);

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