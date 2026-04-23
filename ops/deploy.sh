#!/usr/bin/env bash
# ============================================================================
# DOA Operations Hub - canonical VPS deploy script
# ============================================================================
#
# This script is the ONLY authorised way to deploy doa-ops-hub. Do not run
# ad-hoc `docker build` / `docker service update` from bash history — they
# bypass the verification steps below and have already caused one production
# regression (see docs/deploy.md for the forensic writeup).
#
# What it does, in order:
#   1. Pre-flight: refuse to run if the repo clone has local modifications or
#      untracked build-context files that could contaminate the image.
#   2. Sync: git fetch + reset --hard origin/main so the image is built from
#      exactly what is on GitHub.
#   3. Capture: resolve the GIT_SHA of HEAD and the current ISO build time.
#      These are passed as --build-args and baked into the image as ENV +
#      LABEL + NEXT_PUBLIC_GIT_SHA (served via /api/build-info).
#   4. Build: `docker build --no-cache` with multiple tags so we can always
#      roll back to the previous SHA and so :latest is kept coherent.
#   5. Static verification: start a throwaway container from the new image
#      and confirm NEXT_PUBLIC_GIT_SHA inside matches the SHA we just built.
#      Any mismatch aborts BEFORE touching the Swarm service.
#   6. Service update: `docker service update --force --image …:<SHA>` to roll
#      the new image into the swarm, then wait for convergence.
#   7. Runtime verification: hit https://doa.testn8n.com/api/build-info and
#      confirm the live site reports the same SHA. If it does not match after
#      a bounded wait, roll back to the previous tag.
#
# Requirements on VPS:
#   - /root/apps/doa-ops-hub is a clone of the GitHub repo tracking `main`.
#   - /root/apps/doa-ops-hub/.env.production contains the build-args for
#     NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_APP_URL.
#   - `curl` and `jq` are installed (apt install -y jq curl).
#
# Exit codes:
#   0 success
#   1 pre-flight check failed
#   2 build failed
#   3 static verification failed (image does not self-identify as $GIT_SHA)
#   4 service update failed
#   5 runtime verification failed (rollback attempted)
# ============================================================================

set -euo pipefail

# ---------- Configuration ---------------------------------------------------

readonly REPO_DIR="${REPO_DIR:-/root/apps/doa-ops-hub}"
readonly SERVICE_NAME="${SERVICE_NAME:-doa_doa-app}"
readonly IMAGE_NAME="${IMAGE_NAME:-doa-ops-hub}"
readonly ENV_FILE="${ENV_FILE:-$REPO_DIR/.env.production}"
readonly HEALTH_URL="${HEALTH_URL:-https://doa.testn8n.com/api/build-info}"
readonly CONVERGENCE_TIMEOUT="${CONVERGENCE_TIMEOUT:-180}" # seconds
readonly RUNTIME_POLL_TIMEOUT="${RUNTIME_POLL_TIMEOUT:-120}" # seconds

# ---------- Helpers ---------------------------------------------------------

c_reset="$(tput sgr0 2>/dev/null || echo '')"
c_red="$(tput setaf 1 2>/dev/null || echo '')"
c_green="$(tput setaf 2 2>/dev/null || echo '')"
c_yellow="$(tput setaf 3 2>/dev/null || echo '')"
c_blue="$(tput setaf 4 2>/dev/null || echo '')"
c_bold="$(tput bold 2>/dev/null || echo '')"

log()   { echo "${c_blue}[deploy]${c_reset} $*"; }
ok()    { echo "${c_green}[ ok  ]${c_reset} $*"; }
warn()  { echo "${c_yellow}[warn ]${c_reset} $*" >&2; }
die()   { echo "${c_red}${c_bold}[abort]${c_reset} $*" >&2; exit "${2:-1}"; }

on_err() {
  local rc=$?
  warn "deploy.sh failed with exit code $rc"
  exit $rc
}
trap on_err ERR

# ---------- Step 1: pre-flight ----------------------------------------------

log "Step 1/7  Pre-flight checks"

[[ -d "$REPO_DIR/.git" ]]    || die "$REPO_DIR is not a git repo" 1
[[ -f "$ENV_FILE"       ]]    || die "$ENV_FILE is missing (need build-args)" 1
command -v docker >/dev/null  || die "docker is not installed" 1
command -v curl   >/dev/null  || die "curl is not installed" 1
command -v jq     >/dev/null  || die "jq is not installed (apt install -y jq)" 1

cd "$REPO_DIR"

# The VPS clone must be on `main` (and only main). Deploying a random branch
# would desync tag semantics.
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[[ "$CURRENT_BRANCH" == "main" ]] || die "VPS clone is on branch '$CURRENT_BRANCH'; must be 'main'" 1

# No local modifications. An edit to, say, route.ts on the VPS that is not in
# git would end up baked into the image and never surface in GitHub.
if [[ -n "$(git status --porcelain)" ]]; then
  warn "VPS clone has local modifications or untracked files:"
  git status --short >&2
  die "Refusing to build from a dirty working tree. Commit, stash, or remove the changes first." 1
fi

ok "Pre-flight OK (repo clean, on main)"

# ---------- Step 2: sync ----------------------------------------------------

log "Step 2/7  Syncing with origin/main"
git fetch --prune origin main
git reset --hard origin/main
ok "Synced to $(git rev-parse --short HEAD)"

# ---------- Step 3: capture provenance --------------------------------------

GIT_SHA="$(git rev-parse HEAD)"
GIT_SHA_SHORT="$(git rev-parse --short HEAD)"
BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
DATE_TAG="$(date +%Y%m%d-%H%M%S)"
IMAGE_TAG="$GIT_SHA_SHORT"

log "Step 3/7  Captured build provenance"
log "   GIT_SHA:    $GIT_SHA"
log "   BUILD_TIME: $BUILD_TIME"
log "   DATE_TAG:   $DATE_TAG"
log "   IMAGE_TAG:  $IMAGE_TAG"

# ---------- Step 4: build ---------------------------------------------------

log "Step 4/7  Loading build-args from $ENV_FILE"

# Only forward NEXT_PUBLIC_* (public bundle envs). Never read secrets here;
# runtime secrets stay in docker-compose.swarm.yml / service update --env-add.
# shellcheck disable=SC2046
export $(grep -E '^NEXT_PUBLIC_[A-Z_]+=' "$ENV_FILE" | xargs -d '\n')

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL missing in $ENV_FILE}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY missing in $ENV_FILE}"
: "${NEXT_PUBLIC_APP_URL:?NEXT_PUBLIC_APP_URL missing in $ENV_FILE}"

# Record the previous image in case we need to roll back.
PREV_IMAGE="$(docker service inspect "$SERVICE_NAME" \
  --format '{{.Spec.TaskTemplate.ContainerSpec.Image}}' 2>/dev/null || true)"
log "   Previous image: ${PREV_IMAGE:-<none>}"

log "Step 4/7  docker build (no cache) tags=[$IMAGE_TAG, $DATE_TAG, latest]"
docker build \
  --no-cache \
  --pull \
  --build-arg "GIT_SHA=$GIT_SHA" \
  --build-arg "GIT_BRANCH=main" \
  --build-arg "BUILD_TIME=$BUILD_TIME" \
  --build-arg "IMAGE_TAG=$IMAGE_TAG" \
  --build-arg "NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg "NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  --build-arg "NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL" \
  -t "${IMAGE_NAME}:${IMAGE_TAG}" \
  -t "${IMAGE_NAME}:${DATE_TAG}" \
  -t "${IMAGE_NAME}:latest" \
  "$REPO_DIR" || die "docker build failed" 2

ok "Build OK: ${IMAGE_NAME}:${IMAGE_TAG}"

# ---------- Step 5: static verification -------------------------------------

log "Step 5/7  Static verification — starting throwaway container"

# Read NEXT_PUBLIC_GIT_SHA from a throwaway container to prove the image
# contains what we think. If docker/BuildKit reused a stale layer or someone
# re-tagged an old image, this check fails HERE, before we touch the service.
PROBE_SHA="$(docker run --rm --entrypoint sh "${IMAGE_NAME}:${IMAGE_TAG}" \
  -c 'printf "%s" "$NEXT_PUBLIC_GIT_SHA"')"

if [[ "$PROBE_SHA" != "$GIT_SHA" ]]; then
  die "Image self-reported GIT_SHA='$PROBE_SHA' but deploy.sh built from '$GIT_SHA'.
    The image is NOT the code we intended to ship. Aborting before rollout." 3
fi

# Additional sanity: the image's OCI revision label must match too.
LABEL_SHA="$(docker image inspect "${IMAGE_NAME}:${IMAGE_TAG}" \
  --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}')"
if [[ "$LABEL_SHA" != "$GIT_SHA" ]]; then
  die "OCI label revision='$LABEL_SHA' != GIT_SHA='$GIT_SHA'. Aborting." 3
fi

ok "Static verification OK (image self-reports $GIT_SHA_SHORT)"

# ---------- Step 6: service update ------------------------------------------

log "Step 6/7  Rolling ${IMAGE_NAME}:${IMAGE_TAG} into ${SERVICE_NAME}"
docker service update \
  --force \
  --image "${IMAGE_NAME}:${IMAGE_TAG}" \
  "$SERVICE_NAME" >/dev/null \
  || die "docker service update failed" 4

# Wait for the swarm to converge on the new task.
log "   Waiting up to ${CONVERGENCE_TIMEOUT}s for task convergence"
deadline=$(( $(date +%s) + CONVERGENCE_TIMEOUT ))
while true; do
  STATE="$(docker service ps "$SERVICE_NAME" \
    --filter desired-state=running --format '{{.CurrentState}}' | head -1)"
  if [[ "$STATE" == Running* ]]; then
    ok "Service converged (task state: $STATE)"
    break
  fi
  if (( $(date +%s) > deadline )); then
    warn "Service did not converge within ${CONVERGENCE_TIMEOUT}s"
    docker service ps "$SERVICE_NAME" --no-trunc | head -5 >&2
    die "Convergence timeout" 4
  fi
  sleep 3
done

# ---------- Step 7: runtime verification ------------------------------------

log "Step 7/7  Runtime verification against $HEALTH_URL"

deadline=$(( $(date +%s) + RUNTIME_POLL_TIMEOUT ))
LIVE_SHA=""
while true; do
  if LIVE_SHA="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null | jq -r '.gitSha' 2>/dev/null)"; then
    if [[ "$LIVE_SHA" == "$GIT_SHA" ]]; then
      ok "Runtime verification OK — live site reports gitSha=$GIT_SHA_SHORT"
      break
    fi
  fi

  if (( $(date +%s) > deadline )); then
    warn "Live site gitSha='$LIVE_SHA' does not match expected '$GIT_SHA' after ${RUNTIME_POLL_TIMEOUT}s"
    if [[ -n "$PREV_IMAGE" ]]; then
      warn "Rolling back to $PREV_IMAGE"
      docker service update --force --image "$PREV_IMAGE" "$SERVICE_NAME" >/dev/null || \
        warn "Rollback also failed — check service manually"
    fi
    die "Runtime verification failed" 5
  fi
  sleep 3
done

# ---------- Summary ---------------------------------------------------------

echo
echo "${c_green}${c_bold}DEPLOY OK${c_reset}"
echo "  Image:   ${IMAGE_NAME}:${IMAGE_TAG} (also ${DATE_TAG}, latest)"
echo "  Commit:  $GIT_SHA"
echo "  Built:   $BUILD_TIME"
echo "  Verify:  curl -s $HEALTH_URL | jq"
echo
