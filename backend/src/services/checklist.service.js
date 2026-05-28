const checklistRepository = require('../repositories/checklist.repository');
const veiculoRepository = require('../repositories/veiculo.repository');
const { ERROR_CODES } = require('../utils/constants');

const checklistService = {
    async createChecklist(conn, data) {
        try {
            await conn.beginTransaction();

            console.log('[SERVICE] Iniciando checklist | veiculo_id:', data.veiculo_id, '| matricula:', data.matricula, '| km:', data.km_entrada);

            // 1. Lock no veículo
            const veiculo = await veiculoRepository.findByIdWithLock(conn, data.veiculo_id);

            if (!veiculo) {
                throw {
                    message: 'Veículo não encontrado',
                    code: ERROR_CODES.RESOURCE_NOT_FOUND,
                    statusCode: 404
                };
            }

            // 2. Validação de KM
            const ultimoKm = veiculo.km_atual || 0;
            if (data.km_entrada < ultimoKm) {
                throw {
                    message: `KM inválido: informado (${data.km_entrada}) menor que o último registrado (${ultimoKm})`,
                    code: ERROR_CODES.KM_INVALID,
                    statusCode: 400
                };
            }

            // 3. Serializar itens_status
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
                    console.log('[SERVICE] Base64 aceito, tamanho:', base64Final.length);
                } else {
                    console.warn('[SERVICE] Base64 inválido, descartado');
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

            console.log('[SERVICE] Checklist inserido, ID:', checklistId);

            // 6. Atualizar KM do veículo
            await veiculoRepository.updateKm(conn, data.veiculo_id, data.km_entrada);

            await conn.commit();
            console.log('[SERVICE] Commit OK');

            return {
                id: checklistId,
                veiculo_id: data.veiculo_id,
                km_entrada: data.km_entrada
            };

        } catch (err) {
            await conn.rollback();
            console.error('[SERVICE] Rollback executado. Erro:', err.message || err);
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

    async getRelatorioAdmin(conn, funcionarioMatricula, limit, offset) {
        const relatorios = await checklistRepository.findRelatorio(conn, funcionarioMatricula, limit, offset);

        return relatorios.map(item => ({
            ...item,
            id: String(item.id),
            veiculo_id: String(item.veiculo_id)
        }));
    }
};

module.exports = checklistService;
