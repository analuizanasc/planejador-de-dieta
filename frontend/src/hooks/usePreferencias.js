import { useCallback, useEffect, useState } from 'react';
import * as preferenciasApi from '../api/preferencias';

export function usePreferencias() {
  const [preferencias, setPreferencias] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPreferencias(await preferenciasApi.buscarPreferencias());
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  async function salvar(dados) {
    const anterior = preferencias;
    setSalvando(true);
    setErro(null);
    try {
      const atualizada = await preferenciasApi.atualizarPreferencias(dados);
      setPreferencias(atualizada);
      return atualizada;
    } catch (e) {
      setPreferencias(anterior);
      setErro(e.message);
      throw e;
    } finally {
      setSalvando(false);
    }
  }

  return { preferencias, carregando, erro, salvando, salvar };
}
