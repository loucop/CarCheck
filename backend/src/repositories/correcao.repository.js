const { CORRECTABLE_FIELDS } = require('../utils/constants');

// A7: monta o SET dinâmico apenas a partir de colunas na allowlist (constants).
// Nomes de coluna são interpolados na string SQL — filtrar contra a allowlist é o
// que torna isso seguro contra injeção; o service já valida as chaves, isto é a
// segunda barreira na única camada que escreve SQL.
function buildSet(campos, allowed) {
    const keys = Object.keys(campos).filter(k => allowed.includes(k));
    const clause = keys.map(k => `${k} = ?`).join(', ');
    const params = keys.map(k => campos[k]);
    return { clause, params };
}

const correcaoRepository = {
    // ----- Leitura das entidades corrigíveis (snapshot p/ valor_antigo) -----

    async findChecklistById(conn, id) {
        const query = `
            SELECT id, veiculo_id, km_entrada, local_origem, local_destino,
                   itens_status, mapa_avaria_base64
            FROM checklists
            WHERE id = ?
            LIMIT 1
        `;
        const rows = await conn.query(query, [id]);
        return rows[0] || null;
    },

    async findBdvById(conn, id) {
        const query = `
            SELECT id, veiculo_id, coligada, km_inicial, km_final,
                   combustivel_retorno, encerrado_fora_base, status
            FROM bdv
            WHERE id = ?
            LIMIT 1
        `;
        const rows = await conn.query(query, [id]);
        return rows[0] || null;
    },

    async findVeiculoById(conn, id) {
        const rows = await conn.query(
            'SELECT id, km_atual FROM veiculos WHERE id = ? LIMIT 1',
            [id]
        );
        return rows[0] || null;
    },

    // Junta o BDV para trazer veiculo_id (lock de KM) e coligada (header de auditoria).
    async findParadaById(conn, bdv_id, parada_id) {
        const query = `
            SELECT p.id, p.bdv_id, p.km, p.hora_saida, p.hora_chegada,
                   p.local_saida, p.local_chegada, p.observacao,
                   b.veiculo_id, b.coligada
            FROM bdv_paradas p
            JOIN bdv b ON b.id = p.bdv_id
            WHERE p.id = ? AND p.bdv_id = ?
            LIMIT 1
        `;
        const rows = await conn.query(query, [parada_id, bdv_id]);
        return rows[0] || null;
    },

    // ----- Updates de correção (SET dinâmico, somente colunas na allowlist) -----

    async updateChecklist(conn, id, campos) {
        const { clause, params } = buildSet(campos, CORRECTABLE_FIELDS.checklist);
        if (!clause) return 0;
        const result = await conn.query(
            `UPDATE checklists SET ${clause} WHERE id = ?`,
            [...params, id]
        );
        return result.affectedRows;
    },

    async updateBdv(conn, id, campos) {
        const { clause, params } = buildSet(campos, CORRECTABLE_FIELDS.bdv);
        if (!clause) return 0;
        const result = await conn.query(
            `UPDATE bdv SET ${clause} WHERE id = ?`,
            [...params, id]
        );
        return result.affectedRows;
    },

    // bdv_id no WHERE impede update cross-BDV (mesma disciplina do closeParada).
    async updateParada(conn, bdv_id, parada_id, campos) {
        const { clause, params } = buildSet(campos, CORRECTABLE_FIELDS.bdv_parada);
        if (!clause) return 0;
        const result = await conn.query(
            `UPDATE bdv_paradas SET ${clause} WHERE id = ? AND bdv_id = ?`,
            [...params, parada_id, bdv_id]
        );
        return result.affectedRows;
    },

    async updateKmVeiculo(conn, id, km_atual) {
        const result = await conn.query(
            'UPDATE veiculos SET km_atual = ? WHERE id = ?',
            [km_atual, id]
        );
        return result.affectedRows;
    },

    // ----- Trilha de auditoria (append-only) -----

    async insertCorrecao(conn, header) {
        const query = `
            INSERT INTO correcoes
                (vistoriador_matricula, entidade, entidade_id, motivo, km_override, coligada)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const result = await conn.query(query, [
            header.vistoriador_matricula,
            header.entidade,
            header.entidade_id,
            header.motivo,
            header.km_override,
            header.coligada
        ]);
        return result.insertId;
    },

    async insertCorrecaoCampo(conn, correcao_id, campo, valor_antigo, valor_novo) {
        const query = `
            INSERT INTO correcoes_campos
                (correcao_id, campo, valor_antigo, valor_novo)
            VALUES (?, ?, ?, ?)
        `;
        const result = await conn.query(query, [correcao_id, campo, valor_antigo, valor_novo]);
        return result.insertId;
    }
};

module.exports = correcaoRepository;
