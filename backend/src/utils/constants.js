/**
 * Constantes globais do sistema
 */

const ROLES = {
    ADMIN: 'admin',
    VISTORIADOR: 'vistoriador',
    MOTORISTA: 'motorista'
};

const STATUS = {
    ATIVO: 'ativo',
    INATIVO: 'inativo'
};

const ITEM_STATUS = {
    OK: 'OK',
    RUIM: 'RUIM'
};

// A7: campos corrigíveis (com auditoria) por entidade — fonte única, compartilhada
// entre a validação do service (rejeita qualquer outro campo) e a montagem do SET
// no repository (única camada que interpola nomes de coluna em SQL). Espelha
// BACKLOG A7 §4. Procedência (matricula/veiculo_id), PKs, checklist_id, status do
// BDV e timestamps de sistema NÃO estão aqui — são imutáveis por design.
const CORRECTABLE_FIELDS = {
    checklist: ['km_entrada', 'itens_status', 'local_origem', 'local_destino', 'mapa_avaria_base64'],
    bdv: ['km_inicial', 'km_final', 'combustivel_retorno', 'coligada', 'encerrado_fora_base'],
    bdv_parada: ['km', 'hora_saida', 'hora_chegada', 'local_saida', 'local_chegada', 'observacao']
};

const ERROR_CODES = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    AUTH_FAILED: 'AUTH_FAILED',
    TOKEN_INVALID: 'TOKEN_INVALID',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INSUFFICIENT_PERMISSION: 'INSUFFICIENT_PERMISSION',
    RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
    DUPLICATE_ENTRY: 'DUPLICATE_ENTRY',
    KM_INVALID: 'KM_INVALID',
    CHECKLIST_REQUIRED: 'CHECKLIST_REQUIRED',
    VEHICLE_MISMATCH: 'VEHICLE_MISMATCH',
    CSRF_DENIED: 'CSRF_DENIED',
    PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
    DB_ERROR: 'DB_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

module.exports = {
    ROLES,
    STATUS,
    ITEM_STATUS,
    CORRECTABLE_FIELDS,
    ERROR_CODES
};
