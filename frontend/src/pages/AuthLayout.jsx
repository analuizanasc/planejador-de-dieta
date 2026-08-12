import styles from './AuthLayout.module.css';

export function AuthLayout({ eyebrow, titulo, tituloEnfase, children }) {
  return (
    <div className={styles.raiz}>
      <div className={styles.cartao}>
        <span className={`eyebrow ${styles.eyebrow}`}>{eyebrow}</span>
        <h1 className={styles.titulo}>
          {titulo} <em>{tituloEnfase}</em>
        </h1>
        {children}
      </div>
    </div>
  );
}
