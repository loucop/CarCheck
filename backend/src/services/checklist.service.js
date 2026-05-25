const checklistRepository = require('../repositories/checklist.repository');
const veiculoRepository = require('../repositories/veiculo.repository');
const { ERROR_CODES } = require('../utils/constants');

const checklistService = {
    /**
     * Criar novo checklist (TRANSACIONAL)
     * Mantém compatibilidade com Base64 no banco
     */
    async createChecklist(conn, data) {
        try {
            // Inicia transação
            await conn.beginTransaction();

            // 1. Busca veículo com lock pessimista (FOR UPDATE)
            const veiculo = await veiculoRepository.findByIdWithLock(conn, data.veiculo_id);
            
            if (!veiculo) {
                throw { 
                    message: 'Veículo não encontrado', 
                    code: ERROR_CODES.RESOURCE_NOT_FOUND,
                    statusCode: 404
                };
            }

            // 2. Validação de KM (CRÍTICO - evita fraude)
            const ultimoKm = veiculo.km_atual || 0;
            if (data.km_entrada < ultimoKm) {
                throw { 
                    message: `KM inválido: o valor informado (${data.km_entrada}) é menor que o último registrado (${ultimoKm})`,
                    code: ERROR_CODES.KM_INVALID,
                    statusCode: 400
                };
            }

            // 3. Preparar itens_status (JSON string)
            const itensString = typeof data.itens_status === 'string' 
                ? data.itens_status 
                : JSON.stringify(data.itens_status);

            // 4. Validar Base64 (evita truncamento)
            let base64Final = null;
            if (data.mapa_avaria_base64) {
                // Remove possíveis espaços/quebras que causam corrupção
                base64Final = data.mapa_avaria_base64.replace(/\s/g, '');
                
                // Valida formato básico
                if (!base64Final.startsWith('data:image/')) {
                    console.warn('[WARN] Base64 inválido detectado, ignorando imagem');
                    base64Final = null;
                }
            }

            // 5. Criar checklist
            const checklistId = await checklistRepository.create(conn, {
                veiculo_id: data.veiculo_id,
                matricula: data.matricula,
                km_entrada: data.km_entrada,
                local_origem: data.local_origem || null,
                local_destino: data.local_destino || null,
                itens_status: itensString,
                mapa_avaria_base64: base64Final
            });

            // 6. Atualizar KM do veículo
            await veiculoRepository.updateKm(conn, data.veiculo_id, data.km_entrada);

            // Commit da transação
            await conn.commit();

            return {
                id: checklistId,
                veiculo_id: data.veiculo_id,
                km_entrada: data.km_entrada
            };

        } catch (err) {
            // Rollback em caso de erro
            await conn.rollback();
            throw err;
        }
    },

    /**
     * Buscar histórico de veículo
     */
    async getHistoricoVeiculo(conn, veiculoId, limit = 50, offset = 0) {
        const veiculo = await veiculoRepository.findById(conn, veiculoId);
        
        if (!veiculo) {
            throw { 
                message: 'Veículo não encontrado', 
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        const historico = await checklistRepository.findHistoricoByVeiculo(
            conn, 
            veiculoId, 
            limit, 
            offset
        );

        const total = await checklistRepository.countByVeiculo(conn, veiculoId);

        return {
            veiculo,
            historico,
            total,
            limit,
            offset
        };
    },

    /**
     * Buscar relatório administrativo
     */
    async getRelatorioAdmin(conn, funcionarioMatricula, limit, offset) {
        const relatorios = await checklistRepository.findRelatorio(
            conn,
            funcionarioMatricula,
            limit,
            offset
        );

        // Converte BigInt para string
        return relatorios.map(item => ({
            ...item,
            id: String(item.id),
            veiculo_id: String(item.veiculo_id)
        }));
    }
};

module.exports = checklistService;
