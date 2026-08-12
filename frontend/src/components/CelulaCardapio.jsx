import { useState } from 'react';
import { CategoriaSelo } from './CategoriaSelo';
import { Select } from './Select';
import styles from './CelulaCardapio.module.css';

// A célula guarda a assinatura visual do produto: sublinhado ondulado quando
// a entrada veio de PUT /cardapio/:dia/:categoria (origem === 'manual'), em
// vez de geração automática — informação real vinda do backend, não estado
// local (por isso sobrevive a reload).
export function CelulaCardapio({ categoria, entrada, motivoErro, opcoesReceita, aoEditar }) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  async function aoEscolher(receitaId) {
    setSalvando(true);
    try {
      await aoEditar(Number(receitaId));
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <div className={styles.celula}>
        <Select
          valor={entrada?.receita.id}
          aoMudar={aoEscolher}
          opcoes={opcoesReceita}
          placeholder={salvando ? 'Salvando…' : 'Escolher receita'}
          desabilitado={salvando}
        />
      </div>
    );
  }

  if (!entrada) {
    return (
      <button type="button" className={`${styles.celula} ${styles.vazia}`} onClick={() => setEditando(true)} title={motivoErro}>
        <CategoriaSelo categoria={categoria} tamanho="sm" />
        <span className={styles.textoVazio}>Sem opção compatível</span>
      </button>
    );
  }

  return (
    <button type="button" className={styles.celula} onClick={() => setEditando(true)}>
      <CategoriaSelo categoria={categoria} tamanho="sm" />
      <span className={`${styles.nomeReceita} ${entrada.origem === 'manual' ? styles.editadaManualmente : ''}`}>
        {entrada.receita.nome}
      </span>
      <span className={`numero-caloria ${styles.calorias}`}>{entrada.receita.calorias} kcal</span>
    </button>
  );
}
