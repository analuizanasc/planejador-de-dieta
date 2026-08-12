import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { obterToken, definirToken, definirCallbackSessaoExpirada } from '../api/client';
import { login as loginApi, registrar as registrarApi } from '../api/auth';

const AuthContext = createContext(null);

const CHAVE_USUARIO = 'planejador-dieta:usuario';

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const salvo = localStorage.getItem(CHAVE_USUARIO);
    return salvo ? JSON.parse(salvo) : null;
  });
  const [token, setTokenState] = useState(() => obterToken());

  const sair = useCallback(() => {
    definirToken(null);
    localStorage.removeItem(CHAVE_USUARIO);
    setTokenState(null);
    setUsuario(null);
  }, []);

  useEffect(() => {
    definirCallbackSessaoExpirada(sair);
  }, [sair]);

  function aplicarSessao({ token: novoToken, usuario: novoUsuario }) {
    definirToken(novoToken);
    localStorage.setItem(CHAVE_USUARIO, JSON.stringify(novoUsuario));
    setTokenState(novoToken);
    setUsuario(novoUsuario);
  }

  async function entrar({ email, senha }) {
    const resposta = await loginApi({ email, senha });
    aplicarSessao(resposta);
  }

  async function registrar({ email, senha, nome }) {
    await registrarApi({ email, senha, nome });
    await entrar({ email, senha });
  }

  return (
    <AuthContext.Provider value={{ usuario, token, autenticado: Boolean(token), entrar, registrar, sair }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth precisa estar dentro de um AuthProvider');
  return contexto;
}
