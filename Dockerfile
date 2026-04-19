# syntax=docker/dockerfile:1.7
# =============================================================================
# doa-ops-hub (Next.js 16) — multi-stage build for AMS deployment (Fase 5)
# -----------------------------------------------------------------------------
# - Node 20.18.1-slim (pinned). Alpine evitado: @img/sharp y lightningcss usan
#   binarios glibc; alpine requiere rebuild nativo y es frágil.
# - `output: 'standalone'` ya está configurado en next.config.ts -> el runner
#   sólo necesita /app/.next/standalone + /app/.next/static + /app/public.
# - npm ci desde package-lock.json (no hay pnpm/yarn lock en el repo).
# - Non-root por defecto en la imagen de runtime (uid/gid 1001).
# - Healthcheck dentro de la imagen como fallback; el compose define el real.
# =============================================================================

# ---- deps: instalación de dependencias (cache-friendly) ---------------------
FROM node:20.18.1-slim AS deps
WORKDIR /app

# Copiamos sólo los manifest para maximizar la cache de layers. Cualquier
# cambio de package*.json invalida esta capa; cambios en código fuente no.
COPY package.json package-lock.json ./

# `npm ci --omit=dev` dejaría al builder sin tipos/ESLint; necesitamos TODAS
# las deps para `next build`. El pruning de dev-deps se hace implícitamente
# al copiar sólo el output standalone en la fase runner.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# ---- builder: next build (standalone output) --------------------------------
FROM node:20.18.1-slim AS builder
WORKDIR /app

# Garantizamos que /app/public exista aunque el repo no la tenga (el runner
# hace `COPY --from=builder /app/public ./public` y fallaria si no existe).
# `mkdir -p` es idempotente: si el host ya tiene public/ con contenido, el
# `COPY . .` posterior lo sobreescribe sin problemas.
RUN mkdir -p /app/public

# Reutilizamos las dependencias de la fase anterior.
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Variables build-time. NO meter secrets aquí (quedan embedidos en la imagen).
# NEXT_PUBLIC_* se baken en el bundle del cliente en `next build`. Deben
# declararse como ARG y recibirse por `--build-arg` desde compose (`build.args`).
# La anon key es pública (JWT con role=anon, restringida por RLS).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# next.config.ts tiene `output: 'standalone'` -> esto genera:
#   /app/.next/standalone/server.js   (server wrapper)
#   /app/.next/standalone/node_modules (solo runtime deps, tree-shaken)
#   /app/.next/static                 (assets build-time)
RUN npm run build

# ---- runner: imagen mínima de runtime ---------------------------------------
FROM node:20.18.1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario no-root explícito. Debe coincidir con `user: "1001:1001"` en compose.
# Usamos /usr/sbin/nologin como shell (no se espera login interactivo).
RUN groupadd --system --gid 1001 nextjs \
 && useradd --system --uid 1001 --gid nextjs --home-dir /app --shell /usr/sbin/nologin nextjs

# Copiamos SOLO lo necesario para correr el standalone output.
# Orden: public primero (casi nunca cambia) -> standalone -> static (más volátil).
COPY --from=builder --chown=nextjs:nextjs /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs:nextjs

EXPOSE 3000

# Healthcheck interno — el compose lo sobreescribe con el oficial. Mantenemos
# este aquí como fallback cuando la imagen se corre con `docker run` standalone.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
    CMD node -e "require('http').get('http://127.0.0.1:3000/', r => process.exit(r.statusCode < 500 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]
