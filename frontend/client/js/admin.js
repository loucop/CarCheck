// ==========================================
// ADMIN.JS v3.0 - Corrigido: itens_status + km_entrada
// ==========================================

let funcionariosLista = [];
let filtroAtivo = null;

function verificarSeguranca() {
    const usuario = JSON.parse(localStorage.getItem("usuario"));
    const token = localStorage.getItem("token");

    if (!usuario || !token || usuario.nivel_acesso !== "admin") {
        console.warn("[ACESSO NEGADO] Redirecionando...");
        window.location.href = "login.html";
        return false;
    }
    return true;
}

async function carregarFuncionarios() {
    try {
        const token = localStorage.getItem("token");

        const resposta = await fetch(`${CONFIG.API_BASE_URL}/admin/funcionarios`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (resposta.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!resposta.ok) throw new Error("Erro ao carregar funcionários");

        const resultado = await resposta.json();
        funcionariosLista = resultado.data || resultado;
        renderizarFiltroFuncionarios();
    } catch (erro) {
        console.error("[ERRO] Falha ao carregar funcionários:", erro);
    }
}

function renderizarFiltroFuncionarios() {
    const select = document.getElementById("filtroFuncionario");
    if (!select) return;

    select.innerHTML = '<option value="">Todos os Funcionários</option>';

    funcionariosLista.forEach(func => {
        const option = document.createElement("option");
        option.value = func.matricula;
        option.textContent = `${func.nome} (${func.nivel_acesso})`;
        select.appendChild(option);
    });
}

async function carregarRelatorios(funcionarioId = null) {
    if (!verificarSeguranca()) return;

    const corpoTabela = document.getElementById("corpoTabela");
    corpoTabela.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 20px;">Carregando dados...</td></tr>';

    try {
        const token = localStorage.getItem("token");
        let url = `${CONFIG.API_BASE_URL}/admin/relatorio`;

        if (funcionarioId) {
            url += `?funcionario_id=${funcionarioId}`;
            filtroAtivo = funcionarioId;
        } else {
            filtroAtivo = null;
        }

        const resposta = await fetch(url, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (resposta.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!resposta.ok) throw new Error(`Erro HTTP: ${resposta.status}`);

        const resultado = await resposta.json();
        const dados = resultado.data || resultado;

        if (!Array.isArray(dados)) {
            throw new Error("A API não retornou uma lista válida.");
        }

        if (dados.length === 0) {
            const mensagem = filtroAtivo
                ? 'Nenhuma inspeção encontrada para este funcionário.'
                : 'Nenhuma inspeção registrada no banco.';
            corpoTabela.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 20px;">${mensagem}</td></tr>`;
            return;
        }

        corpoTabela.innerHTML = dados.map((item) => {
            let rawDate = item.data_inspecao;
            if (typeof rawDate === "string" && rawDate.includes(" ")) {
                rawDate = rawDate.replace(" ", "T");
            }
            const dataObj = rawDate ? new Date(rawDate) : null;
            const dataFormatada = (dataObj && !isNaN(dataObj.getTime()))
                ? dataObj.toLocaleString("pt-BR")
                : "Data Inválida";

            const rotaBadge = (item.local_origem && item.local_destino)
                ? `<small style="color: #3b82f6;">${item.local_origem} → ${item.local_destino}</small>`
                : '<small style="color: #94a3b8;">Sem rota informada</small>';

            return `
                <tr>
                    <td>${dataFormatada}</td>
                    <td>${item.motorista ?? "Não identificado"}</td>
                    <td>
                        ${item.placa ?? "---"}
                        <br>
                        <small style="color: #64748b;">${item.modelo ?? ""}</small>
                        <br>
                        <a href="#" onclick="verHistoricoVeiculo(event, '${item.veiculo_id || ''}', '${item.placa || ''}'); return false;"
                           style="font-size: 0.85rem; color: #3b82f6; text-decoration: none;">
                            Ver Histórico Completo
                        </a>
                    </td>
                    <td>${item.km_entrada ?? "0"} KM<br>${rotaBadge}</td>
                    <td>
                        <button onclick="verDetalhes('${item.id}')"
                                style="cursor:pointer; padding: 8px 15px; background: #3b82f6; color: white; border: none; border-radius: 6px; font-weight: bold;">
                            Ver Detalhes
                        </button>
                    </td>
                </tr>
            `;
        }).join("");

        window.relatoriosCache = dados;
        console.log('[DEBUG] Cache carregado com', dados.length, 'registros');
        console.log('[DEBUG] Primeiro registro:', dados[0]);

    } catch (erro) {
        console.error("[ERRO] Falha na carga de relatórios:", erro);
        corpoTabela.innerHTML = `<tr><td colspan="5" style="color:#ef4444; text-align:center; padding: 20px;">ERRO: ${erro.message}</td></tr>`;
    }
}

function verDetalhes(id) {
    const registro = window.relatoriosCache?.find(
        (r) => String(r.id) === String(id)
    );

    if (!registro) {
        alert("ERRO: Registro não encontrado no cache.");
        return;
    }

    console.log('[DEBUG] verDetalhes - registro completo:', registro);
    console.log('[DEBUG] itens_status raw:', registro.itens_status);

    const modal = document.getElementById("modalDetalhes");
    const container = document.getElementById("containerDesenho");

    // FIX: usar itens_status (v3.0), não itens_conformidade (v2.1)
    let itensHTML = "";
    try {
        const rawItens = registro.itens_status;

        if (!rawItens || rawItens === "undefined" || rawItens === "null") {
            throw new Error("Campo itens_status está vazio ou ausente");
        }

        // Aceita objeto ou string JSON
        const itens = (typeof rawItens === 'object') ? rawItens : JSON.parse(rawItens);

        let countOk = 0;
        let countRuim = 0;

        itensHTML = '<div style="max-height: 300px; overflow-y: auto; background: #0f172a; padding: 15px; border-radius: 8px; margin: 15px 0;">';
        itensHTML += '<h4 style="margin-top: 0; color: #f8fafc;">Itens Verificados:</h4>';
        itensHTML += '<ul style="list-style: none; padding: 0; margin: 0;">';

        for (const [itemNome, itemData] of Object.entries(itens)) {
            const status = itemData.status || "OK";
            const obs = itemData.obs || "";

            if (status === "OK") countOk++;
            else countRuim++;

            const badge = status === "OK" ? "[OK]" : "[RUIM]";
            const corTexto = status === "OK" ? "#10b981" : "#ef4444";

            itensHTML += `
                <li style="padding: 8px 0; border-bottom: 1px solid #334155;">
                    <span style="color: ${corTexto}; font-weight: bold;">${badge} ${itemNome}</span>
                    ${obs ? `<br><small style="color: #94a3b8; margin-left: 25px;">Obs: ${obs}</small>` : ''}
                </li>
            `;
        }

        itensHTML += '</ul>';
        itensHTML += `
            <div style="margin-top: 15px; padding: 10px; background: #0f172a; border-radius: 6px; display: flex; justify-content: space-around;">
                <span style="color: #10b981; font-weight: bold;">Conforme: ${countOk}</span>
                <span style="color: #ef4444; font-weight: bold;">Não Conforme: ${countRuim}</span>
            </div>
        `;
        itensHTML += '</div>';

    } catch (e) {
        console.error("[ERRO] Falha ao parsear itens:", e);
        itensHTML = `<p style="color: #ef4444; padding: 10px; background: #fef2f2; border-radius: 6px;">
            ERRO ao carregar itens do checklist.<br>
            <small>Detalhe: ${e.message}</small>
        </p>`;
    }

    // Rota
    const rotaHTML = `
        <div style="background: rgba(59,130,246,0.12); padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6; margin-bottom: 15px;">
            <h4 style="margin-top: 0; color: #f8fafc;">Rota Informada:</h4>
            <p style="margin: 5px 0;"><strong>Origem:</strong> ${registro.local_origem || '<span style="color: #94a3b8;">Não informado</span>'}</p>
            <p style="margin: 5px 0;"><strong>Destino:</strong> ${registro.local_destino || '<span style="color: #94a3b8;">Não informado</span>'}</p>
        </div>
    `;

    // Mapa de avarias
    const mapaHTML = `
        <div style="margin-top: 15px;">
            <h4 style="color: #f8fafc;">Mapa de Avarias (Lataria):</h4>
            ${registro.mapa_avaria_base64 && registro.mapa_avaria_base64.length > 100
                ? `<img src="${registro.mapa_avaria_base64}"
                       style="max-width:100%; border:2px solid #334155; border-radius:8px;">`
                : '<p style="padding:20px; text-align:center; color:#94a3b8; background: #0f172a; border-radius: 8px;">Nenhuma avaria marcada no mapa</p>'
            }
        </div>
    `;

    container.innerHTML = rotaHTML + itensHTML + mapaHTML;
    modal.style.display = "flex";
}

function fecharModal() {
    document.getElementById("modalDetalhes").style.display = "none";
}

async function verHistoricoVeiculo(event, veiculoId, placa) {
    event.preventDefault();

    if (!veiculoId) {
        alert("ERRO: ID do veículo não disponível");
        return;
    }

    const modal = document.getElementById("modalHistorico");
    const container = document.getElementById("containerHistorico");

    container.innerHTML = '<p style="text-align:center; padding: 40px;">Carregando histórico...</p>';
    modal.style.display = "flex";

    try {
        const token = localStorage.getItem("token");

        const resposta = await fetch(`${CONFIG.API_BASE_URL}/veiculos/${veiculoId}/historico`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (resposta.status === 401) {
            localStorage.clear();
            window.location.href = "login.html";
            return;
        }

        if (!resposta.ok) throw new Error("Erro ao carregar histórico");

        const resultado = await resposta.json();
        const dados = resultado.data || resultado;

        let historicoHTML = `
            <div style="background: rgba(59,130,246,0.12); padding: 15px; border-radius: 8px; margin-bottom: 15px;">
                <h3 style="margin-top: 0; color: #f8fafc;">Veículo: ${dados.veiculo.modelo} (${placa})</h3>
                <p style="margin: 5px 0;"><strong>Total de Inspeções:</strong> ${dados.total}</p>
            </div>
        `;

        if (dados.historico.length === 0) {
            historicoHTML += '<p style="text-align: center; color: #94a3b8;">Nenhuma inspeção registrada para este veículo.</p>';
        } else {
            historicoHTML += '<div style="max-height: 400px; overflow-y: auto;">';
            historicoHTML += '<table style="width: 100%; border-collapse: collapse;">';
            historicoHTML += `
                <thead>
                    <tr style="background: #1e293b; color: white;">
                        <th style="padding: 10px; text-align: left;">Data</th>
                        <th style="padding: 10px; text-align: left;">Motorista</th>
                        <th style="padding: 10px; text-align: left;">KM</th>
                        <th style="padding: 10px; text-align: left;">Rota</th>
                    </tr>
                </thead>
                <tbody>
            `;

            dados.historico.forEach((item, index) => {
                let rawDate = item.data_inspecao;
                if (typeof rawDate === "string" && rawDate.includes(" ")) {
                    rawDate = rawDate.replace(" ", "T");
                }
                const dataObj = rawDate ? new Date(rawDate) : null;
                const dataFormatada = (dataObj && !isNaN(dataObj.getTime()))
                    ? dataObj.toLocaleString("pt-BR")
                    : "Data Inválida";

                const rota = (item.local_origem && item.local_destino)
                    ? `${item.local_origem} → ${item.local_destino}`
                    : "Não informada";

                const bgColor = index % 2 === 0 ? "#1e293b" : "#0f172a";

                historicoHTML += `
                    <tr style="background: ${bgColor};">
                        <td style="padding: 10px;">${dataFormatada}</td>
                        <td style="padding: 10px;">${item.motorista || "N/A"}</td>
                        <td style="padding: 10px;">${item.km_entrada} KM</td>
                        <td style="padding: 10px;"><small>${rota}</small></td>
                    </tr>
                `;
            });

            historicoHTML += '</tbody></table></div>';
        }

        container.innerHTML = historicoHTML;

    } catch (erro) {
        console.error("[ERRO] Falha ao carregar histórico:", erro);
        container.innerHTML = '<p style="color: #ef4444; text-align: center; padding: 40px;">ERRO ao carregar histórico do veículo</p>';
    }
}

function fecharModalHistorico() {
    document.getElementById("modalHistorico").style.display = "none";
}

function abrirModalFuncionario() {
    document.getElementById("modalFuncionario").style.display = "flex";
}

function fecharModalFuncionario() {
    document.getElementById("modalFuncionario").style.display = "none";
    document.getElementById("formFuncionario").reset();
}

document.addEventListener("DOMContentLoaded", () => {
    carregarFuncionarios();
    carregarRelatorios();

    const filtro = document.getElementById("filtroFuncionario");
    if (filtro) {
        filtro.addEventListener("change", (e) => {
            carregarRelatorios(e.target.value || null);
        });
    }

    const formFunc = document.getElementById("formFuncionario");
    if (!formFunc) {
        console.error("[ERRO] Formulário de funcionário não encontrado.");
        return;
    }

    formFunc.addEventListener("submit", async (e) => {
        e.preventDefault();

        const token = localStorage.getItem("token");

        const dados = {
            matricula: document.getElementById("cad_id").value,
            nome: document.getElementById("cad_nome").value,
            cpf: document.getElementById("cad_cpf").value,
            senha: document.getElementById("cad_senha").value,
            nivel_acesso: document.getElementById("cad_cargo").value,
        };

        try {
            const res = await fetch(`${CONFIG.API_BASE_URL}/admin/funcionarios`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(dados),
            });

            if (res.status === 401) {
                localStorage.clear();
                window.location.href = "login.html";
                return;
            }

            const resultado = await res.json();

            if (res.ok) {
                alert("SUCESSO: Funcionário cadastrado com sucesso!");
                fecharModalFuncionario();
                carregarFuncionarios();
                carregarRelatorios();
            } else {
                alert("ERRO no cadastro: " + (resultado.error || "Verifique os dados."));
            }
        } catch (err) {
            console.error("[ERRO] Falha na requisição:", err);
            alert("ERRO: Falha crítica de conexão com o servidor.");
        }
    });
});
