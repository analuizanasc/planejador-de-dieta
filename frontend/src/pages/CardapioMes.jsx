import { useMemo, useState } from 'react';
import { useCardapio } from '../hooks/useCardapio';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CategoriaSelo } from '../components/CategoriaSelo';
import { Botao } from '../components/Botao';
import { Alerta } from '../components/Alerta';
import { EstadoCarregando } from '../components/EstadoCarregando';
import { CATEGORIAS_ORDEM } from '../styles/categorias';
import { anoMesAtual, somarMeses, nomeMesExtenso, nomeDiaSemana, diaCurto, listaDeDias } from '../utils/datas';
import styles from './CardapioMes.module.css';

export function CardapioMes() {
  const [anoMes, setAnoMes] = useState(anoMesAtual());
  const { periodo, cardapio, carregando, erro } = useCardapio({ tipo: 'mes', valor: anoMes });

  const dias = useMemo(() => (periodo ? listaDeDias(periodo.inicio, periodo.fim) : []), [periodo]);

  function entradasDoDia(dia) {
    const doD = cardapio.filter((c) => c.dia === dia);
    return CATEGORIAS_ORDEM.filter((cat) => doD.some((c) => c.categoria === cat)).map((cat) =>
      doD.find((c) => c.categoria === cat)
    );
  }

  return (
    <div className={styles.pagina}>
      <CabecalhoPagina
        eyebrow="A despensa do mês"
        titulo="Visão"
        tituloEnfase="mensal."
        acao={
          <div className={styles.navegacao}>
            <Botao variante="secundario" tamanho="sm" onClick={() => setAnoMes((m) => somarMeses(m, -1))}>
              ← Anterior
            </Botao>
            <span className={styles.mesAtual}>{nomeMesExtenso(anoMes)}</span>
            <Botao variante="secundario" tamanho="sm" onClick={() => setAnoMes((m) => somarMeses(m, 1))}>
              Próximo →
            </Botao>
          </div>
        }
      />

      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      {carregando ? (
        <EstadoCarregando texto="Carregando mês…" />
      ) : (
        <div className={styles.lista}>
          {dias.map((dia) => {
            const entradas = entradasDoDia(dia);
            return (
              <div key={dia} className={styles.linha} data-testid={`dia-mes-${dia}`}>
                <div className={styles.data}>
                  <span className={styles.diaNumero}>{diaCurto(dia)}</span>
                  <span className={styles.diaSemana}>{nomeDiaSemana(dia)}</span>
                </div>
                <div className={styles.selos}>
                  {entradas.length === 0 ? (
                    <span className={styles.semCardapio}>Sem cardápio</span>
                  ) : (
                    entradas.map((entrada) => (
                      <span
                        key={entrada.categoria}
                        className={styles.item}
                        data-testid={`item-mes-${entrada.categoria}-${dia}`}
                      >
                        <CategoriaSelo categoria={entrada.categoria} tamanho="sm" />
                        <span className={styles.nomeReceita} data-testid="nome-receita">
                          {entrada.receita.nome}
                        </span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
