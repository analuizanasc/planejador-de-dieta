import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Botao } from './Botao';
import styles from './Nav.module.css';

const LINKS = [
  { para: '/receitas', rotulo: 'Receitas' },
  { para: '/preferencias', rotulo: 'Preferências' },
  { para: '/cardapio/semana', rotulo: 'Semana' },
  { para: '/cardapio/mes', rotulo: 'Mês' },
];

export function Nav() {
  const { usuario, sair } = useAuth();

  return (
    <header className={styles.barra}>
      <span className={styles.marca}>Mesa</span>

      <nav className={styles.links}>
        {LINKS.map((link) => (
          <NavLink
            key={link.para}
            to={link.para}
            className={({ isActive }) => `${styles.link} ${isActive ? styles.ativo : ''}`}
          >
            {link.rotulo}
          </NavLink>
        ))}
      </nav>

      <div className={styles.usuario}>
        <span className={styles.nomeUsuario}>{usuario?.nome}</span>
        <Botao variante="fantasma" tamanho="sm" onClick={sair}>
          Sair
        </Botao>
      </div>
    </header>
  );
}
