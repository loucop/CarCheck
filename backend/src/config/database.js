const mariadb = require('mariadb');
require('dotenv').config();

// Configuração do pool
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT),
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT),
    allowPublicKeyRetrieval: true,
    trace: process.env.NODE_ENV !== 'production'
});

// Health check na inicialização
pool.getConnection()
    .then(conn => {
        console.log('[DB] Conexão estabelecida com MariaDB');
        conn.release();
    })
    .catch(err => {
        console.error('[DB FATAL] Falha ao conectar:', err.message);
        process.exit(1);
    });

module.exports = pool;
