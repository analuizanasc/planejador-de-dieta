#!/usr/bin/env bash
# better-sqlite3 é um binário nativo compilado contra a ABI do Node ativo na
# instalação (hoje, Node 21.7.1) — rodar sob outra major quebra com
# ERR_DLOPEN_FAILED (NODE_MODULE_VERSION incompatível). Usado pelo Playwright
# (e2e/) para orquestrar backend (Node 21) e frontend (Node 22) juntos sem
# depender da versão de Node ativa no shell que disparou os testes.
set -e
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "/opt/homebrew/opt/nvm/nvm.sh"
nvm use 21 >/dev/null
cd "$(dirname "$0")/.."
exec npm run start
