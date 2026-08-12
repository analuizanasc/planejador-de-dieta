import styles from './Alerta.module.css';

export function Alerta({ tipo = 'erro', children }) {
  return (
    <div className={`${styles.alerta} ${styles[tipo]}`} role={tipo === 'erro' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
