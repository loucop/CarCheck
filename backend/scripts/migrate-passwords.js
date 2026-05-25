/**
 * SCRIPT DE MIGRAÇÃO: Senhas Texto Plano → Bcrypt
 * 
 * Execução:
 * node scripts/migrate-passwords.js
 * 
 * Comportamento:
 * - Busca funcionários com senha em texto plano
 * - Converte para bcrypt hash
 * - Ignora senhas já hasheadas ($2b$)
 */

const bcrypt = require('bcrypt');
const pool = require('../src/config/database');

async function migratePasswords() {
    let conn;
    try {
        console.log('\n=== INICIANDO MIGRAÇÃO DE SENHAS ===\n');
        
        conn = await pool.getConnection();
        
        // Busca todos os funcionários
        const funcionarios = await conn.query(
            'SELECT id, nome, senha_hash FROM funcionarios'
        );
        
        console.log(`Total de funcionários: ${funcionarios.length}`);
        
        let migrated = 0;
        let skipped = 0;
        
        for (const func of funcionarios) {
            // Verifica se já está hasheada
            if (func.senha_hash.startsWith('$2b$')) {
                console.log(`[SKIP] ${func.nome} (${func.id}) - Já possui hash bcrypt`);
                skipped++;
                continue;
            }
            
            // Gera hash bcrypt
            const hashedPassword = await bcrypt.hash(func.senha_hash, 10);
            
            // Atualiza no banco
            await conn.query(
                'UPDATE funcionarios SET senha_hash = ? WHERE id = ?',
                [hashedPassword, func.id]
            );
            
            console.log(`[OK] ${func.nome} (${func.id}) - Senha convertida para bcrypt`);
            migrated++;
        }
        
        console.log('\n=== MIGRAÇÃO CONCLUÍDA ===');
        console.log(`Senhas migradas: ${migrated}`);
        console.log(`Senhas ignoradas (já hasheadas): ${skipped}`);
        console.log('================================\n');
        
        process.exit(0);
        
    } catch (err) {
        console.error('\n[ERRO FATAL]', err.message);
        process.exit(1);
    } finally {
        if (conn) conn.release();
    }
}

// Executa migração
migratePasswords();
