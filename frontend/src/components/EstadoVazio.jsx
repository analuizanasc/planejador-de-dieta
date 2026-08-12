import styles from './EstadoVazio.module.css';

export function EstadoVazio({ titulo, descricao, acao }) {
  return (
    <div className={styles.raiz}>
      <p className={styles.titulo}>{titulo}</p>
      {descricao && <p className={styles.descricao}>{descricao}</p>}
      {acao}
    </div>
  );
}
