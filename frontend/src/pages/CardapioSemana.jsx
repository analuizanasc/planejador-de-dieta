import { Fragment, useMemo, useState } from 'react';
import { useCardapio } from '../hooks/useCardapio';
import { useGerarCardapio } from '../hooks/useGerarCardapio';
import { useReceitas } from '../hooks/useReceitas';
import { usePreferencias } from '../hooks/usePreferencias';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CelulaCardapio } from '../components/CelulaCardapio';
import { MedidorMeta } from '../components/MedidorMeta';
import { CategoriaSelo } from '../components/CategoriaSelo';
import { Botao } from '../components/Botao';
import { Alerta } from '../components/Alerta';
import { EstadoCarregando } from '../components/EstadoCarregando';
import { CATEGORIA_META, CATEGORIAS_ORDEM } from '../styles/categorias';
import { hojeISO, somarDias, nomeDiaSemana, diaCurto, listaDeDias } from '../utils/datas';
import styles from './CardapioSemana.module.css';

export function CardapioSemana() {
  const [referencia, setReferencia] = useState(hojeISO());
  const { periodo, cardapio, carregando, erro, recarregar, editarEntrada } = useCardapio({
    tipo: 'semana',
    valor: referencia,
  });
  const { preferencias } = usePreferencias();
  const { receitas } = useReceitas();
  const { gerar, gerando, erro: erroGeracao } = useGerarCardapio();
  const [erros, setErros] = useState([]);

  const dias = useMemo(() => (periodo ? listaDeDias(periodo.inicio, periodo.fim) : []), [periodo]);
  const categoriasAtivas = preferencias?.categorias_ativas || [];
  const linhas = CATEGORIAS_ORDEM.filter((c) => categoriasAtivas.includes(c));

  const receitasPorCategoria = useMemo(() => {
    const mapa = {};
    for (const cat of CATEGORIAS_ORDEM) {
      mapa[cat] = receitas.filter((r) => r.categoria === cat).map((r) => ({ valor: r.id, rotulo: r.nome }));
    }
    return mapa;
  }, [receitas]);

  function entradaDe(dia, categoria) {
    return cardapio.find((c) => c.dia === dia && c.categoria === categoria);
  }

  function totalDoDia(dia) {
    return cardapio.filter((c) => c.dia === dia).reduce((soma, c) => soma + c.receita.calorias, 0);
  }

  async function aoGerar() {
    const temEdicaoManual = cardapio.some((c) => c.origem === 'manual');
    if (
      temEdicaoManual &&
      !window.confirm('Este período tem células editadas manualmente. Gerar de novo vai sobrescrevê-las. Continuar?')
    ) {
      return;
    }
    try {
      const resultado = await gerar({ dias });
      setErros(resultado.erros);
      await recarregar();
    } catch {
      // erro já fica exposto via erroGeracao
    }
  }

  return (
    <div className={styles.pagina}>
      <CabecalhoPagina
        eyebrow="O mutirão da semana"
        titulo="Cardápio da"
        tituloEnfase="semana."
        acao={
          <div className={styles.navegacao}>
            <Botao variante="secundario" tamanho="sm" onClick={() => setReferencia((d) => somarDias(d, -7))}>
              ← Anterior
            </Botao>
            <Botao variante="secundario" tamanho="sm" onClick={() => setReferencia((d) => somarDias(d, 7))}>
              Próxima →
            </Botao>
            <Botao tamanho="sm" onClick={aoGerar} disabled={gerando}>
              {gerando ? 'Gerando…' : 'Gerar cardápio automático'}
            </Botao>
          </div>
        }
      />

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {erroGeracao && <Alerta tipo="erro">{erroGeracao}</Alerta>}
      {erros.length > 0 && (
        <Alerta tipo="aviso">
          {erros.length} categoria(s) sem receita compatível: {erros.map((e) => `${e.dia} (${CATEGORIA_META[e.categoria]?.rotulo})`).join(', ')}
        </Alerta>
      )}

      {carregando || !periodo ? (
        <EstadoCarregando texto="Carregando cardápio…" />
      ) : linhas.length === 0 ? (
        <Alerta tipo="aviso">Nenhuma categoria ativa nas preferências ainda.</Alerta>
      ) : (
        <div className={styles.grade} style={{ '--colunas': dias.length }}>
          <div className={styles.celulaCabecalho} />
          {dias.map((dia) => (
            <div key={dia} className={styles.cabecalhoDia}>
              <span className={styles.diaSemana}>{nomeDiaSemana(dia)}</span>
              <span className={styles.diaNumero}>{diaCurto(dia)}</span>
              {preferencias?.meta_calorica && (
                <MedidorMeta total={totalDoDia(dia)} meta={preferencias.meta_calorica} />
              )}
            </div>
          ))}

          {linhas.map((categoria) => (
            <Fragment key={categoria}>
              <div className={styles.rotuloLinha}>
                <CategoriaSelo categoria={categoria} />
              </div>
              {dias.map((dia) => {
                const entrada = entradaDe(dia, categoria);
                const erroCelula = erros.find((e) => e.dia === dia && e.categoria === categoria);
                return (
                  <CelulaCardapio
                    key={`${dia}-${categoria}`}
                    dia={dia}
                    categoria={categoria}
                    entrada={entrada}
                    motivoErro={erroCelula?.motivo}
                    opcoesReceita={receitasPorCategoria[categoria]}
                    aoEditar={(receitaId) => editarEntrada(dia, categoria, receitaId)}
                  />
                );
              })}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}
