import { api } from './client';

export function listarReceitas(categoria) {
  const query = categoria ? `?categoria=${categoria}` : '';
  return api.get(`/receitas${query}`);
}

export function criarReceita(dados) {
  return api.post('/receitas', dados);
}

export function atualizarReceita(id, dados) {
  return api.put(`/receitas/${id}`, dados);
}

export function excluirReceita(id) {
  return api.delete(`/receitas/${id}`);
}
