import { RESTRICAO_META } from '../styles/categorias';
import styles from './RestricaoTag.module.css';

// Pílula vinho/beterraba — rótulo de embalagem de alergênico, não alarme.
export function RestricaoTag({ restricao }) {
  const meta = RESTRICAO_META[restricao];
  if (!meta) return null;
  return <span className={styles.tag}>{meta.rotulo}</span>;
}
