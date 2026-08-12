import { api } from './client';

export function buscarPreferencias() {
  return api.get('/preferencias');
}

export function atualizarPreferencias(dados) {
  return api.put('/preferencias', dados);
}
