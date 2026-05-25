const express = require('express');
const authController = require('../controllers/auth.controller');
const veiculoController = require('../controllers/veiculo.controller');
const checklistController = require('../controllers/checklist.controller');
const adminController = require('../controllers/admin.controller');

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
                version: '3.0.0'
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
