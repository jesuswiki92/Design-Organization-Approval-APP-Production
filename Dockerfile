# Stage 1: Install dependencies
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Stage 2: Build the application
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time public env vars. Pass via --build-arg NEXT_PUBLIC_SUPABASE_URL=...
# These ARE safe to bake into the bundle because they are public by design
# (NEXT_PUBLIC_* is emitted to the client). NEVER pass secrets like
# SUPABASE_SERVICE_ROLE_KEY here — those stay runtime-only via
# docker-compose.swarm.yml / service update --env-add (see obs #115, #130).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL

# Build-provenance ARGs — injected by deploy.sh. Allow the image to self-report
# which commit it contains via /api/build-info. Defaults to "unknown" so local
# `docker build` without these args still succeeds.
ARG GIT_SHA=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_TIME=unknown
ARG IMAGE_TAG=unknown

ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_GIT_BRANCH=$GIT_BRANCH
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
ENV NEXT_PUBLIC_IMAGE_TAG=$IMAGE_TAG
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Re-declare the provenance ARGs in the runner stage so they can be promoted
# into runtime ENVs and LABELs (ARGs do not cross stage boundaries in BuildKit).
ARG GIT_SHA=unknown
ARG GIT_BRANCH=unknown
ARG BUILD_TIME=unknown
ARG IMAGE_TAG=unknown

# Runtime ENVs so the running container can echo back what it is.
ENV NEXT_PUBLIC_GIT_SHA=$GIT_SHA
ENV NEXT_PUBLIC_GIT_BRANCH=$GIT_BRANCH
ENV NEXT_PUBLIC_BUILD_TIME=$BUILD_TIME
ENV NEXT_PUBLIC_IMAGE_TAG=$IMAGE_TAG

# OCI labels — `docker image inspect` can be used to verify provenance
# without even starting the container.
LABEL org.opencontainers.image.revision="$GIT_SHA"
LABEL org.opencontainers.image.ref.name="$IMAGE_TAG"
LABEL org.opencontainers.image.created="$BUILD_TIME"
LABEL org.opencontainers.image.source="https://github.com/jesuswiki92/Design-Organization-Approval-APP-Production"

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/build-info" >/dev/null || exit 1

CMD ["node", "server.js"]
