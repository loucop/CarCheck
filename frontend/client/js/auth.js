// ==========================================
// AUTH.JS v3.0 - Com suporte JWT
// ==========================================

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const matricula = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    // M14: guard de double-submit (login não usa apiFetch — ver obs. no config.js).
    const btnSubmit = e.target.querySelector('button[type="submit"]');
    const restaurarBotao = bloquearBotao(btnSubmit, "⏳ Entrando...");

    // M14: timeout via AbortController — sem isto um login em rede móvel travada
    // pendura para sempre, sem feedback.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
        const resposta = await fetch(`${CONFIG.API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // recebe o cookie httpOnly de sessão (M4)
            body: JSON.stringify({ matricula, senha }),
            signal: controller.signal,
        });

        const dados = await resposta.json();

        if (dados.success) {
            // M4 Fase 2: a sessão agora vive no cookie httpOnly (setado pelo
            // backend na resposta do login). Não guardamos mais o token em
            // localStorage; apenas os dados do usuário p/ a UI (nome, nível).
            localStorage.setItem("usuario", JSON.stringify(dados.data.user));

            window.location.href = "menu.html";
        } else {
            alert(dados.error || "Acesso negado.");
        }
    } catch (err) {
        console.error("Erro na comunicação:", err);
        if (err && err.name === "AbortError") {
            alert("A conexão está lenta ou instável. Verifique sua internet e tente novamente.");
        } else {
            alert("ERRO: Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
        }
    } finally {
        clearTimeout(timer);
        restaurarBotao();
    }
});
