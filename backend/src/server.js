'use strict';

const { criarConexao } = require('./db/connection');
const criarApp = require('./app');

const PORTA = process.env.PORT || 3000;

const db = criarConexao();
const app = criarApp(db);

app.listen(PORTA, () => {
  console.log(`API do planejador de dieta rodando em http://localhost:${PORTA}`);
});
