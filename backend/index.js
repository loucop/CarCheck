const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const routes = require('./src/routes');
const { errorHandler, notFoundHandler } = require('./src/middlewares/errorHandler.middleware');

const app = express();

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

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================
// ROTAS
// ==========================================

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

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => {
    console.log('\n' + '='.repeat(60));
    console.log('  CarCheck Backend v3.0 - ENTERPRISE EDITION');
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
