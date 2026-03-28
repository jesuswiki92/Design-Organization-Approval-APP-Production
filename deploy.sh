#!/bin/bash
set -e

echo "🚀 Deploying DOA Operations Hub..."

git add -A
git commit -m "deploy: $(date '+%Y-%m-%d %H:%M')" --allow-empty
git push origin main

ssh -i ~/.ssh/id_ed25519 -o StrictHostKeyChecking=no root@145.223.116.37 << 'ENDSSH'
  cd /root/apps/doa-ops-hub
  git pull origin main
  if [ -f .env.production ]; then
    cp .env.production .env.local
  fi
  docker compose build --no-cache
  docker compose up -d
  docker compose ps
ENDSSH

echo "✅ Deploy complete! App running at http://145.223.116.37:3010"
