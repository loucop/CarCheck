const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const funcionarioRepository = require('../repositories/funcionario.repository');
const { ERROR_CODES } = require('../utils/constants');

// Hash bcrypt descartável (cost 10, igual aos hashes reais) usado para igualar o
// tempo de resposta no caminho "usuário inexistente" — evita enumeração de
// matrícula/CPF por timing (M13). Computado uma vez na carga do módulo.
const DUMMY_HASH = bcrypt.hashSync('timing-equalization-dummy', 10);

const authService = {
    /**
     * Realizar login
     * Compatível com senhas em texto plano (v2.1) e bcrypt (v3.0)
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

        // Verifica se senha está hasheada (bcrypt: $2a$ / $2b$ / $2y$)
        const isHashed = /^\$2[aby]\$/.test(funcionario.senha);
        
        let senhaValida;
        if (isHashed) {
            // Senha já está em bcrypt
            senhaValida = await bcrypt.compare(senha, funcionario.senha);
        } else {
            // Senha ainda em texto plano (compatibilidade v2.1)
            senhaValida = senha === funcionario.senha;
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
            { expiresIn: process.env.JWT_EXPIRES_IN || '12h' }
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
