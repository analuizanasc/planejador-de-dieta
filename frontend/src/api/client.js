const BASE_URL = import.meta.env.VITE_API_URL || '/api';
const CHAVE_TOKEN = 'planejador-dieta:token';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

let aoExpirarSessao = null;
export function definirCallbackSessaoExpirada(callback) {
  aoExpirarSessao = callback;
}

export function obterToken() {
  return localStorage.getItem(CHAVE_TOKEN);
}

export function definirToken(token) {
  if (token) localStorage.setItem(CHAVE_TOKEN, token);
  else localStorage.removeItem(CHAVE_TOKEN);
}

async function requisitar(caminho, { method = 'GET', body, autenticado = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (autenticado) {
    const token = obterToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let resposta;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique sua conexão.');
  }

  if (resposta.status === 204) return null;

  const corpo = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    if (resposta.status === 401 && autenticado) {
      definirToken(null);
      aoExpirarSessao?.();
    }
    throw new ApiError(resposta.status, corpo.erro || 'Erro inesperado.');
  }

  return corpo;
}

export const api = {
  get: (caminho, opcoes) => requisitar(caminho, { ...opcoes, method: 'GET' }),
  post: (caminho, body, opcoes) => requisitar(caminho, { ...opcoes, method: 'POST', body }),
  put: (caminho, body, opcoes) => requisitar(caminho, { ...opcoes, method: 'PUT', body }),
  delete: (caminho, opcoes) => requisitar(caminho, { ...opcoes, method: 'DELETE' }),
};
