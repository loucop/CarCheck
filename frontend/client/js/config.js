const CONFIG = {
  API_BASE_URL: 'http://10.10.1.100:3000/api'
};

// M14: teto de tempo p/ toda chamada. Numa rede móvel que pendura (túnel,
// elevador, zona morta) o fetch esperaria indefinidamente e o motorista não
// saberia se enviou; o AbortController corta e devolve um erro acionável.
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * apiFetch — wrapper único para chamadas autenticadas à API (M4 Fase 2).
 *
 * - Injeta `credentials:'include'` para o cookie httpOnly de sessão viajar em
 *   toda requisição (substitui o header Authorization + token de localStorage).
 * - Define `Content-Type: application/json` por padrão (sobrescrevível via opts).
 * - Centraliza o tratamento de 401: limpa o usuário e volta ao login.
 * - M14: aplica um timeout via `AbortController` (`opts.timeoutMs`, padrão 20s).
 *   No estouro, lança um Error com `isTimeout === true` e uma mensagem amigável
 *   — o chamador pode exibir `err.message` no lugar do erro genérico.
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
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...fetchOpts } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let resp;
  try {
    resp = await fetch(`${CONFIG.API_BASE_URL}${path}`, {
      ...fetchOpts,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(fetchOpts.headers || {})
      }
    });
  } catch (err) {
    // Abort do nosso timer → erro de timeout amigável; senão, propaga o de rede.
    if (err && err.name === 'AbortError') {
      const timeoutErr = new Error(
        'A conexão está lenta ou instável. Verifique sua internet e tente novamente.'
      );
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }

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

/**
 * bloquearBotao — guard de double-submit (M14). Desabilita o botão e troca o
 * texto por um estado "ocupado" enquanto uma ação assíncrona está em voo;
 * retorna uma função que restaura o estado original (chamar no `finally`).
 * Numa rede lenta o motorista toca o botão de novo achando que travou, o que
 * gera request duplicado — isto o impede na UI (os guards de banco são a rede
 * final). `btn` pode ser null (ex.: chamada programática): vira um no-op.
 */
function bloquearBotao(btn, textoOcupado) {
  if (!btn) return function () {};
  const htmlOriginal = btn.innerHTML;
  const estavaDesabilitado = btn.disabled;
  btn.disabled = true;
  if (textoOcupado) btn.innerHTML = textoOcupado;
  return function restaurar() {
    btn.disabled = estavaDesabilitado;
    btn.innerHTML = htmlOriginal;
  };
}
