import { useEffect, useRef, useState } from 'react';
import { CATEGORIA_META, CATEGORIAS_ORDEM, RESTRICAO_META } from '../styles/categorias';
import { Campo, Input } from './Campo';
import { Select } from './Select';
import { Botao } from './Botao';
import { Alerta } from './Alerta';
import styles from './ReceitaForm.module.css';

const TAMANHO_MAXIMO_IMAGEM = 2 * 1024 * 1024; // 2 MB

// Sempre pelo menos uma linha de ingrediente em branco para o usuário digitar.
function ingredientesIniciais(ingredientes) {
  return ingredientes && ingredientes.length > 0 ? [...ingredientes] : [''];
}

// Aceita o formato novo (categorias: []) e o legado (categoria: string).
function categoriasIniciais(receita) {
  if (Array.isArray(receita?.categorias)) return receita.categorias;
  return receita?.categoria ? [receita.categoria] : [];
}

export function ReceitaForm({ receitaInicial, cadernos = [], aoSalvar, aoCancelar }) {
  const [nome, setNome] = useState(receitaInicial?.nome || '');
  const [categorias, setCategorias] = useState(categoriasIniciais(receitaInicial));
  const [calorias, setCalorias] = useState(receitaInicial?.calorias ?? '');
  const [ingredientes, setIngredientes] = useState(ingredientesIniciais(receitaInicial?.ingredientes));
  const [modoPreparo, setModoPreparo] = useState(receitaInicial?.modo_preparo || '');
  const [imagemUrl, setImagemUrl] = useState(receitaInicial?.imagem_url || null);
  const [cadernoId, setCadernoId] = useState(receitaInicial?.caderno_id ?? '');
  const [tagsRestricao, setTagsRestricao] = useState(receitaInicial?.tags_restricao || []);
  const [permiteRepeticao, setPermiteRepeticao] = useState(receitaInicial?.permite_repeticao || false);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const inputsIngrediente = useRef([]);
  const arquivoRef = useRef(null);
  const [focoIngrediente, setFocoIngrediente] = useState(null);

  useEffect(() => {
    if (focoIngrediente === null) return;
    inputsIngrediente.current[focoIngrediente]?.focus();
    setFocoIngrediente(null);
  }, [focoIngrediente]);

  const opcoesCaderno = [
    { valor: '', rotulo: 'Sem caderno' },
    ...cadernos.map((c) => ({ valor: c.id, rotulo: c.nome })),
  ];

  function alternarRestricao(codigo) {
    setTagsRestricao((atual) =>
      atual.includes(codigo) ? atual.filter((t) => t !== codigo) : [...atual, codigo]
    );
  }

  function alternarCategoria(codigo) {
    setCategorias((atual) =>
      atual.includes(codigo) ? atual.filter((c) => c !== codigo) : [...atual, codigo]
    );
  }

  function mudarIngrediente(indice, valor) {
    setIngredientes((atual) => atual.map((ing, i) => (i === indice ? valor : ing)));
  }

  // Enter cria um novo campo logo abaixo e move o foco para ele.
  function aoTeclarIngrediente(evento, indice) {
    if (evento.key !== 'Enter') return;
    evento.preventDefault();
    setIngredientes((atual) => {
      const proximo = [...atual];
      proximo.splice(indice + 1, 0, '');
      return proximo;
    });
    setFocoIngrediente(indice + 1);
  }

  function removerIngrediente(indice) {
    setIngredientes((atual) => (atual.length === 1 ? [''] : atual.filter((_, i) => i !== indice)));
  }

  function aoSelecionarImagem(evento) {
    const arquivo = evento.target.files?.[0];
    if (!arquivo) return;
    if (arquivo.size > TAMANHO_MAXIMO_IMAGEM) {
      setErro('A imagem é muito grande (máximo 2 MB).');
      return;
    }
    const leitor = new FileReader();
    leitor.onload = () => setImagemUrl(leitor.result);
    leitor.readAsDataURL(arquivo);
  }

  async function aoSubmeter(evento) {
    evento.preventDefault();
    setErro(null);
    const ingredientesLimpos = ingredientes.map((i) => i.trim()).filter(Boolean);
    if (categorias.length === 0) {
      setErro('Selecione ao menos uma categoria.');
      return;
    }
    if (ingredientesLimpos.length === 0) {
      setErro('Informe ao menos um ingrediente.');
      return;
    }
    setSalvando(true);
    try {
      await aoSalvar({
        nome: nome.trim(),
        categorias,
        calorias: calorias === '' ? null : Number(calorias),
        ingredientes: ingredientesLimpos,
        modo_preparo: modoPreparo.trim() || null,
        imagem_url: imagemUrl || null,
        caderno_id: cadernoId === '' ? null : Number(cadernoId),
        tags_restricao: tagsRestricao,
        permite_repeticao: permiteRepeticao,
      });
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={aoSubmeter}>
      {erro && <Alerta tipo="erro">{erro}</Alerta>}

      <Campo rotulo="Nome" id="receita-nome">
        <Input id="receita-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
      </Campo>

      <div>
        <span className={styles.rotuloGrupo}>Categorias (uma ou mais)</span>
        <div className={styles.checkboxes}>
          {CATEGORIAS_ORDEM.map((codigo) => (
            <label key={codigo} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={categorias.includes(codigo)}
                onChange={() => alternarCategoria(codigo)}
                aria-label={CATEGORIA_META[codigo].rotulo}
              />
              {CATEGORIA_META[codigo].rotulo}
            </label>
          ))}
        </div>
      </div>

      <div className={styles.linha}>
        <Campo rotulo="Calorias (opcional)" id="receita-calorias">
          <Input
            id="receita-calorias"
            type="number"
            min="0"
            placeholder="Deixe em branco se não souber"
            value={calorias}
            onChange={(e) => setCalorias(e.target.value)}
          />
        </Campo>
        <Campo rotulo="Caderno" id="receita-caderno">
          <Select valor={cadernoId} aoMudar={setCadernoId} opcoes={opcoesCaderno} />
        </Campo>
      </div>

      <div>
        <span className={styles.rotuloGrupo}>Ingredientes (Enter adiciona outro)</span>
        <div className={styles.ingredientes}>
          {ingredientes.map((ingrediente, indice) => (
            <div key={indice} className={styles.linhaIngrediente}>
              <Input
                ref={(el) => (inputsIngrediente.current[indice] = el)}
                value={ingrediente}
                placeholder={`Ingrediente ${indice + 1}`}
                onChange={(e) => mudarIngrediente(indice, e.target.value)}
                onKeyDown={(e) => aoTeclarIngrediente(e, indice)}
                aria-label={`Ingrediente ${indice + 1}`}
              />
              <Botao
                type="button"
                variante="fantasma"
                tamanho="sm"
                onClick={() => removerIngrediente(indice)}
                aria-label={`Remover ingrediente ${indice + 1}`}
              >
                ×
              </Botao>
            </div>
          ))}
        </div>
      </div>

      <Campo rotulo="Modo de preparo (opcional)" id="receita-modo-preparo">
        <textarea
          id="receita-modo-preparo"
          className={styles.textarea}
          rows={5}
          placeholder="Passo a passo do preparo, um passo por linha."
          value={modoPreparo}
          onChange={(e) => setModoPreparo(e.target.value)}
        />
      </Campo>

      <div>
        <span className={styles.rotuloGrupo}>Imagem (opcional)</span>
        {imagemUrl && (
          <div className={styles.imagemPreview}>
            <img src={imagemUrl} alt="Prévia da receita" />
            <Botao type="button" variante="fantasma" tamanho="sm" onClick={() => setImagemUrl(null)}>
              Remover imagem
            </Botao>
          </div>
        )}
        {/* Input nativo escondido: o botão do app o dispara, mantendo o padrão visual. */}
        <input
          ref={arquivoRef}
          type="file"
          accept="image/*"
          onChange={aoSelecionarImagem}
          className={styles.inputArquivoOculto}
        />
        <Botao type="button" variante="secundario" tamanho="sm" onClick={() => arquivoRef.current?.click()}>
          {imagemUrl ? 'Trocar imagem' : 'Escolher arquivo'}
        </Botao>
      </div>

      <div>
        <span className={styles.rotuloGrupo}>Contém</span>
        <div className={styles.checkboxes}>
          {Object.entries(RESTRICAO_META).map(([codigo, meta]) => (
            <label key={codigo} className={styles.checkbox}>
              <input
                type="checkbox"
                checked={tagsRestricao.includes(codigo)}
                onChange={() => alternarRestricao(codigo)}
              />
              {meta.rotulo}
            </label>
          ))}
        </div>
      </div>

      <label className={styles.checkbox}>
        <input
          type="checkbox"
          checked={permiteRepeticao}
          onChange={(e) => setPermiteRepeticao(e.target.checked)}
        />
        Pode repetir em dias consecutivos
      </label>

      <div className={styles.acoes}>
        <Botao type="button" variante="secundario" onClick={aoCancelar}>
          Cancelar
        </Botao>
        <Botao type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar receita'}
        </Botao>
      </div>
    </form>
  );
}
