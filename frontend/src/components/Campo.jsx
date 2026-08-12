import styles from './Campo.module.css';

export function Campo({ rotulo, erro, dica, children, id }) {
  return (
    <label className={styles.campo} htmlFor={id}>
      <span className={styles.rotulo}>{rotulo}</span>
      {children}
      {erro ? <span className={styles.erro}>{erro}</span> : dica ? <span className={styles.dica}>{dica}</span> : null}
    </label>
  );
}

export function Input(props) {
  return <input className={styles.input} {...props} />;
}
