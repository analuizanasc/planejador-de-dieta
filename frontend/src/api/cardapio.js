import { api } from './client';

export function buscarCardapioSemana(semana) {
  return api.get(`/cardapio?semana=${semana}`);
}

export function buscarCardapioMes(mes) {
  return api.get(`/cardapio?mes=${mes}`);
}

export function gerarCardapio(payload) {
  return api.post('/cardapio/gerar', payload);
}

export function editarEntradaCardapio(dia, categoria, receitaId) {
  return api.put(`/cardapio/${dia}/${categoria}`, { receita_id: receitaId });
}
