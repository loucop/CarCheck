// ==========================================
// CHECKLIST.JS v3.0 - Com JWT e Debug
// ==========================================

const itensChecklist = [
  "Buzina", 
  "Cinto de Segurança", 
  "Quebra-sol", 
  "Retrovisor Interno",
  "Retrovisor – Direito / Esquerdo", 
  "Limpador de Para-brisas",
  "Limpador de Para-brisas Traseiro", 
  "Farol Baixo", 
  "Farol Alto",
  "Meia Luz", 
  "Luz de Freio", 
  "Luz de Ré", 
  "Luz da Placa",
  "Luzes do Painel", 
  "Seta – Direita / Esquerda", 
  "Pisca Alerta",
  "Luz Interna", 
  "Velocímetro / Tacógrafo", 
  "Freios", 
  "Macaco",
  "Chave de Roda", 
  "Triângulo de Sinalização",
  "Portas – Travas", 
  "Alarme", 
  "Fechamento das Janelas", 
  "Para-brisas",
  "Óleo do Motor", 
  "Óleo de Freio", 
  "Nível da Água do Radiador",
  "Pneus (Estado / Calibragem)", 
  "Pneu Reserva (Estepe)",
  "Bancos (Encosto / Assentos)", 
  "Para-choque Dianteiro",
  "Para-choque Traseiro", 
  "Lataria",
];

const imgVeiculo = new Image();
imgVeiculo.crossOrigin = "Anonymous";

const canvas = document.getElementById("canvasAvaria");
const ctx = canvas.getContext("2d");
let drawing = false;

function inicializarCanvas() {
  // veiculo.png é estático — sem cache-buster, deixa o navegador cachear (B23).
  imgVeiculo.src = `${CONFIG.API_BASE_URL.replace('/api', '')}/veiculo.png`;

  imgVeiculo.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgVeiculo, 0, 0, canvas.width, canvas.height);
  };

  imgVeiculo.onerror = () => {
    console.error("[❌] Erro ao carregar veiculo.png");
  };
}

function desenhar(clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const scaleX = canvas.width / r.width;
  const scaleY = canvas.height / r.height;
  const x = (clientX - r.left) * scaleX;
  const y = (clientY - r.top) * scaleY;

  ctx.fillStyle = "red";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

canvas.addEventListener("mousedown", () => (drawing = true));
canvas.addEventListener("mouseup", () => (drawing = false));
canvas.addEventListener("mousemove", (e) => {
  if (drawing) desenhar(e.clientX, e.clientY);
});

canvas.addEventListener("touchstart", (e) => {
  drawing = true;
  const touch = e.touches[0];
  desenhar(touch.clientX, touch.clientY);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchmove", (e) => {
  if (!drawing) return;
  const touch = e.touches[0];
  desenhar(touch.clientX, touch.clientY);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener("touchend", () => (drawing = false));

function limparCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (imgVeiculo.complete) ctx.drawImage(imgVeiculo, 0, 0, canvas.width, canvas.height);
}

function renderizarItens() {
  const container = document.getElementById("listaItens");
  container.innerHTML = itensChecklist.map(item => `
    <div class="item-row" data-item="${item}">
      <span>${item}</span>
      <div class="status-btns">
        <button type="button" class="btn-opt" onclick="setStatus(this, 'OK')">OK</button>
        <button type="button" class="btn-opt" onclick="setStatus(this, 'RUIM')">RUIM</button>
      </div>
      <input type="text" class="obs-field" placeholder="Descreva o problema..." style="display:none">
    </div>
  `).join("");
}

function setStatus(btn, status) {
  const row = btn.closest(".item-row");
  const btns = row.querySelectorAll(".btn-opt");
  const obs = row.querySelector(".obs-field");
  btns.forEach(b => b.classList.remove("active-ok", "active-ruim"));

  if (status === "OK") {
    btn.classList.add("active-ok");
    obs.style.display = "none";
  } else {
    btn.classList.add("active-ruim");
    obs.style.display = "block";
  }
}

function inicializarPagina() {
  renderizarItens();
  inicializarCanvas();

  const dadosSessao = localStorage.getItem("usuario");
  if (!dadosSessao) {
    alert("Sessão expirada. Faça login novamente.");
    window.location.href = "login.html";
    return;
  }

  const user = JSON.parse(dadosSessao);
  const placa = localStorage.getItem("veiculo_atual");
  const veiculoId = localStorage.getItem("veiculo_id");

  if (!veiculoId) {
    document.getElementById("placa-topo").innerHTML =
      '<span style="color: #ef4444;">⚠️ SELECIONE UM VEÍCULO</span>';
  } else {
    document.getElementById("placa-topo").innerText = `Veículo: ${placa}`;
  }

  document.getElementById("motorista").value = user.nome || "";
  document.getElementById("matricula").value = user.matricula || "";
  
  const dataDisplay = document.getElementById("data-display");
  if (dataDisplay) {
    dataDisplay.innerText = `Data: ${new Date().toLocaleString("pt-BR")}`;
  }
}

async function finalizarRelatorio(event) {
  if (event) event.preventDefault();

  // M14: captura o botão ANTES do 1º await (o browser zera currentTarget depois)
  // p/ o guard de double-submit.
  const btn = event && event.currentTarget;

  // M4 Fase 2: guard por presença de `usuario`; a sessão real vive no cookie.
  if (!localStorage.getItem("usuario")) {
    alert("Sessão expirada. Faça login novamente.");
    window.location.href = "login.html";
    return;
  }

  const kmInput = document.getElementById("km").value;
  const veiculoId = parseInt(localStorage.getItem("veiculo_id"));
  const user = JSON.parse(localStorage.getItem("usuario") || "{}");

  const matricula = String(user.matricula);

  // VALIDAÇÕES
  if (isNaN(veiculoId)) {
    alert("❌ ERRO: Veículo não selecionado.");
    return;
  }
  if (!kmInput) {
    alert("❌ ERRO: Informe o KM atual.");
    return;
  }
  if (!matricula) {
    alert("❌ ERRO: Matrícula não encontrada. Faça login novamente.");
    return;
  }

  const statusDosItens = {};
  document.querySelectorAll(".item-row").forEach((row) => {
    const itemNome = row.dataset.item;
    statusDosItens[itemNome] = {
      status: row.querySelector(".active-ruim") ? "RUIM" : "OK",
      obs: row.querySelector(".obs-field").value.trim()
    };
  });

  const canvasData = canvas.toDataURL("image/png");

  const payload = {
    veiculo_id: veiculoId,
    matricula: matricula,
    km_entrada: parseInt(kmInput),
    local_origem: document.getElementById("local_origem")?.value || "",
    local_destino: document.getElementById("local_destino")?.value || "",
    itens_status: statusDosItens,
    mapa_avaria_base64: canvasData,
  };

  // M14: guard de double-submit — desabilita o botão pela duração do POST.
  const restaurarBotao = bloquearBotao(btn, "⏳ Enviando...");

  try {
    // M4 Fase 2: cookie httpOnly via apiFetch (Content-Type JSON é padrão);
    // 401 é tratado centralmente por apiFetch (limpa estado + redireciona).
    const resposta = await apiFetch("/checklist", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    const resultado = await resposta.json();

    if (resposta.ok) {
      alert("✅ Checklist registrado com sucesso!");
      const usuario = JSON.parse(localStorage.getItem('usuario') || '{}');
      const destino = usuario.nivel_acesso === 'motorista' ? 'bdv.html' : 'menu.html';
      history.replaceState(null, '', destino);
      window.location.replace(destino);
    } else {
      console.error('[ERRO] Detalhes:', resultado);
      alert(`❌ Erro: ${resultado.error || JSON.stringify(resultado)}`);
    }
  } catch (erro) {
    // 401 já tratado por apiFetch (redirect ao login em curso) — não alertar.
    if (erro && erro.isAuthRedirect) return;
    console.error("Erro de rede:", erro);
    // M14: mensagem específica de timeout ("rede lenta") vs. erro genérico.
    alert(erro && erro.isTimeout ? `❌ ${erro.message}` : "❌ Erro de comunicação com o servidor.");
  } finally {
    // M14: reabilita o botão (idempotente; no sucesso a página já navegou).
    restaurarBotao();
  }
}

function voltarSelecao() {
  if (confirm("⚠️ Deseja realmente voltar? Dados não salvos serão perdidos.")) {
    window.location.href = "selecao.html";
  }
}

window.onload = inicializarPagina;
