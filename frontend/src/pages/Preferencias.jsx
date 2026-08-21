import { useEffect, useState } from 'react';
import { usePreferencias } from '../hooks/usePreferencias';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { Botao } from '../components/Botao';
import { Alerta } from '../components/Alerta';
import { EstadoCarregando } from '../components/EstadoCarregando';
import { CATEGORIA_META, CATEGORIAS_ORDEM, RESTRICAO_META } from '../styles/categorias';
import styles from './Preferencias.module.css';

export function Preferencias() {
  const { preferencias, carregando, erro, salvando, salvar } = usePreferencias();
  const [categoriasAtivas, setCategoriasAtivas] = useState([]);
  const [restricoes, setRestricoes] = useState([]);
  const [metaCalorica, setMetaCalorica] = useState('');
  const [mensagem, setMensagem] = useState(null);

  useEffect(() => {
    if (!preferencias) return;
    setCategoriasAtivas(preferencias.categorias_ativas);
    setRestricoes(preferencias.restricoes);
    setMetaCalorica(preferencias.meta_calorica ?? '');
  }, [preferencias]);

  function alternar(lista, definir, valor) {
    definir(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
  }

  async function aoSalvar() {
    setMensagem(null);
    try {
      await salvar({
        categorias_ativas: categoriasAtivas,
        restricoes,
        meta_calorica: metaCalorica === '' ? null : Number(metaCalorica),
      });
      setMensagem({ tipo: 'sucesso', texto: 'Preferências salvas.' });
    } catch (e) {
      setMensagem({ tipo: 'erro', texto: e.message });
    }
  }

  if (carregando) return <EstadoCarregando texto="Carregando preferências…" />;
  if (erro) return <Alerta tipo="erro">{erro}</Alerta>;

  return (
    <div className={styles.pagina}>
      <CabecalhoPagina eyebrow="Como você quer comer" titulo="Suas" tituloEnfase="preferências." />

      {mensagem && <Alerta tipo={mensagem.tipo}>{mensagem.texto}</Alerta>}

      <section className={styles.secao}>
        <h2 className={styles.tituloSecao}>Categorias ativas por dia</h2>
        <p className={styles.descricao}>Café, almoço e jantar são obrigatórios por padrão. Lanche é opcional.</p>
        <div className={styles.pilulas}>
          {CATEGORIAS_ORDEM.map((cat) => {
            const ativa = categoriasAtivas.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                className={`${styles.pilula} ${ativa ? styles.pilulaAtiva : ''}`}
                onClick={() => alternar(categoriasAtivas, setCategoriasAtivas, cat)}
              >
                {CATEGORIA_META[cat].rotulo}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.secao}>
        <h2 className={styles.tituloSecao}>Restrições alimentares</h2>
        <p className={styles.descricao}>O cardápio nunca vai sugerir receitas com essas restrições.</p>
        <div className={styles.pilulas}>
          {Object.entries(RESTRICAO_META).map(([codigo, meta]) => {
            const ativa = restricoes.includes(codigo);
            return (
              <button
                key={codigo}
                type="button"
                className={`${styles.pilula} ${ativa ? styles.pilulaRestricao : ''}`}
                onClick={() => alternar(restricoes, setRestricoes, codigo)}
              >
                {meta.rotulo}
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.secao}>
        <h2 className={styles.tituloSecao}>Meta calórica diária</h2>
        <p className={styles.descricao}>Opcional. O gerador aproxima o total do dia dessa meta, sem ultrapassar.</p>
        <div className={styles.metaLinha}>
          <input
            type="number"
            min="1"
            placeholder="Sem meta definida"
            className={styles.metaInput}
            value={metaCalorica}
            onChange={(e) => setMetaCalorica(e.target.value)}
          />
          <span className={styles.metaUnidade}>kcal / dia</span>
        </div>
      </section>

      <Botao onClick={aoSalvar} disabled={salvando} className={styles.botaoSalvar}>
        {salvando ? 'Salvando…' : 'Salvar preferências'}
      </Botao>
    </div>
  );
}
