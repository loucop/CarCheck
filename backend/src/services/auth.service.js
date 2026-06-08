const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const funcionarioRepository = require('../repositories/funcionario.repository');
const { ERROR_CODES } = require('../utils/constants');

const authService = {
    /**
     * Realizar login
     * Compatível com senhas em texto plano (v2.1) e bcrypt (v3.0)
     */
    async login(conn, matricula, senha) {
        const funcionario = await funcionarioRepository.findByMatriculaOrCPF(conn, matricula);
        
        if (!funcionario) {
            throw { 
                message: 'Usuário ou senha inválidos', 
                code: ERROR_CODES.AUTH_FAILED,
                statusCode: 401
            };
        }

        // Verifica se senha está hasheada (bcrypt começa com $2b$)
        const isHashed = funcionario.senha.startsWith('$2b$');
        
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
                nivel_acesso: funcionario.nivel_acesso 
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
