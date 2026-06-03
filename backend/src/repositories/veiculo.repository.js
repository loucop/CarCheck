const veiculoRepository = {
    async findAllActive(conn) {
        const query = `
            SELECT id, placa, modelo, status, km_atual 
            FROM veiculos 
            WHERE status IN ('disponivel', 'em_uso')
            ORDER BY modelo
        `;
        return await conn.query(query);
    },

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

    async updateStatus(conn, veiculoId, status) {
        const query = `
            UPDATE veiculos
            SET status = ?
            WHERE id = ?
        `;
        return await conn.query(query, [status, veiculoId]);
    },

    async updateKm(conn, veiculoId, novoKm) {
        console.log('[VEICULO REPO] updateKm | veiculoId:', veiculoId, '| novoKm:', novoKm);
        const query = `
            UPDATE veiculos 
            SET km_atual = ? 
            WHERE id = ?
        `;
        const result = await conn.query(query, [novoKm, veiculoId]);
        console.log('[VEICULO REPO] updateKm result:', result);
        return result;
    }
};

module.exports = veiculoRepository;
