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

        // M16: conta desativada (offboarding). Checado DEPOIS da validação da senha,
        // então esta mensagem distinta só é vista por quem já provou a credencial —
        // não vaza estado de conta para quem só chuta senhas.
        if (!funcionario.ativo) {
            throw {
                message: 'Conta desativada. Contate o administrador.',
                code: ERROR_CODES.ACCOUNT_DISABLED,
                statusCode: 403
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
    },

    /**
     * M16: editar funcionário (nome/cpf/nivel/coligada), ativar/desativar e reset
     * de senha. `data` já validado pelo Zod (updateFuncionario). `adminMatricula` é
     * o admin autenticado — usado nos guards anti-lockout.
     */
    async updateFuncionario(conn, matricula, adminMatricula, data) {
        const alvo = await funcionarioRepository.findByMatricula(conn, matricula);
        if (!alvo) {
            throw {
                message: 'Funcionário não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        // Guards anti-lockout: um admin não pode se desativar nem se rebaixar (fecharia
        // a própria porta). Comparação frouxa: matricula pode vir string vs number.
        const ehProprio = String(matricula) === String(adminMatricula);
        if (ehProprio && data.ativo === false) {
            throw {
                message: 'Você não pode desativar a própria conta.',
                code: ERROR_CODES.VALIDATION_ERROR,
                statusCode: 400
            };
        }
        if (ehProprio && data.nivel_acesso !== undefined && data.nivel_acesso !== 'admin') {
            throw {
                message: 'Você não pode rebaixar o próprio nível de acesso.',
                code: ERROR_CODES.VALIDATION_ERROR,
                statusCode: 400
            };
        }

        // CPF não pode colidir com o de outro funcionário.
        if (data.cpf !== undefined && await funcionarioRepository.cpfTakenByOther(conn, data.cpf, matricula)) {
            throw {
                message: 'CPF já cadastrado para outro funcionário',
                code: ERROR_CODES.DUPLICATE_ENTRY,
                statusCode: 409
            };
        }

        // Monta os campos a gravar a partir do que veio (todos opcionais).
        const fields = {};
        if (data.nome !== undefined) fields.nome = data.nome;
        if (data.cpf !== undefined) fields.cpf = data.cpf;
        if (data.nivel_acesso !== undefined) {
            fields.nivel_acesso = data.nivel_acesso;
            // Admin não tem coligada (espelha a regra do cadastro).
            if (data.nivel_acesso === 'admin') fields.coligada = null;
        }
        if (data.coligada !== undefined) fields.coligada = data.coligada;
        if (data.ativo !== undefined) fields.ativo = data.ativo ? 1 : 0;
        if (data.senha !== undefined) fields.senha = await bcrypt.hash(data.senha, 10);

        await funcionarioRepository.update(conn, matricula, fields);

        // Devolve o registro atualizado (sem senha) + quais campos mudaram (p/ auditoria).
        const atualizado = await funcionarioRepository.findByMatricula(conn, matricula);
        return { funcionario: atualizado, camposAlterados: Object.keys(fields) };
    }
};

module.exports = authService;
