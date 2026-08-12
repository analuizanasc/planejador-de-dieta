import styles from './Botao.module.css';

export function Botao({ variante = 'primario', tamanho = 'md', className = '', ...props }) {
  const classes = [styles.botao, styles[variante], styles[tamanho], className].filter(Boolean).join(' ');
  return <button className={classes} {...props} />;
}
