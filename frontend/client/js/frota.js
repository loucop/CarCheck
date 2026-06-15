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

        veiculos.forEach(v => {
            const tipoVeiculo = v.tipo || 'carro';

            container.innerHTML += `
                <div class="card" style="cursor: pointer; margin-bottom: 10px;" 
                     onclick="iniciarChecklist('${v.id}', '${v.placa}', '${tipoVeiculo}', '${v.modelo}')">
                    <h3>${v.modelo}</h3>
                    <p>Placa: <strong>${v.placa}</strong></p>
                    <small style="color: #94a3b8">Toque para iniciar</small>
                </div>`;
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

    console.log(`[ID SALVO]: ${id}`);
    window.location.href = 'checklist.html';
}

carregarVeiculos();
