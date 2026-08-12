import { useState } from 'react';
import * as cardapioApi from '../api/cardapio';

export function useGerarCardapio() {
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState(null);

  async function gerar(payload) {
    setGerando(true);
    setErro(null);
    try {
      return await cardapioApi.gerarCardapio(payload);
    } catch (e) {
      setErro(e.message);
      throw e;
    } finally {
      setGerando(false);
    }
  }

  return { gerar, gerando, erro };
}
