import { CategoriaSelo } from './CategoriaSelo';
import { RestricaoTag } from './RestricaoTag';
import { Botao } from './Botao';
import styles from './ReceitaCard.module.css';

export function ReceitaCard({ receita, aoEditar, aoExcluir }) {
  return (
    <article className={styles.card}>
      <div className={styles.topo}>
        <CategoriaSelo categoria={receita.categoria} />
        <span className={`numero-caloria ${styles.calorias}`}>{receita.calorias} kcal</span>
      </div>

      <h3 className={styles.nome}>{receita.nome}</h3>

      <p className={styles.ingredientes}>{receita.ingredientes.join(', ')}</p>

      <div className={styles.rodape}>
        <div className={styles.tags}>
          {receita.tags_restricao.map((tag) => (
            <RestricaoTag key={tag} restricao={tag} />
          ))}
          {receita.permite_repeticao && <span className={styles.repete}>Pode repetir</span>}
        </div>
        <div className={styles.acoes}>
          <Botao variante="fantasma" tamanho="sm" onClick={aoEditar}>
            Editar
          </Botao>
          <Botao variante="perigo" tamanho="sm" onClick={aoExcluir}>
            Excluir
          </Botao>
        </div>
      </div>
    </article>
  );
}
