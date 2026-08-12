import styles from './EstadoCarregando.module.css';

export function EstadoCarregando({ texto = 'Carregando…' }) {
  return (
    <div className={styles.raiz} role="status" aria-live="polite">
      <span className={styles.anel} />
      <span>{texto}</span>
    </div>
  );
}
