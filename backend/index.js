const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
require('dotenv').config();

const routes = require('./src/routes');
const { corsOrigins } = require('./src/config/cors');
const { csrfProtection } = require('./src/middlewares/csrf.middleware');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler.middleware');

const app = express();

// Confia no primeiro proxy reverso (nginx/load balancer) para que req.ip
// reflita o IP real do cliente, e não o do proxy. Essencial para o rate
// limiter de login funcionar por usuário em produção. Ajuste o número de
// saltos se houver mais de um proxy na frente.
app.set('trust proxy', 1);

/**
 * ==========================================
 * PATCH GLOBAL: SERIALIZAÇÃO BIGINT
 * Resolve: "Do not know how to serialize a BigInt"
 * ==========================================
 */
BigInt.prototype.toJSON = function() { 
    return this.toString(); 
};

// ==========================================
// MIDDLEWARES GLOBAIS
// ==========================================

// ------------------------------------------
// SECURITY HEADERS (helmet) + CSP
// ------------------------------------------
// Nonce por requisição, exposto em res.locals.cspNonce para scripts inline.
// OBS de arquitetura: hoje o backend só serve a API + backend/public; as
// páginas HTML do admin são servidas por outro servidor estático (:10081),
// então este CSP só vale para respostas DESTE servidor. Para proteger as
// páginas HTML é preciso entregar o CSP no servidor que as serve (nginx/
// Cloudflare) — e, por serem estáticas, hashes são mais adequados que nonces.
app.use((req, res, next) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
    next();
});

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", (req, res) => `'nonce-${res.locals.cspNonce}'`],
            styleSrc: ["'self'", "'unsafe-inline'"], // M1-c: remover 'unsafe-inline' ao migrar styles p/ CSS
            imgSrc: ["'self'", "data:"],             // data: necessário p/ mapa de avaria (base64)
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            frameAncestors: ["'none'"],               // anti-clickjacking
            upgradeInsecureRequests: null             // app roda em HTTP na LAN; não forçar HTTPS
        }
    },
    // HSTS só faz sentido sob HTTPS; em HTTP/LAN seria inócuo/confuso.
    // Reativar (e ajustar) ao publicar via Cloudflare com HTTPS.
    hsts: false,
    // API consumida cross-origin (frontend em :10081) -> permite recursos cross-origin.
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS — allowlist de origens definida em src/config/cors.js (fonte única,
// compartilhada com o middleware de CSRF). O host LAN é sempre permitido;
// origens adicionais entram via a env CORS_ORIGINS, sem mexer no código.
// credentials: true é obrigatório para o cookie httpOnly de sessão (M4)
// trafegar em requests cross-origin (frontend :10081 -> backend :3000).
app.use(cors({
    origin(origin, callback) {
        // Permite requests sem Origin (curl, health checks, apps nativos).
        // CORS é mecanismo de browser; bloquear no-origin não agrega segurança.
        if (!origin || corsOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false); // sem header ACAO -> browser bloqueia
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());
// CSRF: checagem de Origin/Referer em métodos que alteram estado. Aplicado
// globalmente (métodos seguros são ignorados pelo próprio middleware), antes
// das rotas, cobrindo todas as rotas de escrita de uma vez.
app.use(csrfProtection);
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// RATE LIMITING - LOGIN (in-memory, no dependencies)
// Máx. 5 tentativas por IP a cada 15 minutos
// ==========================================

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
const loginAttempts = new Map(); // key: IP, value: { count, resetAt }

function loginRateLimiter(req, res, next) {
    const now = Date.now();

    // Limpa entradas expiradas a cada requisição
    for (const [ip, entry] of loginAttempts) {
        if (entry.resetAt <= now) {
            loginAttempts.delete(ip);
        }
    }

    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const entry = loginAttempts.get(ip);

    // Já atingiu o limite dentro da janela atual -> bloqueia sem processar
    if (entry && entry.resetAt > now && entry.count >= LOGIN_MAX_ATTEMPTS) {
        return res.status(429).json({
            success: false,
            error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
            code: 'RATE_LIMIT_EXCEEDED'
        });
    }

    // Conta apenas tentativas que FALHARAM. Um login bem-sucedido limpa o
    // contador do IP, evitando que usuários legítimos atrás de um NAT
    // compartilhado bloqueiem uns aos outros.
    res.on('finish', () => {
        if (res.statusCode < 400) {
            loginAttempts.delete(ip);
            return;
        }
        if (res.statusCode === 429) return; // já estava bloqueado; não conta de novo

        const at = Date.now();
        const cur = loginAttempts.get(ip);
        if (!cur || cur.resetAt <= at) {
            loginAttempts.set(ip, { count: 1, resetAt: at + LOGIN_WINDOW_MS });
        } else {
            cur.count += 1;
        }
    });

    next();
}

// ==========================================
// ROTAS
// ==========================================

// Rate limiter aplicado apenas a POST /api/login, antes do router
app.post('/api/login', loginRateLimiter);

app.use('/api', routes);

// ==========================================
// ERROR HANDLERS
// ==========================================

// 404 - Rota não encontrada
app.use(notFoundHandler);

// Error handler global
app.use(errorHandler);

// ==========================================
// INICIALIZAÇÃO
// ==========================================

const JWT_SECRET = process.env.JWT_SECRET;
const WEAK_DEFAULTS = [
    'mude_este_secret_agora_2026_carcheck_production',
    'change_in_production',
    'secret',
    '',
    `generate_with__node_-e_"console.log(require('crypto').randomBytes(48).toString('hex'))"`
];

if (!JWT_SECRET || WEAK_DEFAULTS.includes(JWT_SECRET) || JWT_SECRET.length < 32) {
    console.error('FATAL: JWT_SECRET is missing, weak, or default. Set a strong secret in .env before starting.');
    process.exit(1);
}

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(60));
    console.log('  CarCheck Backend v4.0 - ENTERPRISE EDITION');
    console.log('='.repeat(60));
    console.log(`  Endereço:  http://10.10.1.100:${PORT}`);
    console.log(`  Ambiente:  ${process.env.NODE_ENV || 'production'}`);
    console.log(`  Banco:     MariaDB (carcheck_db)`);
    console.log(`  Status:    🟢 ONLINE`);
    console.log('  Features:  JWT Auth | Transações | Validação Zod');
    console.log('='.repeat(60) + '\n');
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================

process.on('SIGTERM', () => {
    console.log('[SHUTDOWN] Encerrando servidor...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('[SHUTDOWN] Encerrando servidor...');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERRO NÃO TRATADO]', { reason, promise });
});

process.on('uncaughtException', (error) => {
    console.error('[EXCEÇÃO NÃO CAPTURADA]', error);
    process.exit(1);
});
