import { api } from './client';

export function listarCadernos() {
  return api.get('/cadernos');
}

export function criarCaderno(nome) {
  return api.post('/cadernos', { nome });
}

export function excluirCaderno(id) {
  return api.delete(`/cadernos/${id}`);
}
