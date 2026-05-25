/**
 * Repository: Checklists
 * Schema Real: id, veiculo_id, matricula, km_entrada, itens_status, 
 *              mapa_avaria_base64, data_inspecao, local_origem, local_destino
 */

const checklistRepository = {
    /**
     * Criar novo checklist
     */
    async create(conn, data) {
        const query = `
            INSERT INTO checklists 
            (veiculo_id, matricula, km_entrada, local_origem, local_destino, itens_status, mapa_avaria_base64) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const result = await conn.query(query, [
            data.veiculo_id,
            data.matricula,
            data.km_entrada,
            data.local_origem,
            data.local_destino,
            data.itens_status,
            data.mapa_avaria_base64
        ]);
        return result.insertId;
    },

    /**
     * Buscar histórico de veículo
     */
    async findHistoricoByVeiculo(conn, veiculoId, limit, offset) {
        const query = `
            SELECT 
                c.id,
                c.km_entrada,
                c.local_origem,
                c.local_destino,
                c.data_inspecao,
                c.itens_status,
                c.mapa_avaria_base64,
                f.nome as motorista,
                f.cpf as motorista_cpf
            FROM checklists c
            LEFT JOIN funcionarios f ON f.matricula = c.matricula
            WHERE c.veiculo_id = ?
            ORDER BY c.data_inspecao DESC
            LIMIT ? OFFSET ?
        `;
        return await conn.query(query, [veiculoId, limit, offset]);
    },

    /**
     * Contar total de checklists de um veículo
     */
    async countByVeiculo(conn, veiculoId) {
        const query = `
            SELECT COUNT(*) as total 
            FROM checklists 
            WHERE veiculo_id = ?
        `;
        const rows = await conn.query(query, [veiculoId]);
        return rows[0].total;
    },

    /**
     * Buscar relatório administrativo
     */
    async findRelatorio(conn, funcionarioMatricula, limit, offset) {
        let query = `
            SELECT 
                c.id, 
                c.veiculo_id,
                v.placa, 
                v.modelo,
                f.nome as motorista,
                f.cpf as motorista_cpf,
                f.matricula as motorista_matricula,
                c.km_entrada, 
                c.local_origem,
                c.local_destino,
                c.data_inspecao, 
                c.mapa_avaria_base64,
                c.itens_status
            FROM checklists c
            LEFT JOIN veiculos v ON v.id = c.veiculo_id
            LEFT JOIN funcionarios f ON f.matricula = c.matricula
        `;
        
        let params = [];
        
        if (funcionarioMatricula) {
            query += " WHERE c.matricula = ?";
            params.push(funcionarioMatricula);
        }
        
        query += ` ORDER BY c.data_inspecao DESC LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        return await conn.query(query, params);
    },

    /**
     * Buscar checklist por ID
     */
    async findById(conn, id) {
        const query = `
            SELECT 
                c.*,
                v.placa,
                v.modelo,
                f.nome as motorista
            FROM checklists c
            LEFT JOIN veiculos v ON v.id = c.veiculo_id
            LEFT JOIN funcionarios f ON f.matricula = c.matricula
            WHERE c.id = ?
            LIMIT 1
        `;
        const rows = await conn.query(query, [id]);
        return rows[0] || null;
    }
};

module.exports = checklistRepository;
