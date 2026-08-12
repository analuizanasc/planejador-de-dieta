import styles from './MedidorMeta.module.css';

export function MedidorMeta({ total, meta }) {
  const proporcao = Math.min(1, total / meta);
  const estourou = total > meta;

  return (
    <div className={styles.raiz}>
      <div className={styles.trilho}>
        <div
          className={`${styles.preenchimento} ${estourou ? styles.estourou : ''}`}
          style={{ width: `${proporcao * 100}%` }}
        />
      </div>
      <span className={`numero-caloria ${styles.legenda}`}>
        {total} / {meta} kcal
      </span>
    </div>
  );
}
