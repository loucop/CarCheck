const mariadb = require('mariadb');
require('dotenv').config();
const logger = require('../utils/logger');

// Configuração do pool
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT),
    // M8: limita a espera por uma conexão livre do pool. Sem isto, sob starvation
    // (todas as N conexões presas por leituras lentas) a request pendura até uma
    // liberar — falha rápida com ER_GET_CONNECTION_TIMEOUT é melhor que enfileirar
    // indefinidamente. O errorHandler mapeia esse code para 503 (SERVICE_UNAVAILABLE).
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 10000,
    allowPublicKeyRetrieval: true,
    trace: process.env.NODE_ENV !== 'production'
});

// Health check na inicialização
pool.getConnection()
    .then(conn => {
        logger.info('[DB] Conexão estabelecida com MariaDB');
        conn.release();
    })
    .catch(err => {
        logger.error('[DB FATAL] Falha ao conectar:', err.message);
        process.exit(1);
    });

module.exports = pool;
