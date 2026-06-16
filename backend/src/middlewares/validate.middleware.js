const { z } = require('zod');
const response = require('../utils/response');
const { ERROR_CODES } = require('../utils/constants');

const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        try {
            const validated = schema.parse(req[source]);
            req[source] = validated;
            next();
        } catch (err) {
            if (err instanceof z.ZodError) {
                const errors = err.errors.map(e => ({
                    field: e.path.join('.'),
                    message: e.message
                }));

                console.error('[VALIDATION ERROR]', JSON.stringify(errors));

                return res.status(400).json({
                    success: false,
                    error: 'Dados inválidos',
                    code: ERROR_CODES.VALIDATION_ERROR,
                    fields: errors
                });
            }
            return response.error(res, 'Erro na validação', ERROR_CODES.INTERNAL_ERROR);
        }
    };
};

const schemas = {
    login: z.object({
        matricula: z.string().min(1, 'Matrícula obrigatória').max(20),
        senha: z.string().min(1, 'Senha obrigatória').max(128)
    }),

    createFuncionario: z.object({
        matricula: z.string().min(1, 'Matrícula obrigatória').max(20),
        nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(120),
        cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos'),
        senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(128),
        nivel_acesso: z.enum(['admin', 'vistoriador', 'motorista'], {
            errorMap: () => ({ message: "Nível de acesso deve ser 'admin', 'vistoriador' ou 'motorista'" })
        }),
        coligada: z.enum(['angels', 'cemax']).optional().nullable()
    }),

    // A3: a matrícula NÃO vem do corpo — é derivada do JWT (req.user) no controller.
    // Qualquer `matricula` enviada no body é ignorada (z.object remove chaves desconhecidas).
    createChecklist: z.object({
        veiculo_id: z.coerce.number().int().positive('ID do veículo inválido'),
        km_entrada: z.coerce.number().nonnegative('KM não pode ser negativo'),
        local_origem: z.string().max(200).optional().nullable(),
        local_destino: z.string().max(200).optional().nullable(),
        itens_status: z.union([
            // A4-H2: cap no branch string. O branch z.record fica SEM cap de tamanho —
            // validar a forma { item: { status, obs } } está deferido ao A4-M1.
            z.string().min(1).max(20000),
            z.record(z.any())
        ]),
        mapa_avaria_base64: z.string().max(500000).optional()
    }),

    historicoVeiculo: z.object({
        id: z.coerce.number().int().positive('ID do veículo inválido')
    }),

    relatorioAdmin: z.object({
        funcionario_id: z.string().max(20).optional(),
        limit: z.coerce.number().int().positive().max(500).default(100),
        offset: z.coerce.number().int().nonnegative().default(0)
    }),

    // BDV schemas
    openBDV: z.object({
        veiculo_id: z.coerce.number().int().positive('ID do veículo inválido'),
        coligada: z.enum(['angels', 'cemax']),
        km_inicial: z.coerce.number().nonnegative('KM não pode ser negativo')
    }),

    addParada: z.object({
        local_saida: z.string().min(1).max(200),
        hora_saida: z.string().max(32),
        km: z.coerce.number().nonnegative().optional().nullable(),
        local_chegada: z.string().max(200).optional().nullable(),
        observacao: z.string().max(1000).optional().nullable()
    }),

    closeParada: z.object({
        local_chegada: z.string().min(1).max(200),
        hora_chegada: z.string().max(32),
        km: z.coerce.number().nonnegative().optional().nullable(),
        observacao: z.string().max(1000).optional().nullable()
    }),

    closeBDV: z.object({
        km_final: z.coerce.number().nonnegative('KM final inválido'),
        combustivel_retorno: z.string().min(1, 'Combustível de retorno obrigatório').max(50),
        encerrado_fora_base: z.boolean().default(false)
    }),

    bdvParams: z.object({
        id: z.coerce.number().int().positive('ID do BDV inválido')
    }),

    paradaParams: z.object({
        id: z.coerce.number().int().positive('ID do BDV inválido'),
        paradaId: z.coerce.number().int().positive('ID da parada inválido')
    }),

    relatorioBDV: z.object({
        matricula: z.string().max(20).optional(),
        veiculo_id: z.coerce.number().int().positive().optional(),
        coligada: z.string().max(20).optional(),
        status: z.enum(['aberto', 'encerrado']).optional(),
        data_inicio: z.string().max(32).optional(),
        data_fim: z.string().max(32).optional(),
        limit: z.coerce.number().int().positive().max(500).default(100),
        offset: z.coerce.number().int().nonnegative().default(0)
    })
};

module.exports = { validate, schemas };
