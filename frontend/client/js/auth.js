// ==========================================
// AUTH.JS v3.0 - Com suporte JWT
// ==========================================

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();

    console.log("Iniciando tentativa de login...");

    const matricula = document.getElementById("usuario").value;
    const senha = document.getElementById("senha").value;

    try {
        const resposta = await fetch(`${CONFIG.API_BASE_URL}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ matricula, senha }),
        });

        const dados = await resposta.json();

        if (dados.success) {
            console.log(`Sucesso! Bem-vindo, ${dados.data.user.nome}`);

            // Salva token JWT e dados do usuário
            localStorage.setItem("token", dados.data.token);
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
