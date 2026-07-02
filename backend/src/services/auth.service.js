const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const funcionarioRepository = require('../repositories/funcionario.repository');
const { ERROR_CODES } = require('../utils/constants');
const logger = require('../utils/logger');

// Hash bcrypt descartável (cost 10, igual aos hashes reais) usado para igualar o
// tempo de resposta no caminho "usuário inexistente" — evita enumeração de
// matrícula/CPF por timing (M13). Computado uma vez na carga do módulo.
const DUMMY_HASH = bcrypt.hashSync('timing-equalization-dummy', 10);

const authService = {
    /**
     * Realizar login (bcrypt-only).
     *
     * A15: a migração de senhas foi concluída no banco vivo (2026-07-02 — 0 linhas
     * em texto plano) e `createFuncionario` sempre grava bcrypt, então o suporte a
     * texto plano da v2.1 foi removido. Login agora é 100% bcrypt, o que fecha o
     * caveat de timing do M13 (não há mais um caminho de comparação `===` rápido).
     */
    async login(conn, matricula, senha) {
        const funcionario = await funcionarioRepository.findByMatriculaOrCPF(conn, matricula);

        if (!funcionario) {
            // Iguala o tempo de resposta ao do caminho "senha errada" (bcrypt ~100ms),
            // para que um usuário inexistente não retorne mais rápido (M13).
            await bcrypt.compare(senha, DUMMY_HASH);
            throw {
                message: 'Usuário ou senha inválidos',
                code: ERROR_CODES.AUTH_FAILED,
                statusCode: 401
            };
        }

        let senhaValida;
        if (/^\$2[aby]\$/.test(funcionario.senha || '')) {
            senhaValida = await bcrypt.compare(senha, funcionario.senha);
        } else {
            // Senha não-bcrypt no banco: dado inesperado pós-migração (nunca deveria
            // ocorrer). Falha FECHADA — iguala o timing e recusa, sem comparar texto
            // plano. Registra a anomalia para diagnóstico (segurança > LGPD aqui).
            await bcrypt.compare(senha, DUMMY_HASH);
            logger.warn(`[AUTH] senha não-bcrypt no banco para matricula=${funcionario.matricula}; login recusado`);
            senhaValida = false;
        }

        if (!senhaValida) {
            throw { 
                message: 'Usuário ou senha inválidos', 
                code: ERROR_CODES.AUTH_FAILED,
                statusCode: 401
            };
        }

        // Gerar JWT
        const token = jwt.sign(
            {
                matricula: funcionario.matricula,
                nivel_acesso: funcionario.nivel_acesso,
                coligada: funcionario.coligada ?? null
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '2h' }
        );

        return {
            token,
            user: {
                matricula: funcionario.matricula,
                nome: funcionario.nome,
                cpf: funcionario.cpf,
                nivel_acesso: funcionario.nivel_acesso
            }
        };
    },

    /**
     * Criar novo funcionário
     */
    async createFuncionario(conn, data) {
        // Verifica duplicidade
        const exists = await funcionarioRepository.existsByMatriculaOrCPF(conn, data.matricula, data.cpf);
        
        if (exists) {
            throw { 
                message: 'Matrícula ou CPF já cadastrado no sistema', 
                code: ERROR_CODES.DUPLICATE_ENTRY,
                statusCode: 409
            };
        }

        // Hash da senha
        const senha_hash = await bcrypt.hash(data.senha, 10);

        const funcionario = await funcionarioRepository.create(conn, {
            ...data,
            senha_hash
        });

        return {
            matricula: funcionario.matricula,
            nome: funcionario.nome,
            cpf: funcionario.cpf,
            nivel_acesso: funcionario.nivel_acesso
        };
    }
};

module.exports = authService;
