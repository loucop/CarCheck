/**
 * Repository: Veículos
 * Schema Real: id (PK), placa, modelo, status, km_atual
 */

const veiculoRepository = {
    /**
     * Listar veículos ativos
     */
    async findAllActive(conn) {
        const query = `
            SELECT id, placa, modelo, status, km_atual 
            FROM veiculos 
            WHERE status = 'ativo' 
            ORDER BY modelo
        `;
        return await conn.query(query);
    },

    /**
     * Buscar veículo por ID
     */
    async findById(conn, id) {
        const query = `
            SELECT id, placa, modelo, status, km_atual 
            FROM veiculos 
            WHERE id = ? 
            LIMIT 1
        `;
        const rows = await conn.query(query, [id]);
        return rows[0] || null;
    },

    /**
     * Buscar veículo com lock pessimista (FOR UPDATE)
     * Usado em transações para evitar race conditions
     */
    async findByIdWithLock(conn, id) {
        const query = `
            SELECT id, placa, modelo, status, km_atual 
            FROM veiculos 
            WHERE id = ? 
            FOR UPDATE
        `;
        const rows = await conn.query(query, [id]);
        return rows[0] || null;
    },

    /**
     * Atualizar KM do veículo
     */
    async updateKm(conn, veiculoId, novoKm) {
        const query = `
            UPDATE veiculos 
            SET km_atual = ? 
            WHERE id = ?
        `;
        await conn.query(query, [novoKm, veiculoId]);
    }
};

module.exports = veiculoRepository;
