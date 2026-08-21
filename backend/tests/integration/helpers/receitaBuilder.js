'use strict';

// Builder para payloads de receita — evita duplicar objetos literais grandes
// nos testes e deixa explícito o que cada teste está variando.
class ReceitaBuilder {
  constructor() {
    this.payload = {
      nome: 'Receita de teste',
      categorias: ['cafe'],
      calorias: 300,
      modo_preparo: null,
      imagem_url: null,
      caderno_id: null,
      ingredientes: ['ingrediente'],
      tags_restricao: [],
      permite_repeticao: false,
    };
  }

  comNome(nome) {
    this.payload.nome = nome;
    return this;
  }

  comCategoria(categoria) {
    this.payload.categorias = [categoria];
    return this;
  }

  comCategorias(categorias) {
    this.payload.categorias = categorias;
    return this;
  }

  comCalorias(calorias) {
    this.payload.calorias = calorias;
    return this;
  }

  semCalorias() {
    this.payload.calorias = null;
    return this;
  }

  comModoPreparo(modo) {
    this.payload.modo_preparo = modo;
    return this;
  }

  comImagem(url) {
    this.payload.imagem_url = url;
    return this;
  }

  noCaderno(id) {
    this.payload.caderno_id = id;
    return this;
  }

  comIngredientes(ingredientes) {
    this.payload.ingredientes = ingredientes;
    return this;
  }

  comTagsRestricao(tags) {
    this.payload.tags_restricao = tags;
    return this;
  }

  permiteRepeticao(valor = true) {
    this.payload.permite_repeticao = valor;
    return this;
  }

  build() {
    return { ...this.payload };
  }
}

function umaReceita() {
  return new ReceitaBuilder();
}

module.exports = { umaReceita };
