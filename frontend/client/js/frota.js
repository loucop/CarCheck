// ==========================================
// FROTA.JS v3.0 - Com suporte JWT
// ==========================================

async function carregarVeiculos() {
    try {
        // M4 Fase 2: a sessão vive no cookie httpOnly; o guard só checa a
        // presença de `usuario` (UI). 401 (cookie ausente/expirado) é tratado
        // centralmente por apiFetch — limpa o estado e redireciona ao login.
        if (!localStorage.getItem("usuario")) {
            window.location.href = "login.html";
            return;
        }

        const resposta = await apiFetch("/veiculos");

        if (!resposta.ok) throw new Error("Falha de comunicação com o servidor.");
        
        const resultado = await resposta.json();
        const veiculos = resultado.data || resultado; // Compatibilidade
        
        const container = document.getElementById('lista-veiculos');
        container.innerHTML = "";

        // B7: monta os cards via DOM API (textContent + addEventListener), não por
        // interpolação em string HTML. Elimina a injeção de XSS/JS que existia ao
        // colar modelo/placa crus no HTML e, pior, dentro do atributo onclick com
        // aspas simples (um `'` no modelo quebrava a string e injetava JS). Também
        // remove um handler inline, alinhado ao M1-b (rumo a CSP estrito).
        veiculos.forEach(v => {
            const tipoVeiculo = v.tipo || 'carro';

            const card = document.createElement('div');
            card.className = 'card';
            card.style.cursor = 'pointer';
            card.style.marginBottom = '10px';

            const h3 = document.createElement('h3');
            h3.textContent = v.modelo;

            const p = document.createElement('p');
            p.textContent = 'Placa: ';
            const strong = document.createElement('strong');
            strong.textContent = v.placa;
            p.appendChild(strong);

            const small = document.createElement('small');
            small.style.color = '#94a3b8';
            small.textContent = 'Toque para iniciar';

            card.append(h3, p, small);
            card.addEventListener('click', () =>
                iniciarChecklist(v.id, v.placa, tipoVeiculo, v.modelo));
            container.appendChild(card);
        });
    } catch (erro) {
        // 401 já tratado por apiFetch (redirect ao login em curso) — não renderizar erro.
        if (erro && erro.isAuthRedirect) return;
        console.error("Erro tático de rede:", erro);
        document.getElementById('lista-veiculos').innerHTML = `
            <div style="text-align: center; color: #ef4444; padding: 20px;">
                <p><strong>Erro de Conexão</strong></p>
                <p style="font-size: 0.9em;">Não foi possível acessar a base de dados central. Verifique a rede.</p>
            </div>`;
    }
}

function iniciarChecklist(id, placa, tipo, modelo) {
    localStorage.setItem('veiculo_id', id);
    localStorage.setItem('veiculo_atual', placa);
    localStorage.setItem('modelo_veiculo', modelo);

    window.location.href = 'checklist.html';
}

carregarVeiculos();
