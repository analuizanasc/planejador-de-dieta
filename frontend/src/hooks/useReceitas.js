import { useCallback, useEffect, useState } from 'react';
import * as receitasApi from '../api/receitas';

export function useReceitas() {
  const [receitas, setReceitas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setReceitas(await receitasApi.listarReceitas());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function criar(dados) {
    const nova = await receitasApi.criarReceita(dados);
    setReceitas((atual) => [...atual, nova]);
    return nova;
  }

  async function atualizar(id, dados) {
    const atualizada = await receitasApi.atualizarReceita(id, dados);
    setReceitas((atual) => atual.map((r) => (r.id === id ? atualizada : r)));
    return atualizada;
  }

  async function excluir(id) {
    await receitasApi.excluirReceita(id);
    setReceitas((atual) => atual.filter((r) => r.id !== id));
  }

  return { receitas, carregando, erro, recarregar, criar, atualizar, excluir };
}
