# DOA Operations Hub — Runbook de Deploy

Este documento es el **único camino autorizado** para poner cambios de la
aplicación en producción. No usar `docker build` / `docker service update`
sueltos desde `bash_history`, no aplicar tags manualmente a imágenes
existentes, no copiar un `.next` local al VPS.

## 1. Arquitectura de deploy

| Componente | Ubicación | Propósito |
|---|---|---|
| Clon productivo | `root@145.223.116.37:/root/apps/doa-ops-hub` | Fuente del build — SIEMPRE en `main`, SIEMPRE sync con GitHub |
| Variables de build | `/root/apps/doa-ops-hub/.env.production` | `NEXT_PUBLIC_*` que se hornean en el bundle |
| Script de deploy | `/root/apps/doa-ops-hub/ops/deploy.sh` | Build + verify + update + verify (ver §3) |
| Imagen Docker | `doa-ops-hub:<short-sha>` (también `<date-tag>` y `latest`) | Cada build emite 3 tags sobre el mismo digest |
| Servicio Swarm | stack `doa`, servicio `doa_doa-app`, red `VPSnet` | Servido por Traefik en `https://doa.testn8n.com` |
| Endpoint de verificación | `GET /api/build-info` | Devuelve `{ gitSha, gitBranch, buildTime, imageTag, … }` desde la imagen que está corriendo |

## 2. Flujo canónico (desde local)

```powershell
# 1) En local: commit + push a main
git add ...
git commit -m "..."
git push origin main

# 2) En VPS: ejecutar deploy.sh
$key = Join-Path $HOME '.ssh\id_ed25519'
ssh -i $key root@145.223.116.37 '/root/apps/doa-ops-hub/ops/deploy.sh'

# 3) Verificar desde cualquier sitio (no requiere SSH)
curl -s https://doa.testn8n.com/api/build-info | jq
```

El script es idempotente. Si lo ejecutas y ya no hay commits nuevos, no pasa
nada (vuelve a construir e imponer la misma SHA — el check de verificación
saldrá OK).

## 3. Qué hace `ops/deploy.sh` paso a paso

1. **Pre-flight**
   - Exige que `/root/apps/doa-ops-hub` esté en `main` y limpio (no hay archivos
     modificados ni sin trackear). Cualquier edición manual al clon del VPS
     corta el deploy aquí mismo.
   - Exige `docker`, `curl`, `jq` instalados.
2. **Sync**
   - `git fetch --prune origin main && git reset --hard origin/main` — la
     imagen se construye exactamente desde lo que hay en GitHub.
3. **Captura de provenance**
   - `GIT_SHA = git rev-parse HEAD`
   - `BUILD_TIME = date -u +%Y-%m-%dT%H:%M:%SZ`
   - `DATE_TAG = date +%Y%m%d-%H%M%S`
4. **Build**
   - `docker build --no-cache --pull --build-arg GIT_SHA=… --build-arg BUILD_TIME=…`
   - Tagea con tres etiquetas (`<sha>`, `<date>`, `latest`) todas apuntando al
     mismo digest. Cualquiera sirve para rollback.
5. **Static verification (antes de tocar el servicio)**
   - Arranca un contenedor efímero de la imagen recién construida.
   - Lee `NEXT_PUBLIC_GIT_SHA` desde dentro. Si no coincide con el SHA que
     acabamos de calcular → **abort**. La imagen no es lo que dijimos.
   - Comprueba también la etiqueta OCI `org.opencontainers.image.revision`.
6. **Service update**
   - `docker service update --force --image doa-ops-hub:<short-sha> doa_doa-app`
   - Espera convergencia hasta `CONVERGENCE_TIMEOUT=180s`.
7. **Runtime verification**
   - `curl -fsS https://doa.testn8n.com/api/build-info` cada 3 s hasta que
     `gitSha == GIT_SHA`, con `RUNTIME_POLL_TIMEOUT=120s`.
   - Si expira → **rollback automático** a la imagen previa
     (`PREV_IMAGE` capturada al inicio).

## 4. Cómo verificar desde fuera qué commit está en producción

```bash
curl -s https://doa.testn8n.com/api/build-info | jq
# {
#   "gitSha": "c82fefe2c5fe5767616ce2a95f20adac237b1b3e",
#   "gitShaShort": "c82fefe",
#   "gitBranch": "main",
#   "buildTime": "2026-04-23T06:00:00Z",
#   "imageTag": "c82fefe",
#   "nodeEnv": "production",
#   "serverTime": "2026-04-23T06:05:00.000Z"
# }
```

También se puede inspeccionar la etiqueta OCI sin entrar al contenedor:

```bash
ssh root@145.223.116.37 \
  'docker service inspect doa_doa-app \
     --format "{{.Spec.TaskTemplate.ContainerSpec.Image}}"'
```

## 5. Rollback manual

Si después de un deploy descubres que la nueva versión rompe algo y
`deploy.sh` ya terminó OK:

```bash
ssh root@145.223.116.37 '
  docker image ls doa-ops-hub --format "{{.Tag}}  {{.CreatedSince}}" | head
  # Elegir la tag anterior, por ejemplo el SHA previo o un <date-tag>
  docker service update --force --image doa-ops-hub:<previous-sha> doa_doa-app
  curl -s https://doa.testn8n.com/api/build-info | jq .gitShaShort
'
```

## 6. Qué hacer si `deploy.sh` aborta

| Exit code | Significado | Acción |
|---|---|---|
| 1 | Pre-flight falló | Arreglar el working tree del VPS (`git status`, commitear/descartar edits locales). |
| 2 | `docker build` falló | Leer el output. Típico: `--no-cache` descubrió un fallo de compilación que un build previo cacheado escondía. Arreglar el código, push, re-deploy. |
| 3 | Static verification falló (SHA en imagen ≠ SHA pedido) | **El bug catastrófico que este script previene.** No tocar el servicio, no hacer nada. Revisar `docker image history` del tag para entender qué pasó, reportar al mantenedor. |
| 4 | Service update no convergió | `docker service ps doa_doa-app --no-trunc` para ver el error (red, placement, recursos). El servicio suele quedar en su estado previo. |
| 5 | Runtime verification falló | El script ya intentó rollback automático. Verificar que `doa.testn8n.com/api/build-info` responde con el SHA viejo. Si no responde, revisar Traefik y logs del servicio. |

## 7. Qué NUNCA hacer

- **No taguear manualmente**: `docker tag doa-ops-hub:latest doa-ops-hub:<algo>`
  crea aliasing silencioso y rompe la correspondencia tag → contenido.
- **No construir sin `--no-cache`**: Docker puede reutilizar capas que ya no
  coinciden con el árbol actual de fuentes (especialmente si el `.dockerignore`
  deja colar `.next/` o `node_modules/`).
- **No construir desde un clon con modificaciones locales**: `deploy.sh` lo
  bloquea. Si lo saltas a mano, la imagen contendrá código que no existe en
  GitHub y nadie podrá reproducirla.
- **No editar `.env.production` en caliente sin rebuild**: los valores
  `NEXT_PUBLIC_*` se hornean en el bundle en build-time. Runtime edits solo
  sirven para secrets (runtime-only, inyectados por `docker-compose.swarm.yml`).
- **No ejecutar `docker compose up` en el VPS**: el runtime usa Docker Swarm
  (`VPSnet` es overlay no-attachable). Compose-up fallará silenciosamente.

## 8. Historia del incidente que motivó este runbook

Ver anexo `docs/deploy-incident-2026-04-22.md` para el análisis forense del
despliegue del 22/04/2026 que obligó a formalizar este proceso (imágenes
`20260422-174158` y `20260422-hardening` tenían el mismo árbol fuente — SHA256
idéntico de `route.ts` — pero existía **cero forma externa de comprobarlo**.
Si un día un build cachea una versión obsoleta del `.next` o alguien re-tagea
por error una imagen antigua, no teníamos cómo detectarlo hasta que un
usuario real reportara el bug).
