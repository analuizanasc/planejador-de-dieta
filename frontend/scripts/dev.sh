#!/usr/bin/env bash
# O frontend precisa de Node >=20.19 (Vite 8 / React Router 7) — o backend
# fica no Node 21.7.1 local, então usamos Node 22 via nvm só aqui.
set -e
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
. "/opt/homebrew/opt/nvm/nvm.sh"
nvm use 22 >/dev/null
cd "$(dirname "$0")/.."
exec npm run dev
