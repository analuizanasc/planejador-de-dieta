import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import styles from './ComboBox.module.css';

// Busca insensível a acento e caixa — "pao" acha "Pão", "cafe" acha "Café".
function normalizar(texto) {
  return (texto || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Combobox com digitação (typeahead) e agrupamento por caderno. Cada opção é
// { valor, rotulo, grupo }; o usuário filtra digitando parte do nome da receita
// OU do caderno, e escolhe direto da lista agrupada.
export function ComboBox({ valor, aoMudar, opcoes, placeholder = 'Buscar…', desabilitado = false }) {
  const [aberto, setAberto] = useState(false);
  const [busca, setBusca] = useState('');
  const [indiceAtivo, setIndiceAtivo] = useState(0);
  const raizRef = useRef(null);

  const selecionada = opcoes.find((o) => o.valor === valor);

  useEffect(() => {
    function aoClicarFora(evento) {
      if (raizRef.current && !raizRef.current.contains(evento.target)) setAberto(false);
    }
    document.addEventListener('mousedown', aoClicarFora);
    return () => document.removeEventListener('mousedown', aoClicarFora);
  }, []);

  const filtradas = useMemo(() => {
    const termo = normalizar(busca.trim());
    if (!termo) return opcoes;
    return opcoes.filter(
      (o) => normalizar(o.rotulo).includes(termo) || normalizar(o.grupo).includes(termo)
    );
  }, [opcoes, busca]);

  // Agrupa por caderno preservando a ordem de aparição do grupo.
  const grupos = useMemo(() => {
    const mapa = new Map();
    for (const opcao of filtradas) {
      const chave = opcao.grupo || '';
      if (!mapa.has(chave)) mapa.set(chave, []);
      mapa.get(chave).push(opcao);
    }
    return [...mapa.entries()];
  }, [filtradas]);

  function escolher(opcao) {
    aoMudar(opcao.valor);
    setAberto(false);
  }

  function aoTeclar(evento) {
    if (!aberto) {
      if (['ArrowDown', 'Enter'].includes(evento.key)) setAberto(true);
      return;
    }
    if (evento.key === 'Escape') {
      setAberto(false);
    } else if (evento.key === 'ArrowDown') {
      evento.preventDefault();
      setIndiceAtivo((i) => Math.min(filtradas.length - 1, i + 1));
    } else if (evento.key === 'ArrowUp') {
      evento.preventDefault();
      setIndiceAtivo((i) => Math.max(0, i - 1));
    } else if (evento.key === 'Enter') {
      evento.preventDefault();
      if (filtradas[indiceAtivo]) escolher(filtradas[indiceAtivo]);
    }
  }

  return (
    <div className={styles.raiz} ref={raizRef}>
      <input
        type="text"
        role="combobox"
        aria-expanded={aberto}
        aria-autocomplete="list"
        className={styles.campo}
        placeholder={placeholder}
        value={aberto ? busca : selecionada?.rotulo ?? ''}
        disabled={desabilitado}
        onFocus={() => {
          setBusca('');
          setIndiceAtivo(0);
          setAberto(true);
        }}
        onChange={(evento) => {
          setBusca(evento.target.value);
          setIndiceAtivo(0);
          setAberto(true);
        }}
        onKeyDown={aoTeclar}
      />

      {aberto && (
        <ul className={styles.lista} role="listbox">
          {filtradas.length === 0 && <li className={styles.vazio}>Nenhuma receita encontrada</li>}
          {grupos.map(([grupo, itens]) => (
            <Fragment key={grupo || '_'}>
              {grupo && (
                <li className={styles.grupo} role="presentation">
                  {grupo}
                </li>
              )}
              {itens.map((opcao) => {
                const indiceGlobal = filtradas.indexOf(opcao);
                return (
                  <li
                    key={opcao.valor}
                    role="option"
                    aria-selected={opcao.valor === valor}
                    className={[
                      styles.opcao,
                      indiceGlobal === indiceAtivo ? styles.ativa : '',
                      opcao.valor === valor ? styles.selecionada : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onMouseEnter={() => setIndiceAtivo(indiceGlobal)}
                    onMouseDown={(evento) => evento.preventDefault()}
                    onClick={() => escolher(opcao)}
                  >
                    {opcao.rotulo}
                  </li>
                );
              })}
            </Fragment>
          ))}
        </ul>
      )}
    </div>
  );
}
