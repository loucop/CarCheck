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
    // B20: retorna colunas BIGINT e insertIds como Number JS (não BigInt). Os PKs/FKs
    // migraram de int(11) p/ bigint(20); sem isto o driver devolveria BigInt para eles
    // e comparações estritas (ex.: `bdv.matricula !== req.user.matricula` no bdv.service)
    // quebrariam (BigInt !== Number é sempre true). Assim os campos numéricos se comportam
    // como antes (Number em JS, número no JSON), tornando o app agnóstico a int vs bigint.
    // Teto efetivo passa a ser 2^53 (~9e15) — ~4 milhões× o teto do int, inatingível.
    // checkNumberRange: falha alto se algum valor exceder o range seguro (em vez de corromper).
    bigIntAsNumber: true,
    insertIdAsNumber: true,
    checkNumberRange: true,
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
