/**
 * Repository: Funcionários
 * Schema Real: matricula (PK), nome, cpf, nivel_acesso, senha, coligada, ativo
 * (M16: coluna `ativo` TINYINT(1) NOT NULL DEFAULT 1 — ciclo de vida do funcionário.)
 */

// M16: colunas que o admin pode editar via UPDATE. Whitelist — única camada que
// interpola nome de coluna em SQL (mesma disciplina do correcao.repository). `senha`
// chega já hasheada do service; `matricula` NÃO está aqui (é PK + alvo de FK,
// imutável por design).
const UPDATABLE_FIELDS = ['nome', 'cpf', 'nivel_acesso', 'coligada', 'ativo', 'senha'];

const funcionarioRepository = {
    /**
     * Buscar funcionário por matrícula ou CPF
     */
    async findByMatriculaOrCPF(conn, matricula) {
        const query = `
            SELECT matricula, nome, cpf, nivel_acesso, senha, coligada, ativo
            FROM funcionarios
            WHERE (matricula = ? OR cpf = ?)
            LIMIT 1
        `;
        const rows = await conn.query(query, [matricula, matricula]);
        return rows[0] || null;
    },

    /**
     * Buscar funcionário por matrícula (sem a senha)
     */
    async findByMatricula(conn, matricula) {
        const query = `
            SELECT matricula, nome, cpf, nivel_acesso, coligada, ativo
            FROM funcionarios
            WHERE matricula = ?
            LIMIT 1
        `;
        const rows = await conn.query(query, [matricula]);
        return rows[0] || null;
    },

    /**
     * Listar todos os funcionários
     */
    async findAll(conn) {
        const query = `
            SELECT matricula, nome, cpf, nivel_acesso, coligada, ativo
            FROM funcionarios
            ORDER BY nome
        `;
        return await conn.query(query);
    },

    /**
     * Criar novo funcionário
     */
    async create(conn, data) {
        const query = `
            INSERT INTO funcionarios (matricula, nome, cpf, senha, nivel_acesso, coligada)
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        await conn.query(query, [
            data.matricula,
            data.nome,
            data.cpf,
            data.senha_hash,
            data.nivel_acesso,
            data.coligada ?? null
        ]);
        return data;
    },

    /**
     * M16: atualizar campos de um funcionário. `fields` já validado/normalizado
     * pelo service (senha hasheada, ativo em 0/1). Só colunas da whitelist são
     * interpoladas; retorna o número de linhas afetadas.
     */
    async update(conn, matricula, fields) {
        const cols = Object.keys(fields).filter((k) => UPDATABLE_FIELDS.includes(k));
        if (cols.length === 0) return 0;

        const setClause = cols.map((c) => `${c} = ?`).join(', ');
        const values = cols.map((c) => fields[c]);
        values.push(matricula);

        const result = await conn.query(
            `UPDATE funcionarios SET ${setClause} WHERE matricula = ?`,
            values
        );
        return result.affectedRows;
    },

    /**
     * Verificar se matrícula ou CPF já existe
     */
    async existsByMatriculaOrCPF(conn, matricula, cpf) {
        const query = `
            SELECT matricula
            FROM funcionarios
            WHERE matricula = ? OR cpf = ?
            LIMIT 1
        `;
        const rows = await conn.query(query, [matricula, cpf]);
        return rows.length > 0;
    },

    /**
     * M16: CPF já usado por OUTRO funcionário (para editar sem colidir).
     */
    async cpfTakenByOther(conn, cpf, matricula) {
        const rows = await conn.query(
            'SELECT matricula FROM funcionarios WHERE cpf = ? AND matricula <> ? LIMIT 1',
            [cpf, matricula]
        );
        return rows.length > 0;
    }
};

module.exports = funcionarioRepository;
