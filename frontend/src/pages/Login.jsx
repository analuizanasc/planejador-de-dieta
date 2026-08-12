import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { AuthLayout } from './AuthLayout';
import { Campo, Input } from '../components/Campo';
import { Botao } from '../components/Botao';
import { Alerta } from '../components/Alerta';
import formStyles from './AuthForm.module.css';

export function Login() {
  const { entrar } = useAuth();
  const navegar = useNavigate();
  const local = useLocation();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function aoSubmeter(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await entrar({ email, senha });
      navegar(local.state?.de?.pathname || '/receitas', { replace: true });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout eyebrow="Bem-vinda de volta" titulo="Sua semana," tituloEnfase="em mesa.">
      <form className={formStyles.form} onSubmit={aoSubmeter}>
        {erro && <Alerta tipo="erro">{erro}</Alerta>}
        <Campo rotulo="Email" id="email">
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Senha" id="senha">
          <Input
            id="senha"
            type="password"
            required
            autoComplete="current-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>
        <p className={formStyles.rodape}>
          Ainda não tem conta? <Link to="/registrar">Criar conta</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
