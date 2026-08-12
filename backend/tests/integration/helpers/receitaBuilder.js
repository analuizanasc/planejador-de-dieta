'use strict';

// Builder para payloads de receita — evita duplicar objetos literais grandes
// nos testes e deixa explícito o que cada teste está variando.
class ReceitaBuilder {
  constructor() {
    this.payload = {
      nome: 'Receita de teste',
      categoria: 'cafe',
      calorias: 300,
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
    this.payload.categoria = categoria;
    return this;
  }

  comCalorias(calorias) {
    this.payload.calorias = calorias;
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
