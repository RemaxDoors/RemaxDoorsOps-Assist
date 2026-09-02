#!/usr/bin/env bash
# Startup command for Linux hosts (Azure App Service: Configuration ->
# General settings -> Startup Command -> "bash start.sh").
#
# The host assigns PORT; next start honours it. NODE_ENV=production matters:
# it is what marks the session cookie Secure and disables the dev auth bypass.
set -euo pipefail

export NODE_ENV=production
PORT="${PORT:-4080}"
export PORT

echo "Operation Help starting on port ${PORT}"

# App Service deploys node_modules with the build in most setups; install only
# when they are genuinely absent, and never pull devDependencies.
if [ ! -d node_modules ]; then
  echo "node_modules missing - installing production dependencies"
  npm ci --omit=dev
fi

if [ ! -d .next ]; then
  echo "ERROR: .next is missing. Run 'npm run build' before deploying." >&2
  exit 1
fi

exec npx next start
