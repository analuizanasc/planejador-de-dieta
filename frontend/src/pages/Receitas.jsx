import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useReceitas } from '../hooks/useReceitas';
import { useCadernos } from '../hooks/useCadernos';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { ReceitaCard } from '../components/ReceitaCard';
import { ReceitaForm } from '../components/ReceitaForm';
import { Botao } from '../components/Botao';
import { Alerta } from '../components/Alerta';
import { EstadoCarregando } from '../components/EstadoCarregando';
import { EstadoVazio } from '../components/EstadoVazio';
import styles from './Receitas.module.css';

// Sentinelas do filtro por caderno (além de um id numérico de caderno).
const TODAS = 'todas';
const SEM_CADERNO = 'sem-caderno';

export function Receitas() {
  const { receitas, carregando, erro, recarregar, criar, atualizar, excluir } = useReceitas();
  const cadernosHook = useCadernos();
  const { cadernos } = cadernosHook;
  const navigate = useNavigate();
  const [painelAberto, setPainelAberto] = useState(false);
  const [receitaEmEdicao, setReceitaEmEdicao] = useState(null);
  const [filtro, setFiltro] = useState(TODAS);

  const receitasVisiveis = useMemo(() => {
    if (filtro === TODAS) return receitas;
    if (filtro === SEM_CADERNO) return receitas.filter((r) => r.caderno_id == null);
    return receitas.filter((r) => r.caderno_id === filtro);
  }, [receitas, filtro]);

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

  async function novoCaderno() {
    const nome = window.prompt('Nome do novo caderno:');
    if (!nome || !nome.trim()) return;
    try {
      const novo = await cadernosHook.criar(nome.trim());
      setFiltro(novo.id);
    } catch (e) {
      window.alert(e.message);
    }
  }

  async function excluirCadernoAtual() {
    const caderno = cadernos.find((c) => c.id === filtro);
    if (!caderno) return;
    if (!window.confirm(`Excluir o caderno "${caderno.nome}"? As receitas continuam salvas, sem caderno.`)) return;
    try {
      await cadernosHook.excluir(caderno.id);
      await recarregar();
      setFiltro(TODAS);
    } catch (e) {
      window.alert(e.message);
    }
  }

  const filtros = [
    { valor: TODAS, rotulo: 'Todas' },
    { valor: SEM_CADERNO, rotulo: 'Sem caderno' },
    ...cadernos.map((c) => ({ valor: c.id, rotulo: c.nome })),
  ];

  return (
    <div className={styles.pagina}>
      <CabecalhoPagina
        eyebrow="A despensa de receitas"
        titulo="Suas"
        tituloEnfase="receitas."
        acao={
          !painelAberto && (
            <div className={styles.acoesCabecalho}>
              <Botao variante="secundario" onClick={() => navigate('/receitas/importar')}>
                Importar de vídeo
              </Botao>
              <Botao onClick={abrirCriacao}>Nova receita</Botao>
            </div>
          )
        }
      />

      <div className={styles.cadernos}>
        {filtros.map((f) => (
          <button
            key={f.valor}
            type="button"
            className={`${styles.chip} ${filtro === f.valor ? styles.chipAtivo : ''}`}
            onClick={() => setFiltro(f.valor)}
          >
            {f.rotulo}
          </button>
        ))}
        <button type="button" className={styles.chipNovo} onClick={novoCaderno}>
          + Caderno
        </button>
        {typeof filtro === 'number' && (
          <button type="button" className={styles.chipExcluir} onClick={excluirCadernoAtual}>
            Excluir caderno
          </button>
        )}
      </div>

      {painelAberto && (
        <ReceitaForm
          receitaInicial={receitaEmEdicao}
          cadernos={cadernos}
          aoSalvar={salvar}
          aoCancelar={fecharPainel}
        />
      )}

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      {carregando ? (
        <EstadoCarregando texto="Carregando receitas…" />
      ) : receitasVisiveis.length === 0 ? (
        <EstadoVazio
          titulo={filtro === TODAS ? 'Nenhuma receita cadastrada ainda' : 'Nenhuma receita neste caderno'}
          descricao="Cadastre receitas de café, almoço, jantar e lanche para começar a gerar seu cardápio."
          acao={!painelAberto && <Botao onClick={abrirCriacao}>Cadastrar receita</Botao>}
        />
      ) : (
        <div className={styles.grade}>
          {receitasVisiveis.map((receita) => (
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
