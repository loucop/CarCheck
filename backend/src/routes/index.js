const express = require('express');
const authController = require('../controllers/auth.controller');
const veiculoController = require('../controllers/veiculo.controller');
const checklistController = require('../controllers/checklist.controller');
const adminController = require('../controllers/admin.controller');
const bdvController = require('../controllers/bdv.controller');

const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { validate, schemas } = require('../middlewares/validate.middleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

// ==========================================
// ROTAS PÚBLICAS (Sem autenticação)
// ==========================================

/**
 * POST /api/login
 * Login com matrícula/CPF e senha
 */
router.post(
    '/login',
    validate(schemas.login),
    authController.login
);

/**
 * POST /api/logout
 * Limpa o cookie de sessão. Público: deve funcionar mesmo com token expirado.
 */
router.post(
    '/logout',
    authController.logout
);

// ==========================================
// ROTA DE SESSÃO (Autenticada)
// ==========================================

/**
 * GET /api/me
 * Retorna o usuário da sessão atual (valida o cookie/token).
 */
router.get(
    '/me',
    authenticate,
    authController.me
);

// ==========================================
// ROTAS DE VEÍCULOS (Autenticadas)
// ==========================================

/**
 * GET /api/veiculos
 * Listar veículos ativos
 */
router.get(
    '/veiculos',
    authenticate,
    veiculoController.listVeiculos
);

/**
 * GET /api/veiculos/:id/historico
 * Histórico de checklists de um veículo
 */
router.get(
    '/veiculos/:id/historico',
    authenticate,
    validate(schemas.historicoVeiculo, 'params'),
    checklistController.getHistoricoVeiculo
);

// ==========================================
// ROTAS DE CHECKLIST (Autenticadas)
// ==========================================

/**
 * POST /api/checklist
 * Criar novo checklist
 */
router.post(
    '/checklist',
    authenticate,
    validate(schemas.createChecklist),
    checklistController.createChecklist
);

/**
 * GET /api/checklist/pendente
 * Checklist do dia, do motorista autenticado, ainda não vinculado a um BDV (órfão).
 * 200 com o checklist ou 404 quando não há — mesma forma de /api/bdv/ativo. (A6)
 */
router.get(
    '/checklist/pendente',
    authenticate,
    checklistController.getPendente
);

// ==========================================
// ROTAS DE BDV (Autenticadas)
// ==========================================

/**
 * POST /api/bdv
 * Abrir novo BDV
 */
router.post(
    '/bdv',
    authenticate,
    validate(schemas.openBDV),
    bdvController.open
);

/**
 * GET /api/bdv/ativo
 * BDV aberto do motorista autenticado
 */
router.get(
    '/bdv/ativo',
    authenticate,
    bdvController.getAtivo
);

/**
 * GET /api/bdv/:id
 * Buscar BDV completo com paradas
 */
router.get(
    '/bdv/:id',
    authenticate,
    validate(schemas.bdvParams, 'params'),
    bdvController.findById
);

/**
 * POST /api/bdv/:id/paradas
 * Registrar parada em um BDV aberto
 */
router.post(
    '/bdv/:id/paradas',
    authenticate,
    validate(schemas.bdvParams, 'params'),
    validate(schemas.addParada),
    bdvController.addParada
);

/**
 * PATCH /api/bdv/:id/paradas/:paradaId
 * Registrar chegada em uma parada
 */
router.patch(
    '/bdv/:id/paradas/:paradaId',
    authenticate,
    validate(schemas.paradaParams, 'params'),
    validate(schemas.closeParada),
    bdvController.closeParada
);

/**
 * PATCH /api/bdv/:id/encerrar
 * Encerrar BDV
 */
router.patch(
    '/bdv/:id/encerrar',
    authenticate,
    validate(schemas.bdvParams, 'params'),
    validate(schemas.closeBDV),
    bdvController.close
);

// ==========================================
// ROTAS ADMINISTRATIVAS (Apenas Admin)
// ==========================================

/**
 * GET /api/admin/relatorio
 * Relatório de inspeções (com filtros)
 */
router.get(
    '/admin/relatorio',
    authenticate,
    authorize(ROLES.ADMIN),
    validate(schemas.relatorioAdmin, 'query'),
    adminController.getRelatorio
);

/**
 * GET /api/admin/funcionarios
 * Listar todos os funcionários
 */
router.get(
    '/admin/funcionarios',
    authenticate,
    authorize(ROLES.ADMIN),
    authController.listFuncionarios
);

/**
 * POST /api/admin/funcionarios
 * Cadastrar novo funcionário
 */
router.post(
    '/admin/funcionarios',
    authenticate,
    authorize(ROLES.ADMIN),
    validate(schemas.createFuncionario),
    authController.createFuncionario
);

/**
 * GET /api/admin/bdv
 * Relatório de BDVs com filtros
 */
router.get(
    '/admin/bdv',
    authenticate,
    authorize(ROLES.ADMIN),
    validate(schemas.relatorioBDV, 'query'),
    bdvController.relatorio
);

// ==========================================
// HEALTH CHECK (Público)
// ==========================================

router.get('/health', async (req, res) => {
    const pool = require('../config/database');
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('SELECT 1');
        
        res.json({
            success: true,
            data: {
                status: 'online',
                database: 'connected',
                timestamp: new Date().toISOString(),
                version: '4.0.0'
            }
        });
    } catch (err) {
        res.status(503).json({
            success: false,
            error: 'Banco de dados indisponível',
            code: 'DB_UNAVAILABLE'
        });
    } finally {
        if (conn) conn.release();
    }
});

module.exports = router;
