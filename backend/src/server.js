'use strict';

require('dotenv').config();

const { criarConexao } = require('./db/connection');
const criarApp = require('./app');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não definido. Configure a variável de ambiente antes de iniciar.');
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.warn(
    'GEMINI_API_KEY não definido: a importação de receitas do Instagram ficará indisponível ' +
      '(as demais rotas funcionam normalmente).'
  );
}

const PORTA = process.env.PORT || 3000;

const db = criarConexao();
const app = criarApp(db);

app.listen(PORTA, () => {
  console.log(`API do planejador de dieta rodando em http://localhost:${PORTA}`);
});
