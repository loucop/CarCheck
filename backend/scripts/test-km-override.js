// Harness local de A13 — verifica a derivação server-side de `km_override`.
// Não toca no banco: importa a função pura `deriveKmOverride` do service e roda
// uma bateria de casos. Uso: `node scripts/test-km-override.js` (sai 1 se falhar).
//
// Regra (decidida na sessão A13): override = QUALQUER campo de KM alterado cujo
// valor NOVO é estritamente menor que o valor ANTIGO que ele substitui.

const { deriveKmOverride } = require('../src/services/correcao.service');

let passed = 0;
let failed = 0;

function check(nome, entidade, row, changed, esperado) {
    const got = deriveKmOverride(entidade, row, changed);
    const ok = got === esperado;
    if (ok) {
        passed++;
        console.log(`  ok   ${nome}  (override=${got})`);
    } else {
        failed++;
        console.error(`  FAIL ${nome}  esperado=${esperado} obteve=${got}`);
    }
}

console.log('A13 — deriveKmOverride\n');

// --- checklist.km_entrada ---
check('checklist: baixar km_entrada (o bypass) → override',
    'checklist', { km_entrada: 1000 }, { km_entrada: 900 }, true);
check('checklist: subir km_entrada → sem override',
    'checklist', { km_entrada: 1000 }, { km_entrada: 1100 }, false);
check('checklist: km_entrada igual não entra no diff, mas se passar → sem override',
    'checklist', { km_entrada: 1000 }, { km_entrada: 1000 }, false);
check('checklist: corrigir só campo não-KM → sem override',
    'checklist', { km_entrada: 1000, local_origem: 'A' }, { local_origem: 'B' }, false);

// --- bdv: km_inicial / km_final (dois campos de KM) ---
check('bdv: baixar km_final → override',
    'bdv', { km_inicial: 100, km_final: 500 }, { km_final: 480 }, true);
check('bdv: baixar km_inicial, km_final intocado → override',
    'bdv', { km_inicial: 100, km_final: 500 }, { km_inicial: 80 }, true);
check('bdv: subir ambos → sem override',
    'bdv', { km_inicial: 100, km_final: 500 }, { km_inicial: 120, km_final: 600 }, false);
check('bdv: subir um e baixar o outro → override (qualquer redução conta)',
    'bdv', { km_inicial: 100, km_final: 500 }, { km_inicial: 120, km_final: 480 }, true);
check('bdv: corrigir combustivel (não-KM) → sem override',
    'bdv', { km_inicial: 100, km_final: 500 }, { combustivel_retorno: 'cheio' }, false);

// --- bdv_parada.km ---
check('parada: baixar km → override',
    'bdv_parada', { km: 250 }, { km: 200 }, true);
check('parada: subir km → sem override',
    'bdv_parada', { km: 250 }, { km: 300 }, false);

// --- bordas ---
check('km antigo NULL (vazio) → preencher não é redução',
    'bdv', { km_inicial: 100, km_final: null }, { km_final: 480 }, false);
check('valores como string (mariadb/coerce) → comparação numérica',
    'checklist', { km_entrada: '1000' }, { km_entrada: '900' }, true);
check('entidade sem campos de KM declarados → nunca override',
    'inexistente', { km: 100 }, { km: 1 }, false);

console.log(`\n${passed} passaram, ${failed} falharam`);
process.exit(failed === 0 ? 0 : 1);
