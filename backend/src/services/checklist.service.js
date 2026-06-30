const checklistRepository = require('../repositories/checklist.repository');
const veiculoRepository = require('../repositories/veiculo.repository');
const { ERROR_CODES } = require('../utils/constants');
const logger = require('../utils/logger');

const checklistService = {
    async createChecklist(conn, data) {
        try {
            await conn.beginTransaction();

            logger.debug('[SERVICE] Iniciando checklist | veiculo_id:', data.veiculo_id, '| matricula:', data.matricula, '| km:', data.km_entrada);

            // 1. Lock no veículo
            const veiculo = await veiculoRepository.findByIdWithLock(conn, data.veiculo_id);

            if (!veiculo) {
                throw {
                    message: 'Veículo não encontrado',
                    code: ERROR_CODES.RESOURCE_NOT_FOUND,
                    statusCode: 404
                };
            }

            // 2. Duplicate submission guard (permanent: one unlinked checklist per day per driver)
            const pendente = await checklistRepository.findPendingTodayByMatricula(conn, data.matricula);
            if (pendente) {
                throw {
                    message: 'Você já possui um checklist pendente para hoje. Finalize o BDV antes de iniciar um novo checklist.',
                    code: ERROR_CODES.DUPLICATE_ENTRY,
                    statusCode: 409
                };
            }

            // 3. Validação de KM
            const ultimoKm = veiculo.km_atual || 0;
            if (data.km_entrada < ultimoKm) {
                throw {
                    message: `KM inválido: informado (${data.km_entrada}) menor que o último registrado (${ultimoKm})`,
                    code: ERROR_CODES.KM_INVALID,
                    statusCode: 400
                };
            }

            // 4. Serializar itens_status
            let itensString;
            if (typeof data.itens_status === 'string') {
                itensString = data.itens_status;
            } else {
                itensString = JSON.stringify(data.itens_status);
            }

            // 4. Validar base64
            let base64Final = null;
            if (data.mapa_avaria_base64) {
                const cleaned = data.mapa_avaria_base64.replace(/\s/g, '');
                if (cleaned.startsWith('data:image/')) {
                    base64Final = cleaned;
                    logger.debug('[SERVICE] Base64 aceito, tamanho:', base64Final.length);
                } else {
                    logger.warn('[SERVICE] Base64 inválido, descartado');
                }
            }

            // 5. Inserir checklist
            const checklistId = await checklistRepository.create(conn, {
                veiculo_id: data.veiculo_id,
                matricula: data.matricula,
                km_entrada: data.km_entrada,
                local_origem: data.local_origem || null,
                local_destino: data.local_destino || null,
                itens_status: itensString,
                mapa_avaria_base64: base64Final
            });

            logger.debug('[SERVICE] Checklist inserido, ID:', checklistId);

            // 6. Atualizar KM do veículo
            await veiculoRepository.updateKm(conn, data.veiculo_id, data.km_entrada);

            await conn.commit();
            logger.debug('[SERVICE] Commit OK');

            return {
                id: checklistId,
                veiculo_id: data.veiculo_id,
                km_entrada: data.km_entrada
            };

        } catch (err) {
            await conn.rollback();
            logger.error('[SERVICE] Rollback executado. Erro:', err.message || err);
            throw err;
        }
    },

    async getHistoricoVeiculo(conn, veiculoId, limit = 50, offset = 0) {
        const veiculo = await veiculoRepository.findById(conn, veiculoId);

        if (!veiculo) {
            throw {
                message: 'Veículo não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        const historico = await checklistRepository.findHistoricoByVeiculo(conn, veiculoId, limit, offset);
        const total = await checklistRepository.countByVeiculo(conn, veiculoId);

        return { veiculo, historico, total, limit, offset };
    },

    // A6: checklist órfão do motorista (hoje, sem BDV vinculado). Espelha
    // getBDVAtivo: 200 com o checklist ou 404 quando não há. Motorista-scoped.
    async getChecklistPendente(conn, matricula) {
        const pendente = await checklistRepository.findPendingDetailTodayByMatricula(conn, matricula);

        if (!pendente) {
            throw {
                message: 'Nenhum checklist pendente para este motorista',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        return {
            ...pendente,
            id: String(pendente.id),
            veiculo_id: String(pendente.veiculo_id)
        };
    },

    async getRelatorioAdmin(conn, funcionarioMatricula, limit, offset) {
        const relatorios = await checklistRepository.findRelatorio(conn, funcionarioMatricula, limit, offset);

        return relatorios.map(item => ({
            ...item,
            id: String(item.id),
            veiculo_id: String(item.veiculo_id)
        }));
    },

    // A11: imagem de avaria de um checklist, buscada sob demanda (não trafega nas
    // listas). 404 quando o checklist não existe; mapa_avaria_base64 pode ser null
    // (checklist sem desenho) — o frontend trata isso como "sem avaria marcada".
    async getMapaChecklist(conn, id) {
        const row = await checklistRepository.findMapaById(conn, id);
        if (!row) {
            throw {
                message: 'Checklist não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }
        return {
            id: String(row.id),
            mapa_avaria_base64: row.mapa_avaria_base64 ?? null
        };
    }
};

module.exports = checklistService;
