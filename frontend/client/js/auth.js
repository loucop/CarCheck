// ==========================================
// AUTH.JS v3.0 - Com suporte JWT
// ==========================================

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    const matricula = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    try {
        const resposta = await fetch(`${CONFIG.API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // recebe o cookie httpOnly de sessão (M4)
            body: JSON.stringify({ matricula, senha }),
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
        alert("ERRO: Não foi possível conectar ao servidor. Verifique se o backend está rodando.");
    }
});
