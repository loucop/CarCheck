const bdvRepository = {
    async findActiveBDVByMatricula(conn, matricula) {
        const query = `
            SELECT id, veiculo_id, matricula, coligada, status, data_abertura, km_inicial
            FROM bdv
            WHERE matricula = ? AND status = 'aberto'
            LIMIT 1
        `;
        const rows = await conn.query(query, [matricula]);
        return rows[0] || null;
    },

    async findActiveBDVByVeiculoId(conn, veiculo_id) {
        const query = `
            SELECT id, veiculo_id, matricula, coligada, status, data_abertura, km_inicial
            FROM bdv
            WHERE veiculo_id = ? AND status = 'aberto'
            LIMIT 1
        `;
        const rows = await conn.query(query, [veiculo_id]);
        return rows[0] || null;
    },

    async createBDV(conn, data) {
        const query = `
            INSERT INTO bdv (matricula, veiculo_id, coligada, km_inicial, checklist_id, data_abertura, status)
            VALUES (?, ?, ?, ?, ?, NOW(), 'aberto')
        `;
        const result = await conn.query(query, [
            data.matricula,
            data.veiculo_id,
            data.coligada,
            data.km_inicial,
            data.checklist_id ?? null
        ]);
        return result.insertId;
    },

    async addParada(conn, bdv_id, data) {
        const query = `
            INSERT INTO bdv_paradas (bdv_id, local_saida, hora_saida, km, local_chegada, observacao)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const result = await conn.query(query, [
            bdv_id,
            data.local_saida,
            data.hora_saida,
            data.km ?? null,
            data.local_chegada ?? null,
            data.observacao ?? null
        ]);
        return result.insertId;
    },

    // bdv_id included in WHERE to prevent cross-BDV updates
    async closeParada(conn, bdv_id, parada_id, data) {
        const query = `
            UPDATE bdv_paradas
            SET local_chegada = ?, hora_chegada = ?, km = ?, observacao = ?
            WHERE id = ? AND bdv_id = ?
        `;
        const result = await conn.query(query, [
            data.local_chegada,
            data.hora_chegada,
            data.km ?? null,
            data.observacao ?? null,
            parada_id,
            bdv_id
        ]);
        return result.affectedRows;
    },

    async closeBDV(conn, bdv_id, data) {
        const query = `
            UPDATE bdv
            SET km_final             = ?,
                combustivel_retorno  = ?,
                status               = 'encerrado',
                data_encerramento    = NOW(),
                encerrado_fora_base  = ?
            WHERE id = ?
        `;
        const result = await conn.query(query, [
            data.km_final,
            data.combustivel_retorno,
            data.encerrado_fora_base ? 1 : 0,
            bdv_id
        ]);
        return result.affectedRows;
    },

    async findBDVById(conn, id) {
        const bdvQuery = `
            SELECT
                b.id,
                b.matricula,
                b.veiculo_id,
                b.coligada,
                b.km_inicial,
                b.km_final,
                b.combustivel_retorno,
                b.status,
                b.data_abertura,
                b.data_encerramento,
                b.encerrado_fora_base,
                f.nome  AS motorista,
                v.placa,
                v.modelo
            FROM bdv b
            LEFT JOIN funcionarios  f ON f.matricula = b.matricula
            LEFT JOIN veiculos      v ON v.id        = b.veiculo_id
            WHERE b.id = ?
            LIMIT 1
        `;

        const paradasQuery = `
            SELECT id, local_saida, hora_saida, local_chegada, hora_chegada, km, observacao
            FROM bdv_paradas
            WHERE bdv_id = ?
            ORDER BY id ASC
        `;

        const bdvRows = await conn.query(bdvQuery, [id]);
        if (!bdvRows[0]) return null;

        const paradas = await conn.query(paradasQuery, [id]);

        return { ...bdvRows[0], paradas };
    },

    // Lean row-lock on the bdv row for transactional re-validation (M10).
    // No JOINs/paradas: locks ONLY the bdv row, not funcionarios/veiculos.
    // Must run inside an open transaction for the lock to be held.
    async findBDVByIdForUpdate(conn, id) {
        const rows = await conn.query(
            `SELECT id, matricula, veiculo_id, km_inicial, status
             FROM bdv
             WHERE id = ?
             FOR UPDATE`,
            [id]
        );
        return rows[0] || null;
    },

    async findLastParada(conn, bdv_id) {
        const rows = await conn.query(
            'SELECT km FROM bdv_paradas WHERE bdv_id = ? ORDER BY id DESC LIMIT 1',
            [bdv_id]
        );
        return rows[0] || null;
    },

    async findMaxParadaKm(conn, bdv_id) {
        const rows = await conn.query(
            'SELECT MAX(km) AS max_km FROM bdv_paradas WHERE bdv_id = ?',
            [bdv_id]
        );
        return rows[0]?.max_km ?? null;
    },

    async findAllBDV(conn, filters = {}) {
        let query = `
            SELECT
                b.id,
                b.matricula,
                b.veiculo_id,
                b.coligada,
                b.km_inicial,
                b.km_final,
                b.combustivel_retorno,
                b.status,
                b.data_abertura,
                b.data_encerramento,
                b.encerrado_fora_base,
                f.nome  AS motorista,
                v.placa,
                v.modelo
            FROM bdv b
            LEFT JOIN funcionarios  f ON f.matricula = b.matricula
            LEFT JOIN veiculos      v ON v.id        = b.veiculo_id
        `;

        const conditions = [];
        const params = [];

        if (filters.matricula) {
            conditions.push('b.matricula = ?');
            params.push(filters.matricula);
        }

        if (filters.veiculo_id) {
            conditions.push('b.veiculo_id = ?');
            params.push(filters.veiculo_id);
        }

        if (filters.coligada) {
            conditions.push('b.coligada = ?');
            params.push(filters.coligada);
        }

        if (filters.status) {
            conditions.push('b.status = ?');
            params.push(filters.status);
        }

        if (filters.data_inicio) {
            conditions.push('b.data_abertura >= ?');
            params.push(filters.data_inicio);
        }

        if (filters.data_fim) {
            conditions.push('b.data_abertura <= ?');
            params.push(filters.data_fim);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY b.data_abertura DESC';

        if (filters.limit) {
            query += ' LIMIT ?';
            params.push(Number(filters.limit));
        }

        if (filters.limit && filters.offset) {
            query += ' OFFSET ?';
            params.push(Number(filters.offset));
        }

        return await conn.query(query, params);
    }
};

module.exports = bdvRepository;
