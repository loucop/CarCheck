const CONFIG = {
  API_BASE_URL: 'http://10.10.1.100:3000/api'
};

/**
 * apiFetch — wrapper único para chamadas autenticadas à API (M4 Fase 2).
 *
 * - Injeta `credentials:'include'` para o cookie httpOnly de sessão viajar em
 *   toda requisição (substitui o header Authorization + token de localStorage).
 * - Define `Content-Type: application/json` por padrão (sobrescrevível via opts).
 * - Centraliza o tratamento de 401: limpa o usuário e volta ao login.
 *
 * `path` é relativo a API_BASE_URL (ex.: '/veiculos'). Retorna o objeto
 * Response — o chamador faz `.json()`/`.ok` como antes. Em 401, redireciona e
 * lança um Error com `isAuthRedirect === true` — o chamador pode checar essa
 * flag no catch p/ pular alertas de erro genéricos (o redirect já está em curso).
 *
 * Obs.: o login (auth.js) NÃO usa este helper — um 401 lá é credencial inválida
 * e deve exibir o erro, não redirecionar.
 */
async function apiFetch(path, opts = {}) {
  const resp = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
    ...opts,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(opts.headers || {})
    }
  });

  if (resp.status === 401) {
    // Sessão ausente/expirada: limpa estado local e volta ao login.
    localStorage.removeItem('usuario');
    localStorage.removeItem('token'); // legado pré-M4 — remove se ainda existir
    if (!window.location.pathname.endsWith('login.html')) {
      window.location.href = 'login.html';
    }
    const err = new Error('Não autenticado (401)');
    err.isAuthRedirect = true; // sinaliza ao catch do chamador: redirect já em curso
    err.status = 401;
    throw err;
  }

  return resp;
}
