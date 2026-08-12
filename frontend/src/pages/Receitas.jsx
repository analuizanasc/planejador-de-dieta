import { useState } from 'react';
import { useReceitas } from '../hooks/useReceitas';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { ReceitaCard } from '../components/ReceitaCard';
import { ReceitaForm } from '../components/ReceitaForm';
import { Botao } from '../components/Botao';
import { Alerta } from '../components/Alerta';
import { EstadoCarregando } from '../components/EstadoCarregando';
import { EstadoVazio } from '../components/EstadoVazio';
import styles from './Receitas.module.css';

export function Receitas() {
  const { receitas, carregando, erro, criar, atualizar, excluir } = useReceitas();
  const [painelAberto, setPainelAberto] = useState(false);
  const [receitaEmEdicao, setReceitaEmEdicao] = useState(null);

  function abrirCriacao() {
    setReceitaEmEdicao(null);
    setPainelAberto(true);
  }

  function abrirEdicao(receita) {
    setReceitaEmEdicao(receita);
    setPainelAberto(true);
  }

  function fecharPainel() {
    setPainelAberto(false);
    setReceitaEmEdicao(null);
  }

  async function salvar(dados) {
    if (receitaEmEdicao) {
      await atualizar(receitaEmEdicao.id, dados);
    } else {
      await criar(dados);
    }
    fecharPainel();
  }

  async function aoExcluir(receita) {
    if (!window.confirm(`Excluir "${receita.nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await excluir(receita.id);
    } catch (e) {
      window.alert(e.message);
    }
  }

  return (
    <div className={styles.pagina}>
      <CabecalhoPagina
        eyebrow="A despensa de receitas"
        titulo="Suas"
        tituloEnfase="receitas."
        acao={!painelAberto && <Botao onClick={abrirCriacao}>Nova receita</Botao>}
      />

      {painelAberto && (
        <ReceitaForm receitaInicial={receitaEmEdicao} aoSalvar={salvar} aoCancelar={fecharPainel} />
      )}

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      {carregando ? (
        <EstadoCarregando texto="Carregando receitas…" />
      ) : receitas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma receita cadastrada ainda"
          descricao="Cadastre receitas de café, almoço, jantar e lanche para começar a gerar seu cardápio."
          acao={!painelAberto && <Botao onClick={abrirCriacao}>Cadastrar primeira receita</Botao>}
        />
      ) : (
        <div className={styles.grade}>
          {receitas.map((receita) => (
            <ReceitaCard
              key={receita.id}
              receita={receita}
              aoEditar={() => abrirEdicao(receita)}
              aoExcluir={() => aoExcluir(receita)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
