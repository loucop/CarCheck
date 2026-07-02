const express = require('express');
const authController = require('../controllers/auth.controller');
const veiculoController = require('../controllers/veiculo.controller');
const checklistController = require('../controllers/checklist.controller');
const adminController = require('../controllers/admin.controller');
const bdvController = require('../controllers/bdv.controller');
const correcaoController = require('../controllers/correcao.controller');

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
    authorize(ROLES.MOTORISTA, ROLES.VISTORIADOR),  // A9: motorista e vistoriador inspecionam; admin não
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
    authorize(ROLES.MOTORISTA),  // A9: recuperação de órfão é escopada ao motorista (A6)
    checklistController.getPendente
);

/**
 * GET /api/checklist/:id/mapa
 * A11: imagem de avaria de um checklist, sob demanda. Mesma audiência do relatório
 * admin (vistoriador + admin) — é só o modal de detalhe que precisa da imagem.
 */
router.get(
    '/checklist/:id/mapa',
    authenticate,
    authorize(ROLES.VISTORIADOR, ROLES.ADMIN),
    validate(schemas.checklistMapaParams, 'params'),
    checklistController.getMapa
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
    authorize(ROLES.MOTORISTA),  // A9: só motorista abre BDV (admin audita; checklist de vistoriador é estado final, sem BDV)
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
    authorize(ROLES.MOTORISTA),  // A9: "BDV ativo do motorista" — só motorista tem um
    bdvController.getAtivo
);

/**
 * GET /api/bdv/:id
 * Buscar BDV completo com paradas
 */
router.get(
    '/bdv/:id',
    authenticate,
    // A9: sem authorize de propósito — o service (getBDV) já faz guard admin-OU-dono.
    // Um gate de role grosseiro aqui correria o risco de trancar o admin para fora.
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
    // A9: escrita de BDV — só motorista (service já faz guard de dono).
    // A7-coupled: pode ganhar VISTORIADOR quando o papel de override/supervisor entrar.
    authorize(ROLES.MOTORISTA),
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
    // A9: escrita de BDV — só motorista (service já faz guard de dono).
    // A7-coupled: pode ganhar VISTORIADOR quando o papel de override/supervisor entrar.
    authorize(ROLES.MOTORISTA),
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
    // A9: escrita de BDV — só motorista (service já faz guard de dono).
    // A7-coupled: pode ganhar VISTORIADOR quando o papel de override/supervisor entrar.
    authorize(ROLES.MOTORISTA),
    validate(schemas.bdvParams, 'params'),
    validate(schemas.closeBDV),
    bdvController.close
);

// ==========================================
// ROTAS DE CORREÇÃO (A7 — Vistoriador/Admin)
// ==========================================
// Caminho de escrita SEPARADO do fluxo do motorista (correcao.service): override de
// nível supervisor, sem o guard de monotonicidade de KM. O gate de "quem pode quebrar
// a monotonicidade" mora inteiramente aqui (authorize) + na existência do service.
// CSRF já coberto (métodos de mutação, middleware montado globalmente).

/**
 * PATCH /api/correcoes/checklist/:id
 * Corrige campos de um checklist (com auditoria)
 */
router.patch(
    '/correcoes/checklist/:id',
    authenticate,
    authorize(ROLES.VISTORIADOR, ROLES.ADMIN),
    validate(schemas.correcaoParams, 'params'),
    validate(schemas.correcaoChecklist),
    correcaoController.corrigirChecklist
);

/**
 * PATCH /api/correcoes/bdv/:id
 * Corrige campos de um BDV (com auditoria)
 */
router.patch(
    '/correcoes/bdv/:id',
    authenticate,
    authorize(ROLES.VISTORIADOR, ROLES.ADMIN),
    validate(schemas.correcaoParams, 'params'),
    validate(schemas.correcaoBDV),
    correcaoController.corrigirBDV
);

/**
 * PATCH /api/correcoes/bdv/:id/paradas/:paradaId
 * Corrige uma parada de um BDV (com auditoria)
 */
router.patch(
    '/correcoes/bdv/:id/paradas/:paradaId',
    authenticate,
    authorize(ROLES.VISTORIADOR, ROLES.ADMIN),
    validate(schemas.paradaParams, 'params'),
    validate(schemas.correcaoParada),
    correcaoController.corrigirParada
);

/**
 * PATCH /api/correcoes/veiculo/:id/km
 * Seta a âncora de KM do veículo (§6.2) — km_override sempre true, motivo obrigatório.
 */
router.patch(
    '/correcoes/veiculo/:id/km',
    authenticate,
    authorize(ROLES.VISTORIADOR, ROLES.ADMIN),
    validate(schemas.correcaoParams, 'params'),
    validate(schemas.correcaoKmVeiculo),
    correcaoController.corrigirKmVeiculo
);

/**
 * GET /api/correcoes
 * Histórico de correções, filtrável por entidade/entidade_id/matricula. (A7 slice 3)
 * Vistoriador vê todas as correções (papel de supervisor); admin idem.
 */
router.get(
    '/correcoes',
    authenticate,
    authorize(ROLES.VISTORIADOR, ROLES.ADMIN),
    validate(schemas.correcaoQuery, 'query'),
    correcaoController.getHistorico
);

// ==========================================
// ROTAS ADMINISTRATIVAS (Apenas Admin)
// ==========================================

/**
 * GET /api/admin/relatorio
 * Relatório de inspeções (com filtros). A7: vistoriador precisa ver para poder corrigir.
 */
router.get(
    '/admin/relatorio',
    authenticate,
    authorize(ROLES.VISTORIADOR, ROLES.ADMIN),
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
 * PATCH /api/admin/funcionarios/:matricula
 * M16: editar / ativar-desativar / reset de senha. CSRF já coberto (mutação,
 * middleware global). Guards anti-lockout no service (admin não se desativa/rebaixa).
 */
router.patch(
    '/admin/funcionarios/:matricula',
    authenticate,
    authorize(ROLES.ADMIN),
    validate(schemas.funcionarioParams, 'params'),
    validate(schemas.updateFuncionario),
    authController.updateFuncionario
);

/**
 * GET /api/admin/bdv
 * Relatório de BDVs com filtros. A7: vistoriador precisa ver para poder corrigir.
 */
router.get(
    '/admin/bdv',
    authenticate,
    authorize(ROLES.VISTORIADOR, ROLES.ADMIN),
    validate(schemas.relatorioBDV, 'query'),
    bdvController.relatorio
);

// ==========================================
// HEALTH CHECK (Público)
// ==========================================

// M7: /health é público e sem auth. Sem defesa, cada chamada pega uma conexão do
// pool (SELECT 1) — martelar o endpoint esgota as 10 conexões e derruba o app.
// Defesa: cachear o resultado por HEALTH_CACHE_MS (default 5s) e COALESCER checagens
// concorrentes numa única query em voo. Sob flood, o pool é tocado no máximo 1x por
// janela (não 1x por request), independente da taxa de chamadas.
const HEALTH_CACHE_MS = parseInt(process.env.HEALTH_CACHE_MS) || 5000;
let healthCache = null;    // { statusCode, body, expiresAt }
let healthInFlight = null; // Promise enquanto uma checagem viva roda (anti-thundering-herd)

async function runHealthCheck() {
    const pool = require('../config/database');
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.query('SELECT 1');
        return {
            statusCode: 200,
            body: {
                success: true,
                data: {
                    status: 'online',
                    database: 'connected',
                    timestamp: new Date().toISOString(),
                    version: '4.0.0'
                }
            }
        };
    } catch (err) {
        return {
            statusCode: 503,
            body: {
                success: false,
                error: 'Banco de dados indisponível',
                code: 'DB_UNAVAILABLE'
            }
        };
    } finally {
        if (conn) conn.release();
    }
}

router.get('/health', async (req, res) => {
    const now = Date.now();
    if (healthCache && healthCache.expiresAt > now) {
        return res.status(healthCache.statusCode).json(healthCache.body);
    }
    // Uma só checagem viva por vez: requests concorrentes no momento da expiração
    // aguardam a mesma Promise em vez de cada um pegar sua própria conexão do pool.
    if (!healthInFlight) {
        healthInFlight = runHealthCheck()
            .then((result) => {
                healthCache = { ...result, expiresAt: Date.now() + HEALTH_CACHE_MS };
                return result;
            })
            .finally(() => { healthInFlight = null; });
    }
    const result = await healthInFlight;
    res.status(result.statusCode).json(result.body);
});

module.exports = router;
