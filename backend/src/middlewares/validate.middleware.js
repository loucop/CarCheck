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
        matricula: z.string().min(1, 'Matrícula obrigatória'),
        senha: z.string().min(1, 'Senha obrigatória')
    }),

    createFuncionario: z.object({
        matricula: z.string().min(1, 'Matrícula obrigatória'),
        nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
        cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos'),
        senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
        nivel_acesso: z.enum(['admin', 'vistoriador', 'motorista'], {
            errorMap: () => ({ message: "Nível de acesso deve ser 'admin', 'vistoriador' ou 'motorista'" })
        })
    }),

    // matricula usa coerce para aceitar número ou string (ex: matricula = 3)
    createChecklist: z.object({
        veiculo_id: z.coerce.number().int().positive('ID do veículo inválido'),
        matricula: z.coerce.string().min(1, 'Matrícula obrigatória'),
        km_entrada: z.coerce.number().nonnegative('KM não pode ser negativo'),
        local_origem: z.string().optional().nullable(),
        local_destino: z.string().optional().nullable(),
        itens_status: z.union([
            z.string().min(1),
            z.record(z.any())
        ]),
        mapa_avaria_base64: z.string().optional()
    }),

    historicoVeiculo: z.object({
        id: z.coerce.number().int().positive('ID do veículo inválido')
    }),

    relatorioAdmin: z.object({
        funcionario_id: z.string().optional(),
        limit: z.coerce.number().int().positive().max(500).default(100),
        offset: z.coerce.number().int().nonnegative().default(0)
    }),

    // BDV schemas
    openBDV: z.object({
        veiculo_id: z.coerce.number().int().positive('ID do veículo inválido'),
        coligada: z.enum(['angels', 'cemax']),
        km_inicial: z.coerce.number().nonnegative('KM não pode ser negativo'),
        combustivel_saida: z.string().min(1, 'Combustível de saída obrigatório')
    }),

    addParada: z.object({
        local_saida: z.string().min(1),
        hora_saida: z.string(),
        local_chegada: z.string().optional().nullable(),
        observacao: z.string().optional().nullable()
    }),

    closeParada: z.object({
        local_chegada: z.string().min(1),
        hora_chegada: z.string(),
        km: z.coerce.number().nonnegative().optional().nullable(),
        observacao: z.string().optional().nullable()
    }),

    closeBDV: z.object({
        km_final: z.coerce.number().nonnegative('KM final inválido'),
        combustivel_retorno: z.string().min(1, 'Combustível de retorno obrigatório'),
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
        matricula: z.string().optional(),
        veiculo_id: z.coerce.number().int().positive().optional(),
        coligada: z.string().optional(),
        data_inicio: z.string().optional(),
        data_fim: z.string().optional(),
        limit: z.coerce.number().int().positive().max(500).default(100),
        offset: z.coerce.number().int().nonnegative().default(0)
    })
};

module.exports = { validate, schemas };
