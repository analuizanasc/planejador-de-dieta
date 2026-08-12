import { useState } from 'react';
import { CATEGORIA_META, CATEGORIAS_ORDEM, RESTRICAO_META } from '../styles/categorias';
import { Campo, Input } from './Campo';
import { Select } from './Select';
import { Botao } from './Botao';
import { Alerta } from './Alerta';
import styles from './ReceitaForm.module.css';

const OPCOES_CATEGORIA = CATEGORIAS_ORDEM.map((c) => ({ valor: c, rotulo: CATEGORIA_META[c].rotulo }));

function paraTexto(ingredientes) {
  return (ingredientes || []).join('\n');
}

function paraLista(texto) {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function ReceitaForm({ receitaInicial, aoSalvar, aoCancelar }) {
  const [nome, setNome] = useState(receitaInicial?.nome || '');
  const [categoria, setCategoria] = useState(receitaInicial?.categoria || 'cafe');
  const [calorias, setCalorias] = useState(receitaInicial?.calorias ?? '');
  const [ingredientesTexto, setIngredientesTexto] = useState(paraTexto(receitaInicial?.ingredientes));
  const [tagsRestricao, setTagsRestricao] = useState(receitaInicial?.tags_restricao || []);
  const [permiteRepeticao, setPermiteRepeticao] = useState(receitaInicial?.permite_repeticao || false);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  function alternarRestricao(codigo) {
    setTagsRestricao((atual) =>
      atual.includes(codigo) ? atual.filter((t) => t !== codigo) : [...atual, codigo]
    );
  }

  async function aoSubmeter(evento) {
    evento.preventDefault();
    setErro(null);
    const ingredientes = paraLista(ingredientesTexto);
    if (ingredientes.length === 0) {
      setErro('Informe ao menos um ingrediente (um por linha).');
      return;
    }
    setSalvando(true);
    try {
      await aoSalvar({
        nome: nome.trim(),
        categoria,
        calorias: Number(calorias),
        ingredientes,
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

      <div className={styles.linha}>
        <Campo rotulo="Nome" id="receita-nome">
          <Input id="receita-nome" required value={nome} onChange={(e) => setNome(e.target.value)} />
        </Campo>
        <Campo rotulo="Categoria" id="receita-categoria">
          <Select valor={categoria} aoMudar={setCategoria} opcoes={OPCOES_CATEGORIA} />
        </Campo>
      </div>

      <Campo rotulo="Calorias" id="receita-calorias">
        <Input
          id="receita-calorias"
          type="number"
          min="0"
          required
          value={calorias}
          onChange={(e) => setCalorias(e.target.value)}
        />
      </Campo>

      <Campo rotulo="Ingredientes (um por linha)" id="receita-ingredientes">
        <textarea
          id="receita-ingredientes"
          className={styles.textarea}
          rows={4}
          value={ingredientesTexto}
          onChange={(e) => setIngredientesTexto(e.target.value)}
        />
      </Campo>

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
