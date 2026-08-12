'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { validarRegistroPayload, validarLoginPayload } = require('../utils/validators');
const { hashSenha, verificarSenha } = require('../utils/senha');
const { gerarToken } = require('../utils/jwt');
const usuariosRepo = require('../repositories/usuariosRepository');

module.exports = function criarRotasAuth(db) {
  const router = express.Router();

  router.post(
    '/registrar',
    asyncHandler(async (req, res) => {
      const dados = validarRegistroPayload(req.body);

      const existente = usuariosRepo.buscarPorEmail(db, dados.email);
      if (existente) {
        throw new AppError(409, 'Email já cadastrado');
      }

      const usuario = usuariosRepo.criarUsuario(db, {
        email: dados.email,
        senhaHash: hashSenha(dados.senha),
        nome: dados.nome,
      });

      res.status(201).json({ id: usuario.id, email: usuario.email, nome: usuario.nome });
    })
  );

  router.post(
    '/login',
    asyncHandler(async (req, res) => {
      const dados = validarLoginPayload(req.body);

      const usuario = usuariosRepo.buscarPorEmail(db, dados.email);
      if (!usuario || !verificarSenha(dados.senha, usuario.senha_hash)) {
        throw new AppError(401, 'Email ou senha inválidos');
      }

      const token = gerarToken(usuario.id);
      res.json({
        token,
        usuario: { id: usuario.id, email: usuario.email, nome: usuario.nome },
      });
    })
  );

  return router;
};
