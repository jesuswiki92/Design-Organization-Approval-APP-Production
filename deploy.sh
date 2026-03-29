#!/bin/bash
set -euo pipefail

echo "🚀 Deploying DOA Operations Hub..."

if [ -n "$(git status --porcelain)" ]; then
  echo "Working tree is dirty. Commit or stash changes before deploying."
  exit 1
fi

current_branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$current_branch" != "main" ]; then
  echo "deploy.sh must be run from branch 'main'. Current branch: $current_branch"
  exit 1
fi

git push origin main

ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@145.223.116.37 << 'ENDSSH'
  set -e
  cd /root/apps/doa-ops-hub
  git fetch origin main
  git reset --hard origin/main
  if [ -f .env.production ]; then
    cp .env.production .env.local
  fi
  docker compose build --no-cache
  docker compose up -d
  docker compose ps
ENDSSH

echo "✅ Deploy complete! App running at http://145.223.116.37:3010"
