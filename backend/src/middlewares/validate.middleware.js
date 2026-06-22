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

// A4-M2: data-URI base64 de imagem (mesmo formato exigido no render do admin, admin.js).
const IMAGE_DATA_URI_RE = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

// A4-M3: data ('YYYY-MM-DD', input type=date) ou data-hora
// ('YYYY-MM-DDTHH:mm[:ss][.fff][Z|±hh:mm]', input datetime-local / ISO 8601).
// Separador T ou espaço; segundos, frações e timezone são opcionais — lenient o
// suficiente para o que o frontend envia hoje (ex.: '2026-06-17T14:30', '2026-06-17').
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

// A7: refinements compartilhados pelos schemas de correção.
// (a) pelo menos um campo corrigível presente; (b) motivo obrigatório quando
// km_override=1 (§6.3). `motivo`/`km_override` são de controle, não contam como campo.
const temAlgumCampo = (campos) => (data) => campos.some(c => data[c] !== undefined);
const motivoSeOverride = (data) =>
    !data.km_override || (typeof data.motivo === 'string' && data.motivo.trim().length > 0);

const schemas = {
    login: z.object({
        matricula: z.string().min(1, 'Matrícula obrigatória').max(20),
        senha: z.string().min(1, 'Senha obrigatória').max(128)
    }).strict(),

    createFuncionario: z.object({
        matricula: z.string().min(1, 'Matrícula obrigatória').max(20),
        nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(120),
        cpf: z.string().regex(/^\d{11}$/, 'CPF deve conter 11 dígitos'),
        senha: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').max(128),
        nivel_acesso: z.enum(['admin', 'vistoriador', 'motorista'], {
            errorMap: () => ({ message: "Nível de acesso deve ser 'admin', 'vistoriador' ou 'motorista'" })
        }),
        coligada: z.enum(['angels', 'cemax']).optional().nullable()
    }).strict(),

    // A3: a matrícula NÃO vem do corpo — é derivada do JWT (req.user) no controller.
    // Qualquer `matricula` enviada no body é ignorada (z.object remove chaves desconhecidas).
    // A4-L1: este schema NÃO pode ser .strict() — o frontend envia `matricula` no body
    // (checklist.js) e a correção do A3 depende do Zod DESCARTAR essa chave em silêncio.
    // .strict() passaria essas requisições a 400. Manter não-strict de propósito.
    createChecklist: z.object({
        veiculo_id: z.coerce.number().int().positive('ID do veículo inválido'),
        km_entrada: z.coerce.number().nonnegative('KM não pode ser negativo'),
        local_origem: z.string().max(200).optional().nullable(),
        local_destino: z.string().max(200).optional().nullable(),
        itens_status: z.union([
            // A4-H2: cap no branch string.
            z.string().min(1).max(20000),
            // A4-M1: forma esperada { [item]: { status, obs } }. Permissivo nas CHAVES
            // (z.record aceita qualquer nome de item) e no valor de status (string, não
            // enum — não rejeita variações legadas); `obs` é string opcional. O z.object
            // interno é não-strict de propósito → tolera chaves extras de dados existentes.
            z.record(z.object({
                status: z.string(),
                obs: z.string().optional()
            }))
        ]),
        // A4-M2: exige data-URI de imagem (png/jpeg). Mantém cap e opcionalidade do A4-H2.
        mapa_avaria_base64: z.string().max(500000).regex(IMAGE_DATA_URI_RE, 'Formato de imagem inválido (esperado data:image/png|jpeg;base64,...)').optional()
    }),

    historicoVeiculo: z.object({
        id: z.coerce.number().int().positive('ID do veículo inválido')
    }).strict(),

    // A4-L1: schema de QUERY — não-strict de propósito. Query strings frequentemente
    // carregam parâmetros avulsos (cache-buster, paginação de UI); .strict() os
    // transformaria em 400. Chaves desconhecidas são descartadas.
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
    }).strict(),

    addParada: z.object({
        local_saida: z.string().min(1).max(200),
        // A4-M3: data-hora ISO/datetime-local; .max(32) mantido como teto.
        hora_saida: z.string().max(32).regex(DATETIME_RE, 'Data/hora inválida'),
        km: z.coerce.number().nonnegative().optional().nullable(),
        local_chegada: z.string().max(200).optional().nullable(),
        observacao: z.string().max(1000).optional().nullable()
    }).strict(),

    closeParada: z.object({
        local_chegada: z.string().min(1).max(200),
        // A4-M3: data-hora ISO/datetime-local; .max(32) mantido como teto.
        hora_chegada: z.string().max(32).regex(DATETIME_RE, 'Data/hora inválida'),
        km: z.coerce.number().nonnegative().optional().nullable(),
        observacao: z.string().max(1000).optional().nullable()
    }).strict(),

    closeBDV: z.object({
        km_final: z.coerce.number().nonnegative('KM final inválido'),
        combustivel_retorno: z.string().min(1, 'Combustível de retorno obrigatório').max(50),
        encerrado_fora_base: z.boolean().default(false)
    }).strict(),

    bdvParams: z.object({
        id: z.coerce.number().int().positive('ID do BDV inválido')
    }).strict(),

    paradaParams: z.object({
        id: z.coerce.number().int().positive('ID do BDV inválido'),
        paradaId: z.coerce.number().int().positive('ID da parada inválido')
    }).strict(),

    // ==========================================
    // A7 — Schemas de correção (vistoriador/admin)
    // ==========================================

    // Params de :id para /correcoes/checklist/:id e /correcoes/bdv/:id.
    // (Paradas reusam `paradaParams` acima — { id, paradaId }.)
    correcaoParams: z.object({
        id: z.coerce.number().int().positive('ID inválido')
    }).strict(),

    // Corpo da correção de checklist. Todos os campos corrigíveis são opcionais
    // (correção parcial); o refine exige ao menos um. Mesmos contratos de tipo do
    // createChecklist (itens_status, mapa_avaria_base64), sem o guard de KM.
    correcaoChecklist: z.object({
        km_entrada: z.coerce.number().nonnegative('KM não pode ser negativo').optional(),
        itens_status: z.union([
            z.string().min(1).max(20000),
            z.record(z.object({
                status: z.string(),
                obs: z.string().optional()
            }))
        ]).optional(),
        local_origem: z.string().max(200).optional().nullable(),
        local_destino: z.string().max(200).optional().nullable(),
        mapa_avaria_base64: z.string().max(500000).regex(IMAGE_DATA_URI_RE, 'Formato de imagem inválido (esperado data:image/png|jpeg;base64,...)').optional(),
        motivo: z.string().max(500).optional(),
        km_override: z.boolean().default(false)
    }).strict()
        .refine(temAlgumCampo(['km_entrada', 'itens_status', 'local_origem', 'local_destino', 'mapa_avaria_base64']), {
            message: 'Informe ao menos um campo para corrigir'
        })
        .refine(motivoSeOverride, { message: 'Motivo é obrigatório quando km_override está ativo', path: ['motivo'] }),

    correcaoBDV: z.object({
        km_inicial: z.coerce.number().nonnegative('KM não pode ser negativo').optional(),
        km_final: z.coerce.number().nonnegative('KM final inválido').optional(),
        combustivel_retorno: z.string().min(1).max(50).optional(),
        coligada: z.enum(['angels', 'cemax']).optional(),
        encerrado_fora_base: z.boolean().optional(),
        motivo: z.string().max(500).optional(),
        km_override: z.boolean().default(false)
    }).strict()
        .refine(temAlgumCampo(['km_inicial', 'km_final', 'combustivel_retorno', 'coligada', 'encerrado_fora_base']), {
            message: 'Informe ao menos um campo para corrigir'
        })
        .refine(motivoSeOverride, { message: 'Motivo é obrigatório quando km_override está ativo', path: ['motivo'] }),

    correcaoParada: z.object({
        km: z.coerce.number().nonnegative().optional(),
        hora_saida: z.string().max(32).regex(DATETIME_RE, 'Data/hora inválida').optional(),
        hora_chegada: z.string().max(32).regex(DATETIME_RE, 'Data/hora inválida').optional(),
        local_saida: z.string().min(1).max(200).optional(),
        local_chegada: z.string().max(200).optional().nullable(),
        observacao: z.string().max(1000).optional().nullable(),
        motivo: z.string().max(500).optional(),
        km_override: z.boolean().default(false)
    }).strict()
        .refine(temAlgumCampo(['km', 'hora_saida', 'hora_chegada', 'local_saida', 'local_chegada', 'observacao']), {
            message: 'Informe ao menos um campo para corrigir'
        })
        .refine(motivoSeOverride, { message: 'Motivo é obrigatório quando km_override está ativo', path: ['motivo'] }),

    // A4-L1: schema de QUERY — não-strict de propósito (parâmetros avulsos na query string).
    relatorioBDV: z.object({
        matricula: z.string().max(20).optional(),
        veiculo_id: z.coerce.number().int().positive().optional(),
        // A4-M4: mesmo enum de createFuncionario/openBDV; .optional() porque é filtro.
        coligada: z.enum(['angels', 'cemax']).optional(),
        status: z.enum(['aberto', 'encerrado']).optional(),
        // A4-M3: data ISO ('YYYY-MM-DD' do input type=date); .max(32) mantido como teto.
        data_inicio: z.string().max(32).regex(DATETIME_RE, 'Data inicial inválida').optional(),
        data_fim: z.string().max(32).regex(DATETIME_RE, 'Data final inválida').optional(),
        limit: z.coerce.number().int().positive().max(500).default(100),
        offset: z.coerce.number().int().nonnegative().default(0)
    })
};

module.exports = { validate, schemas };
