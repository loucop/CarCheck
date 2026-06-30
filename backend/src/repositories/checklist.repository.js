const checklistRepository = {
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

    // A11: NÃO seleciona mapa_avaria_base64 — o histórico só renderiza
    // data/motorista/KM/rota; a imagem (LONGTEXT, até 500 KB) viajava sem uso.
    // O detalhe da imagem é servido sob demanda por findMapaById (GET /checklist/:id/mapa).
    // A14: também NÃO retorna CPF (PII/LGPD) — este endpoint é aberto a qualquer
    // usuário autenticado e o CPF não é renderizado; reservado a visões admin-scoped.
    async findHistoricoByVeiculo(conn, veiculoId, limit, offset) {
        const query = `
            SELECT
                c.id,
                c.km_entrada,
                c.local_origem,
                c.local_destino,
                c.data_inspecao,
                c.itens_status,
                f.nome as motorista
            FROM checklists c
            LEFT JOIN funcionarios f ON f.matricula = c.matricula
            WHERE c.veiculo_id = ?
            ORDER BY c.data_inspecao DESC
            LIMIT ? OFFSET ?
        `;
        return await conn.query(query, [veiculoId, limit, offset]);
    },

    async countByVeiculo(conn, veiculoId) {
        const query = `SELECT COUNT(*) as total FROM checklists WHERE veiculo_id = ?`;
        const rows = await conn.query(query, [veiculoId]);
        return rows[0].total;
    },

    // B4: query do guard diário — roda em TODO submit de checklist e abertura de BDV.
    // Reescrita sargável: range em data_inspecao (em vez de DATE(...) = CURDATE(), que
    // derrota o índice (matricula, data_inspecao) do A12) + NOT EXISTS anti-join (em vez
    // de NOT IN(subquery), que varre bdv inteiro). NOT EXISTS é imune ao trap de NULL do
    // NOT IN, então dispensa o antigo `WHERE checklist_id IS NOT NULL`.
    async findPendingTodayByMatricula(conn, matricula) {
        const query = `
            SELECT c.id, c.veiculo_id FROM checklists c
            WHERE c.matricula = ?
              AND c.data_inspecao >= CURDATE()
              AND c.data_inspecao < CURDATE() + INTERVAL 1 DAY
              AND NOT EXISTS (SELECT 1 FROM bdv b WHERE b.checklist_id = c.id)
            ORDER BY c.id DESC LIMIT 1
        `;
        const rows = await conn.query(query, [matricula]);
        return rows.length > 0 ? rows[0] : null;
    },

    // A6: mesmo critério de "órfão" do findPendingTodayByMatricula (checklist de
    // hoje, do motorista, ainda não vinculado a um BDV), mas com o contexto de
    // veículo que a recuperação precisa para abrir o BDV (veiculo_id + KM + placa/modelo).
    // B4: mesma reescrita sargável + anti-join do guard acima.
    async findPendingDetailTodayByMatricula(conn, matricula) {
        const query = `
            SELECT
                c.id,
                c.veiculo_id,
                c.km_entrada,
                v.placa,
                v.modelo
            FROM checklists c
            LEFT JOIN veiculos v ON v.id = c.veiculo_id
            WHERE c.matricula = ?
              AND c.data_inspecao >= CURDATE()
              AND c.data_inspecao < CURDATE() + INTERVAL 1 DAY
              AND NOT EXISTS (SELECT 1 FROM bdv b WHERE b.checklist_id = c.id)
            ORDER BY c.id DESC LIMIT 1
        `;
        const rows = await conn.query(query, [matricula]);
        return rows.length > 0 ? rows[0] : null;
    },

    // A11: NÃO seleciona mapa_avaria_base64 — antes vinha em TODAS as linhas do
    // relatório (default 100), inflando o payload em MB e segurando uma conexão do
    // pool pela transferência inteira. A imagem é buscada por linha, sob demanda,
    // via findMapaById quando o admin abre o detalhe.
    // A14: também NÃO retorna CPF (PII/LGPD) — não é renderizado no relatório e o
    // A7 expôs esta rota ao vistoriador; CPF fica restrito à gestão de funcionários.
    async findRelatorio(conn, funcionarioMatricula, limit, offset) {
        let query = `
            SELECT
                c.id,
                c.veiculo_id,
                v.placa,
                v.modelo,
                f.nome as motorista,
                f.matricula as motorista_matricula,
                c.km_entrada,
                c.local_origem,
                c.local_destino,
                c.data_inspecao,
                c.itens_status
            FROM checklists c
            LEFT JOIN veiculos v ON v.id = c.veiculo_id
            LEFT JOIN funcionarios f ON f.matricula = c.matricula
        `;

        let params = [];

        if (funcionarioMatricula) {
            query += ' WHERE c.matricula = ?';
            params.push(funcionarioMatricula);
        }

        query += ' ORDER BY c.data_inspecao DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        return await conn.query(query, params);
    },

    // A11: detalhe sob demanda — só a imagem de UM checklist, fora dos caminhos de
    // lista. Distingue "checklist inexistente" (null) de "sem imagem" (campo null).
    async findMapaById(conn, id) {
        const query = `SELECT id, mapa_avaria_base64 FROM checklists WHERE id = ? LIMIT 1`;
        const rows = await conn.query(query, [id]);
        return rows[0] || null;
    },
};

module.exports = checklistRepository;
