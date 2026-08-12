import { CATEGORIA_META } from '../styles/categorias';
import styles from './CategoriaSelo.module.css';

// Assinatura do produto: mesma cor+ícone da categoria em toda a UI (lista de
// receitas, grade semanal, visão mensal) — como rótulos de potes de tempero.
export function CategoriaSelo({ categoria, tamanho = 'md' }) {
  const meta = CATEGORIA_META[categoria];
  if (!meta) return null;
  const { Icone, rotulo, cor, fundo } = meta;

  return (
    <span
      className={`${styles.selo} ${styles[tamanho]}`}
      style={{ '--cor-selo': cor, '--fundo-selo': fundo }}
    >
      <Icone className={styles.icone} />
      {rotulo}
    </span>
  );
}
