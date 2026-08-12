import { useState } from 'react';
import { CategoriaSelo } from './CategoriaSelo';
import { Select } from './Select';
import styles from './CelulaCardapio.module.css';

// A célula guarda a assinatura visual do produto: sublinhado ondulado quando
// a entrada veio de PUT /cardapio/:dia/:categoria (origem === 'manual'), em
// vez de geração automática — informação real vinda do backend, não estado
// local (por isso sobrevive a reload).
export function CelulaCardapio({ dia, categoria, entrada, motivoErro, opcoesReceita, aoEditar }) {
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const testId = `celula-${categoria}-${dia}`;

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
      <div className={styles.celula} data-testid={testId}>
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
      <button
        type="button"
        className={`${styles.celula} ${styles.vazia}`}
        onClick={() => setEditando(true)}
        title={motivoErro}
        data-testid={testId}
      >
        <CategoriaSelo categoria={categoria} tamanho="sm" />
        <span className={styles.textoVazio}>Sem opção compatível</span>
      </button>
    );
  }

  return (
    <button type="button" className={styles.celula} onClick={() => setEditando(true)} data-testid={testId}>
      <CategoriaSelo categoria={categoria} tamanho="sm" />
      <span
        className={`${styles.nomeReceita} ${entrada.origem === 'manual' ? styles.editadaManualmente : ''}`}
        data-testid="nome-receita"
        data-origem={entrada.origem}
      >
        {entrada.receita.nome}
      </span>
      <span className={`numero-caloria ${styles.calorias}`}>{entrada.receita.calorias} kcal</span>
    </button>
  );
}
