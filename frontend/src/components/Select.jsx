import { useEffect, useRef, useState } from 'react';
import styles from './Select.module.css';

// Dropdown custom simples: <select> nativo não é estilizável (skill
// interface-design). Sem typeahead — escopo proporcional ao projeto.
export function Select({ valor, aoMudar, opcoes, placeholder = 'Selecione…', desabilitado = false }) {
  const [aberto, setAberto] = useState(false);
  const [indiceAtivo, setIndiceAtivo] = useState(-1);
  const raizRef = useRef(null);

  const selecionada = opcoes.find((o) => o.valor === valor);

  useEffect(() => {
    function aoClicarFora(evento) {
      if (raizRef.current && !raizRef.current.contains(evento.target)) {
        setAberto(false);
      }
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  function abrir() {
    if (desabilitado) return;
    setIndiceAtivo(Math.max(0, opcoes.findIndex((o) => o.valor === valor)));
    setAberto(true);
  }

  function escolher(opcao) {
    aoMudar(opcao.valor);
    setAberto(false);
  }

  function aoTeclar(evento) {
    if (!aberto) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(evento.key)) {
        evento.preventDefault();
        abrir();
      }
      return;
    }
    if (evento.key === 'Escape') {
      setAberto(false);
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setIndiceAtivo((i) => Math.min(opcoes.length - 1, i + 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setIndiceAtivo((i) => Math.max(0, i - 1));
    } else if (evento.key === 'Enter' || evento.key === ' ') {
      evento.preventDefault();
      if (opcoes[indiceAtivo]) escolher(opcoes[indiceAtivo]);
    }
  }

  return (
    <div className={styles.raiz} ref={raizRef}>
      <button
        type="button"
        className={styles.gatilho}
        onClick={() => (aberto ? setAberto(false) : abrir())}
        onKeyDown={aoTeclar}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        disabled={desabilitado}
      >
        <span className={selecionada ? undefined : styles.placeholder}>
          {selecionada ? selecionada.rotulo : placeholder}
        </span>
        <span className={styles.seta} aria-hidden="true">
          ▾
        </span>
      </button>

      {aberto && (
        <ul className={styles.lista} role="listbox" tabIndex={-1}>
          {opcoes.length === 0 && <li className={styles.vazio}>Nenhuma opção disponível</li>}
          {opcoes.map((opcao, indice) => (
            <li
              key={opcao.valor}
              role="option"
              aria-selected={opcao.valor === valor}
              className={[
                styles.opcao,
                indice === indiceAtivo ? styles.ativa : '',
                opcao.valor === valor ? styles.selecionada : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onMouseEnter={() => setIndiceAtivo(indice)}
              onClick={() => escolher(opcao)}
            >
              {opcao.rotulo}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
