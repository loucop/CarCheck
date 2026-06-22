const correcaoRepository = require('../repositories/correcao.repository');
const veiculoRepository = require('../repositories/veiculo.repository');
const { CORRECTABLE_FIELDS, ERROR_CODES } = require('../utils/constants');

// A7 — caminho de escrita de correção do vistoriador/admin, SEPARADO dos services do
// motorista (checklist.service / bdv.service ficam intocados). O bypass da
// monotonicidade de KM é a *ausência* do guard neste caminho gated por papel, não um
// condicional dentro do caminho guardado. NÃO realinha veiculos.km_atual — isso é a
// fatia 2 (PATCH /correcoes/veiculo/:id/km, §6.2).

// Campos de KM por entidade — quando um deles muda, travamos a linha do veículo
// (FOR UPDATE) dentro da transação para serializar contra a escrita do motorista.
const KM_FIELDS = {
    checklist: ['km_entrada'],
    bdv: ['km_inicial', 'km_final'],
    bdv_parada: ['km']
};

// Snapshot textual p/ a auditoria (e p/ comparar antigo vs. novo). A mesma coluna
// audita número, enum, boolean e JSON — guardamos o literal serializado.
function valorToText(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
}

// Normaliza o valor recebido para a forma persistida na coluna.
function normalizeForStore(campo, valor) {
    if (campo === 'itens_status' && valor !== null && typeof valor === 'object') {
        return JSON.stringify(valor);
    }
    if (campo === 'encerrado_fora_base') {
        return valor ? 1 : 0;
    }
    return valor;
}

// Núcleo compartilhado: valida campos, calcula o diff, trava o veículo se mexer em KM,
// aplica o update e grava a auditoria — tudo na transação aberta pelo chamador.
// Se o INSERT de auditoria falhar, o chamador faz rollback (sem edição silenciosa).
async function aplicarCorrecao(conn, ctx) {
    const { entidade, entidade_id, row, veiculo_id, coligada, campos, motivo, km_override, matricula, updateFn } = ctx;

    const allowed = CORRECTABLE_FIELDS[entidade];

    // Defesa em profundidade: o Zod .strict() já barra chaves desconhecidas, mas o
    // service nunca toca um campo fora da allowlist.
    for (const key of Object.keys(campos)) {
        if (!allowed.includes(key)) {
            throw {
                message: `Campo não corrigível: ${key}`,
                code: ERROR_CODES.VALIDATION_ERROR,
                statusCode: 400
            };
        }
    }

    // Diff por campo: só persiste/audita o que realmente mudou.
    const changed = {};
    const diff = [];
    for (const key of Object.keys(campos)) {
        const novoValor = normalizeForStore(key, campos[key]);
        const antigoTexto = valorToText(row[key]);
        const novoTexto = valorToText(novoValor);
        if (antigoTexto === novoTexto) continue;
        changed[key] = novoValor;
        diff.push({ campo: key, valor_antigo: antigoTexto, valor_novo: novoTexto });
    }

    if (diff.length === 0) {
        throw {
            message: 'Nenhuma alteração detectada nos campos informados',
            code: ERROR_CODES.VALIDATION_ERROR,
            statusCode: 400
        };
    }

    // Trava a linha do veículo quando a correção mexe em KM (mesma disciplina do
    // fluxo do motorista). Não escrevemos km_atual aqui — apenas serializamos.
    const tocaKm = Object.keys(changed).some(k => KM_FIELDS[entidade].includes(k));
    if (tocaKm && veiculo_id != null) {
        await veiculoRepository.findByIdWithLock(conn, veiculo_id);
    }

    await updateFn(conn, changed);

    const correcaoId = await correcaoRepository.insertCorrecao(conn, {
        vistoriador_matricula: matricula,
        entidade,
        entidade_id,
        motivo: motivo ?? null,
        km_override: km_override ? 1 : 0,
        coligada: coligada ?? null
    });

    for (const d of diff) {
        await correcaoRepository.insertCorrecaoCampo(conn, correcaoId, d.campo, d.valor_antigo, d.valor_novo);
    }

    return {
        correcao_id: String(correcaoId),
        entidade,
        entidade_id: String(entidade_id),
        campos_alterados: diff.map(d => d.campo),
        km_override: !!km_override
    };
}

const correcaoService = {
    async corrigirChecklist(conn, id, payload, user) {
        const { motivo, km_override, ...campos } = payload;

        // Fail-fast 404 fora da transação (mesmo padrão de closeBDV).
        const row = await correcaoRepository.findChecklistById(conn, id);
        if (!row) {
            throw {
                message: 'Checklist não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        try {
            await conn.beginTransaction();
            const result = await aplicarCorrecao(conn, {
                entidade: 'checklist',
                entidade_id: id,
                row,
                veiculo_id: row.veiculo_id,
                coligada: user.coligada ?? null,
                campos,
                motivo,
                km_override,
                matricula: user.matricula,
                updateFn: (c, changed) => correcaoRepository.updateChecklist(c, id, changed)
            });
            await conn.commit();
            return result;
        } catch (err) {
            await conn.rollback();
            throw err;
        }
    },

    async corrigirBDV(conn, id, payload, user) {
        const { motivo, km_override, ...campos } = payload;

        const row = await correcaoRepository.findBdvById(conn, id);
        if (!row) {
            throw {
                message: 'BDV não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        try {
            await conn.beginTransaction();
            const result = await aplicarCorrecao(conn, {
                entidade: 'bdv',
                entidade_id: id,
                row,
                veiculo_id: row.veiculo_id,
                coligada: user.coligada ?? null,
                campos,
                motivo,
                km_override,
                matricula: user.matricula,
                updateFn: (c, changed) => correcaoRepository.updateBdv(c, id, changed)
            });
            await conn.commit();
            return result;
        } catch (err) {
            await conn.rollback();
            throw err;
        }
    },

    async corrigirParada(conn, bdv_id, parada_id, payload, user) {
        const { motivo, km_override, ...campos } = payload;

        const row = await correcaoRepository.findParadaById(conn, bdv_id, parada_id);
        if (!row) {
            throw {
                message: 'Parada não encontrada neste BDV',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        try {
            await conn.beginTransaction();
            const result = await aplicarCorrecao(conn, {
                entidade: 'bdv_parada',
                entidade_id: parada_id,
                row,
                veiculo_id: row.veiculo_id,
                coligada: user.coligada ?? null,
                campos,
                motivo,
                km_override,
                matricula: user.matricula,
                updateFn: (c, changed) => correcaoRepository.updateParada(c, bdv_id, parada_id, changed)
            });
            await conn.commit();
            return result;
        } catch (err) {
            await conn.rollback();
            throw err;
        }
    }
};

module.exports = correcaoService;
