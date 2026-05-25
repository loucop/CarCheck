const pool = require('../config/database');
const veiculoRepository = require('../repositories/veiculo.repository');
const response = require('../utils/response');

const veiculoController = {
    /**
     * GET /api/veiculos
     */
    async listVeiculos(req, res, next) {
        let conn;
        try {
            conn = await pool.getConnection();
            
            const veiculos = await veiculoRepository.findAllActive(conn);
            
            // Converte BigInt para string
            const veiculosFormatted = veiculos.map(v => ({
                ...v,
                id: String(v.id)
            }));
            
            return response.success(res, veiculosFormatted);
            
        } catch (err) {
            next(err);
        } finally {
            if (conn) conn.release();
        }
    }
};

module.exports = veiculoController;
