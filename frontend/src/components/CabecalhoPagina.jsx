import styles from './CabecalhoPagina.module.css';

export function CabecalhoPagina({ eyebrow, titulo, tituloEnfase, acao }) {
  return (
    <div className={styles.raiz}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1 className={styles.titulo}>
          {titulo} {tituloEnfase && <em>{tituloEnfase}</em>}
        </h1>
      </div>
      {acao}
    </div>
  );
}
