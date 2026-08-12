import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../api/client';
import { AuthLayout } from './AuthLayout';
import { Campo, Input } from '../components/Campo';
import { Botao } from '../components/Botao';
import { Alerta } from '../components/Alerta';
import formStyles from './AuthForm.module.css';

export function Registro() {
  const { registrar } = useAuth();
  const navegar = useNavigate();
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function aoSubmeter(evento) {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await registrar({ nome, email, senha });
      navegar('/receitas', { replace: true });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : 'Não foi possível criar a conta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <AuthLayout eyebrow="Comece por aqui" titulo="Sua cozinha," tituloEnfase="organizada.">
      <form className={formStyles.form} onSubmit={aoSubmeter}>
        {erro && <Alerta tipo="erro">{erro}</Alerta>}
        <Campo rotulo="Nome" id="nome">
          <Input id="nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
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
        <Campo rotulo="Senha" id="senha" dica="Ao menos 8 caracteres">
          <Input
            id="senha"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </Campo>
        <Botao type="submit" disabled={enviando}>
          {enviando ? 'Criando conta…' : 'Criar conta'}
        </Botao>
        <p className={formStyles.rodape}>
          Já tem conta? <Link to="/entrar">Entrar</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
