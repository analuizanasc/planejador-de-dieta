import { api } from './client';

// Envia o link do post e recebe { draft, avisos, fonte }. O draft NÃO é
// salvo aqui — vai preencher o ReceitaForm para o usuário revisar e salvar
// pelo fluxo normal de criação de receita.
export function importarReceitaDoInstagram(url) {
  return api.post('/receitas/importar-instagram', { url });
}
