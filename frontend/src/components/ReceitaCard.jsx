import { useState } from 'react';
import { CategoriaSelo } from './CategoriaSelo';
import { RestricaoTag } from './RestricaoTag';
import { Botao } from './Botao';
import styles from './ReceitaCard.module.css';

// Spec do grid de receitas (opção 1a): a faixa de restrições mostra no máximo
// 2 tags; o excedente vira um chip "+N" — nunca cresce a altura do card.
const MAX_TAGS_VISIVEIS = 2;

export function ReceitaCard({ receita, aoEditar, aoExcluir }) {
  // onError da imagem: cai para o estado sem foto mantendo os 132px, sem salto.
  const [imagemFalhou, setImagemFalhou] = useState(false);
  const temImagem = Boolean(receita.imagem_url) && !imagemFalhou;

  const tagsVisiveis = receita.tags_restricao.slice(0, MAX_TAGS_VISIVEIS);
  const tagsExcedentes = receita.tags_restricao.length - tagsVisiveis.length;
  const inicial = receita.nome.trim().charAt(0).toUpperCase();

  return (
    <article className={styles.card} data-testid="receita-card">
      <div
        className={`${styles.midia} ${temImagem ? '' : styles.midiaVazia}`}
        data-inicial={inicial}
      >
        {temImagem && (
          <img
            className={styles.imagem}
            src={receita.imagem_url}
            alt={receita.nome}
            loading="lazy"
            decoding="async"
            onError={() => setImagemFalhou(true)}
          />
        )}
      </div>

      <div className={styles.corpo}>
        <div className={styles.meta}>
          <div className={styles.selos}>
            {receita.categorias.map((categoria) => (
              <CategoriaSelo key={categoria} categoria={categoria} tamanho="sm" />
            ))}
          </div>
          <span className={`numero-caloria ${styles.calorias}`}>
            {receita.calorias != null ? `${receita.calorias} kcal` : 'sem calorias'}
          </span>
        </div>

        {/* title com o nome completo: tooltip e acessibilidade quando corta em 2 linhas. */}
        <h3 className={styles.nome} title={receita.nome}>
          {receita.nome}
        </h3>

        <div className={styles.tags}>
          {tagsVisiveis.map((tag) => (
            <RestricaoTag key={tag} restricao={tag} />
          ))}
          {tagsExcedentes > 0 && <span className={styles.maisTags}>+{tagsExcedentes}</span>}
        </div>

        <div className={styles.espacador} />

        <div className={styles.rodape}>
          {receita.permite_repeticao && <span className={styles.repete}>Pode repetir</span>}
          <div className={styles.acoes}>
            <Botao variante="fantasma" tamanho="sm" onClick={aoEditar}>
              Editar
            </Botao>
            <Botao variante="perigo" tamanho="sm" onClick={aoExcluir}>
              Excluir
            </Botao>
          </div>
        </div>
      </div>
    </article>
  );
}
