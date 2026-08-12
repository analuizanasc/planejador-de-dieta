'use strict';

require('dotenv').config();

const { criarConexao } = require('./db/connection');
const criarApp = require('./app');

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET não definido. Configure a variável de ambiente antes de iniciar.');
  process.exit(1);
}

const PORTA = process.env.PORT || 3000;

const db = criarConexao();
const app = criarApp(db);

app.listen(PORTA, () => {
  console.log(`API do planejador de dieta rodando em http://localhost:${PORTA}`);
});
