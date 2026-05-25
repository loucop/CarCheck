/**
 * Repository: Funcionários
 * Schema Real: matricula (PK), nome, cpf, nivel_acesso, senha
 */

const funcionarioRepository = {
    /**
     * Buscar funcionário por matrícula ou CPF
     */
    async findByMatriculaOrCPF(conn, matricula) {
        const query = `
            SELECT matricula, nome, cpf, nivel_acesso, senha 
            FROM funcionarios 
            WHERE (matricula = ? OR cpf = ?) 
            LIMIT 1
        `;
        const rows = await conn.query(query, [matricula, matricula]);
        return rows[0] || null;
    },

    /**
     * Buscar funcionário por matrícula
     */
    async findByMatricula(conn, matricula) {
        const query = `
            SELECT matricula, nome, cpf, nivel_acesso 
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
            SELECT matricula, nome, cpf, nivel_acesso 
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
            INSERT INTO funcionarios (matricula, nome, cpf, senha, nivel_acesso) 
            VALUES (?, ?, ?, ?, ?)
        `;
        await conn.query(query, [
            data.matricula,
            data.nome,
            data.cpf,
            data.senha_hash,
            data.nivel_acesso
        ]);
        return data;
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
    }
};

module.exports = funcionarioRepository;
