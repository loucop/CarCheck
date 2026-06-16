const bdvRepository = require('../repositories/bdv.repository');
const veiculoRepository = require('../repositories/veiculo.repository');
const checklistRepository = require('../repositories/checklist.repository');
const { ERROR_CODES } = require('../utils/constants');

const bdvService = {
    async openBDV(conn, data) {
        try {
            await conn.beginTransaction();

            // Block if driver already has an open BDV
            const openByDriver = await bdvRepository.findActiveBDVByMatricula(conn, data.matricula);
            if (openByDriver) {
                throw {
                    message: 'Motorista já possui um BDV aberto',
                    code: ERROR_CODES.DUPLICATE_ENTRY,
                    statusCode: 409
                };
            }

            // Lock vehicle row before checking availability (prevents TOCTOU on concurrent opens)
            const veiculo = await veiculoRepository.findByIdWithLock(conn, data.veiculo_id);
            if (!veiculo) {
                throw {
                    message: 'Veículo não encontrado',
                    code: ERROR_CODES.RESOURCE_NOT_FOUND,
                    statusCode: 404
                };
            }

            // Recheck vehicle availability after acquiring the lock
            const openByVehicle = await bdvRepository.findActiveBDVByVeiculoId(conn, data.veiculo_id);
            if (openByVehicle) {
                throw {
                    message: 'Veículo já está em uso por outro motorista',
                    code: ERROR_CODES.DUPLICATE_ENTRY,
                    statusCode: 409
                };
            }

            const ultimoKm = veiculo.km_atual || 0;
            if (data.km_inicial < ultimoKm) {
                throw {
                    message: `KM inválido: informado (${data.km_inicial}) menor que o último registrado (${ultimoKm})`,
                    code: ERROR_CODES.KM_INVALID,
                    statusCode: 400
                };
            }

            // Link today's unlinked checklist if one exists
            const checklistPendente = await checklistRepository.findPendingTodayByMatricula(conn, data.matricula);
            if (checklistPendente) {
                data.checklist_id = checklistPendente.id;
            }

            const bdvId = await bdvRepository.createBDV(conn, data);
            await veiculoRepository.updateStatus(conn, data.veiculo_id, 'em_uso');
            await veiculoRepository.updateKm(conn, data.veiculo_id, data.km_inicial);

            await conn.commit();

            return {
                id: String(bdvId),
                veiculo_id: String(data.veiculo_id),
                km_inicial: data.km_inicial
            };

        } catch (err) {
            await conn.rollback();
            throw err;
        }
    },

    async addParada(conn, bdv_id, matricula, data) {
        const bdv = await bdvRepository.findBDVById(conn, bdv_id);

        if (!bdv) {
            throw {
                message: 'BDV não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        if (bdv.matricula !== matricula) {
            throw {
                message: 'Acesso negado: este BDV pertence a outro motorista',
                code: ERROR_CODES.INSUFFICIENT_PERMISSION,
                statusCode: 403
            };
        }

        if (bdv.status !== 'aberto') {
            throw {
                message: 'BDV já encerrado',
                code: ERROR_CODES.VALIDATION_ERROR,
                statusCode: 409
            };
        }

        const lastParada = await bdvRepository.findLastParada(conn, bdv_id);
        if (lastParada && lastParada.km != null && data.km != null && data.km < lastParada.km) {
            throw {
                message: `KM inválido: informado (${data.km}) menor que o da última parada (${lastParada.km})`,
                code: ERROR_CODES.KM_INVALID,
                statusCode: 400
            };
        }

        if (data.km != null && data.km < bdv.km_inicial) {
            throw {
                message: `KM da parada não pode ser menor que o KM inicial do BDV (${bdv.km_inicial})`,
                code: ERROR_CODES.KM_INVALID,
                statusCode: 400
            };
        }

        const paradaId = await bdvRepository.addParada(conn, bdv_id, data);

        return { id: String(paradaId), bdv_id: String(bdv_id) };
    },

    async closeParada(conn, bdv_id, parada_id, matricula, data) {
        const bdv = await bdvRepository.findBDVById(conn, bdv_id);

        if (!bdv) {
            throw {
                message: 'BDV não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        if (bdv.matricula !== matricula) {
            throw {
                message: 'Acesso negado: este BDV pertence a outro motorista',
                code: ERROR_CODES.INSUFFICIENT_PERMISSION,
                statusCode: 403
            };
        }

        if (bdv.status !== 'aberto') {
            throw {
                message: 'BDV já encerrado',
                code: ERROR_CODES.VALIDATION_ERROR,
                statusCode: 409
            };
        }

        const affected = await bdvRepository.closeParada(conn, bdv_id, parada_id, data);

        if (affected === 0) {
            throw {
                message: 'Parada não encontrada neste BDV',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        return { bdv_id: String(bdv_id), parada_id: String(parada_id) };
    },

    async closeBDV(conn, bdv_id, matricula, data) {
        // Read BDV outside the transaction for fail-fast validation
        const bdv = await bdvRepository.findBDVById(conn, bdv_id);

        if (!bdv) {
            throw {
                message: 'BDV não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        if (bdv.matricula !== matricula) {
            throw {
                message: 'Acesso negado: este BDV pertence a outro motorista',
                code: ERROR_CODES.INSUFFICIENT_PERMISSION,
                statusCode: 403
            };
        }

        if (bdv.status !== 'aberto') {
            throw {
                message: 'BDV já encerrado',
                code: ERROR_CODES.VALIDATION_ERROR,
                statusCode: 409
            };
        }

        if (data.km_final < bdv.km_inicial) {
            throw {
                message: `KM final (${data.km_final}) menor que KM inicial (${bdv.km_inicial})`,
                code: ERROR_CODES.KM_INVALID,
                statusCode: 400
            };
        }

        const maxParadaKm = await bdvRepository.findMaxParadaKm(conn, bdv_id);
        if (maxParadaKm != null && data.km_final < maxParadaKm) {
            throw {
                message: `KM final (${data.km_final}) menor que o KM máximo das paradas (${maxParadaKm})`,
                code: ERROR_CODES.KM_INVALID,
                statusCode: 400
            };
        }

        try {
            await conn.beginTransaction();

            // Lock vehicle row before updating KM
            await veiculoRepository.findByIdWithLock(conn, bdv.veiculo_id);

            await bdvRepository.closeBDV(conn, bdv_id, data);
            await veiculoRepository.updateKm(conn, bdv.veiculo_id, data.km_final);
            await veiculoRepository.updateStatus(conn, bdv.veiculo_id, 'disponivel');

            await conn.commit();

            return { id: String(bdv_id), km_final: data.km_final, status: 'encerrado' };

        } catch (err) {
            await conn.rollback();
            throw err;
        }
    },

    async getBDVAtivo(conn, matricula) {
        const ativo = await bdvRepository.findActiveBDVByMatricula(conn, matricula);

        if (!ativo) {
            throw {
                message: 'Nenhum BDV aberto para este motorista',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        const bdv = await bdvRepository.findBDVById(conn, ativo.id);

        return {
            ...bdv,
            id: String(bdv.id),
            veiculo_id: String(bdv.veiculo_id)
        };
    },

    async getBDV(conn, id, requester) {
        const bdv = await bdvRepository.findBDVById(conn, id);

        if (!bdv) {
            throw {
                message: 'BDV não encontrado',
                code: ERROR_CODES.RESOURCE_NOT_FOUND,
                statusCode: 404
            };
        }

        // A3 #7: guard de ownership (BOLA/IDOR). Só o dono do BDV ou um admin
        // pode lê-lo — o relatório admin (/admin/bdv) usa este endpoint com role admin.
        if (requester.nivel_acesso !== 'admin' && bdv.matricula !== requester.matricula) {
            throw {
                message: 'Acesso negado: este BDV pertence a outro motorista',
                code: ERROR_CODES.INSUFFICIENT_PERMISSION,
                statusCode: 403
            };
        }

        return {
            ...bdv,
            id: String(bdv.id),
            veiculo_id: String(bdv.veiculo_id)
        };
    },

    async getRelatorio(conn, filters) {
        const results = await bdvRepository.findAllBDV(conn, filters);

        return results.map(item => ({
            ...item,
            id: String(item.id),
            veiculo_id: String(item.veiculo_id)
        }));
    }
};

module.exports = bdvService;
