import { useCallback, useEffect, useState } from 'react';
import * as cardapioApi from '../api/cardapio';

// `periodo` = { tipo: 'semana', valor: 'YYYY-MM-DD' } | { tipo: 'mes', valor: 'YYYY-MM' }
export function useCardapio(periodo) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const resposta =
        periodo.tipo === 'semana'
          ? await cardapioApi.buscarCardapioSemana(periodo.valor)
          : await cardapioApi.buscarCardapioMes(periodo.valor);
      setDados(resposta);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [periodo.tipo, periodo.valor]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function editarEntrada(dia, categoria, receitaId) {
    const entrada = await cardapioApi.editarEntradaCardapio(dia, categoria, receitaId);
    setDados((atual) => ({
      ...atual,
      cardapio: [...atual.cardapio.filter((c) => !(c.dia === dia && c.categoria === categoria)), entrada],
    }));
    return entrada;
  }

  return { periodo: dados?.periodo, cardapio: dados?.cardapio || [], carregando, erro, recarregar, editarEntrada };
}
