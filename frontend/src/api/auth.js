import { api } from './client';

export function registrar({ email, senha, nome }) {
  return api.post('/auth/registrar', { email, senha, nome }, { autenticado: false });
}

export function login({ email, senha }) {
  return api.post('/auth/login', { email, senha }, { autenticado: false });
}
