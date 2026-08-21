import { useCallback, useEffect, useState } from 'react';
import * as cadernosApi from '../api/cadernos';

export function useCadernos() {
  const [cadernos, setCadernos] = useState([]);
  const [erro, setErro] = useState(null);

  const recarregar = useCallback(async () => {
    try {
      setCadernos(await cadernosApi.listarCadernos());
    } catch (e) {
      setErro(e.message);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function criar(nome) {
    const novo = await cadernosApi.criarCaderno(nome);
    setCadernos((atual) => [...atual, novo].sort((a, b) => a.nome.localeCompare(b.nome)));
    return novo;
  }

  async function excluir(id) {
    await cadernosApi.excluirCaderno(id);
    setCadernos((atual) => atual.filter((c) => c.id !== id));
  }

  return { cadernos, erro, recarregar, criar, excluir };
}
