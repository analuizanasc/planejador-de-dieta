import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { Campo, Input } from '../components/Campo';
import { Botao } from '../components/Botao';
import { Alerta } from '../components/Alerta';
import { EstadoCarregando } from '../components/EstadoCarregando';
import { ReceitaForm } from '../components/ReceitaForm';
import { useCadernos } from '../hooks/useCadernos';
import { importarReceitaDoInstagram } from '../api/receitasImportacao';
import { criarReceita } from '../api/receitas';
import styles from './ImportarReceita.module.css';

const MENSAGEM_FONTE = {
  legenda: 'Rascunho gerado a partir da legenda do post. Confira e ajuste antes de salvar.',
  'legenda+video':
    'Rascunho gerado a partir da legenda e do vídeo do post. Confira e ajuste antes de salvar.',
  youtube: 'Rascunho gerado a partir do vídeo do YouTube. Confira e ajuste antes de salvar.',
  descricao:
    'Rascunho gerado a partir da descrição do vídeo do YouTube. Confira e ajuste antes de salvar.',
};

export function ImportarReceita() {
  const navigate = useNavigate();
  const { cadernos } = useCadernos();
  const [url, setUrl] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [resultado, setResultado] = useState(null); // { draft, avisos, fonte }

  async function aoImportar(evento) {
    evento.preventDefault();
    setErro(null);
    setCarregando(true);
    try {
      const dados = await importarReceitaDoInstagram(url.trim());
      setResultado(dados);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  async function salvar(dados) {
    await criarReceita(dados);
    navigate('/receitas');
  }

  function recomecar() {
    setResultado(null);
    setErro(null);
  }

  return (
    <div className={styles.pagina}>
      <CabecalhoPagina
        eyebrow="Do feed para a despensa"
        titulo="Importar"
        tituloEnfase="receita."
      />

      {!resultado && (
        <form className={styles.form} onSubmit={aoImportar}>
          <p className={styles.explicacao}>
            Cole o link de um post/reel do Instagram ou de um vídeo do YouTube. A gente lê a
            legenda e o vídeo e monta um rascunho para você conferir antes de salvar.
          </p>

          <Campo
            rotulo="Link do vídeo ou post"
            id="import-url"
            dica="Instagram (post/reel) ou YouTube (vídeo/short)"
          >
            <Input
              id="import-url"
              type="url"
              required
              placeholder="https://www.instagram.com/reel/…  ou  https://youtu.be/…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={carregando}
            />
          </Campo>

          {erro && (
            <Alerta tipo="erro">
              {erro}{' '}
              <Link to="/receitas" className={styles.link}>
                Cadastrar manualmente
              </Link>
            </Alerta>
          )}

          <div className={styles.acoes}>
            <Botao type="submit" disabled={carregando}>
              Analisar link
            </Botao>
          </div>
        </form>
      )}

      {carregando && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Analisando link">
          <div className={styles.dialog}>
            <EstadoCarregando texto="Buscando e analisando o post… isso pode levar alguns instantes." />
          </div>
        </div>
      )}

      {resultado && (
        <div className={styles.revisao}>
          <Alerta tipo={resultado.fonte === 'legenda' ? 'aviso' : 'sucesso'}>
            {MENSAGEM_FONTE[resultado.fonte] || MENSAGEM_FONTE.legenda}
          </Alerta>

          {resultado.avisos?.map((aviso, i) => (
            <Alerta key={i} tipo="aviso">
              {aviso}
            </Alerta>
          ))}

          <ReceitaForm
            receitaInicial={resultado.draft}
            cadernos={cadernos}
            aoSalvar={salvar}
            aoCancelar={recomecar}
          />
        </div>
      )}
    </div>
  );
}
