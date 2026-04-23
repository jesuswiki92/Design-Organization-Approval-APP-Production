# Incidente de deploy 2026-04-22 — análisis forense

Investigación realizada el **2026-04-23** sobre el incidente percibido: la
imagen `doa-ops-hub:20260422-hardening` desplegada tras el hardening round
parecía "no contener el commit `59abbbc` (fix BUG-02)".

## 1. Hipótesis inicial del reporte

> El build de ayer se hizo antes del push de `59abbbc`, o desde un clon sin
> `git pull`, o la capa de Docker reutilizó un `.next` obsoleto y la imagen
> subida con tag `hardening` no contenía el fix.

## 2. Timeline reconstruida

Todas las horas en CEST (hora local del reportero).

| Hora | Evento | Evidencia |
|---|---|---|
| 19:41:33 | Commit `59abbbc` `fix(send-client): restore form URL substitution (BUG-02)` pusheado a `origin/main`. | `git log --pretty=format:'%h %ai %s'` |
| 19:42:35 | Build de la imagen `doa-ops-hub:20260422-174158` (`ART 14:42`, `CEST 19:42`). | `docker image inspect --format "{{.Created}}"` |
| 21:01:32–21:02:10 | Commits `99c8ee1`, `5bab349`, `0c4d476`, `03761bb`, `d7ebb76`, `4db080d` (hardening round — solo docs y migraciones, no tocan `send-client/route.ts`). | `git log` |
| 21:21:00 | Build de la imagen `doa-ops-hub:20260422-hardening` (`ART 16:21`). | `docker image history` |
| 22:00 aprox | Reporte: "send-client email no llega con link — BUG-02 ha reaparecido". | Usuario |
| 06:38 (+1d) | Commit `298f511` `fix(send-client): mint form URL on the fly when intake skipped token emission`. | `git log` |
| 07:39 (+1d) | Build + deploy `doa-ops-hub:20260423-formfix`. Bug desaparece. | `docker image history` |

## 3. Evidencia recolectada

### 3.1 Hash del fichero fuente dentro de cada imagen

```
docker run --rm --entrypoint sha256sum doa-ops-hub:20260422-174158    /app/app/api/incoming-requests/[id]/send-client/route.ts
docker run --rm --entrypoint sha256sum doa-ops-hub:20260422-hardening /app/app/api/incoming-requests/[id]/send-client/route.ts
docker run --rm --entrypoint sha256sum doa-ops-hub:20260423-formfix   /app/app/api/incoming-requests/[id]/send-client/route.ts
```

Resultado:
- `174158`: `960652e9479135bfaab13da716fefcf6c2a3002c848628036ca589b684ee7aa6`
- `hardening`: `960652e9479135bfaab13da716fefcf6c2a3002c848628036ca589b684ee7aa6`
- `formfix`: `a9e68a35f56e49fcb7e31e61df1bd7ed588b2d8c23a3cdb598eb0681821234d9`

### 3.2 Correspondencia con commits de Git

```
git show 59abbbc~1:app/api/incoming-requests/[id]/send-client/route.ts | sha256sum
# → dcfbe3062803397a70a61fb1b0f8fde4b86f1c6b4329a6547da7cbd23897d46c  (PRE-fix)

git show 59abbbc:app/api/incoming-requests/[id]/send-client/route.ts   | sha256sum
# → 960652e9479135bfaab13da716fefcf6c2a3002c848628036ca589b684ee7aa6  (el fix BUG-02)

git show 4db080d:app/api/incoming-requests/[id]/send-client/route.ts   | sha256sum
# → 960652e9479135bfaab13da716fefcf6c2a3002c848628036ca589b684ee7aa6  (sin cambios desde 59abbbc)

git show 298f511:app/api/incoming-requests/[id]/send-client/route.ts   | sha256sum
# → a9e68a35f56e49fcb7e31e61df1bd7ed588b2d8c23a3cdb598eb0681821234d9  (fix 4ª capa mint-on-fly)
```

### 3.3 Conclusión de los hashes

- La imagen `20260422-hardening` **SÍ contenía** el fix `59abbbc`.
- También lo contenía la anterior `20260422-174158` (misma SHA de contenido,
  lo que confirma que el hardening round no tocó `route.ts`).
- La imagen que cerró el bug no fue `20260423-formfix` porque agregara
  `59abbbc` — fue porque `298f511` introdujo una cuarta capa de fallback
  (`ensureFormLink`, mint on the fly) que `59abbbc` no cubría.

## 4. Causa raíz real

El bug observado en producción tras desplegar `20260422-hardening` **no era
BUG-02 reapareciendo**. Era un caso distinto, BUG-03, que `59abbbc` no podía
cubrir:

> **BUG-02 (`59abbbc`)**: añade capa 3 de fallback — si `doa_incoming_requests.form_url`
> está vacío, buscar en `doa_form_tokens` un token activo y construir la URL.

> **BUG-03 (`298f511`)**: el intake real (workflow Outlook `pEFW1V46yyLR58c8`)
> **no crea token** en `doa_form_tokens` y **escribe string vacío** en
> `form_url`. Las tres capas de `59abbbc` terminaban todas vacías, el marker
> se stripeaba, y el cliente recibía un email "incompleto" sin link.

El commit message de `298f511` documenta esto explícitamente:
> "The 3-layer resolver from 59abbbc could not recover because token layer (3)
> returned empty and we silently dropped the marker, producing the ': .'
> artefact observed in n8n execution 161551."

## 5. Por qué este incidente, aun con la causa clarificada, justifica endurecer el pipeline

La hipótesis inicial ("la imagen no contenía 59abbbc") **solo se pudo
refutar corriendo sha256 contra los ficheros fuente dentro de contenedores
efímeros**, lo cual requiere:

- Acceso SSH al VPS.
- Conocimiento de la estructura interna de la imagen (`/app/app/...`).
- Sospechar qué fichero mirar y construir los hashes a mano.

**Es decir: hoy no existe manera "desde fuera" y "legible para un humano" de
verificar qué commit hay en producción**. Si la hipótesis inicial hubiera
sido correcta (cache-reuse, tag aliasing, clon desincronizado), no lo
habríamos detectado hasta que un usuario reportara el bug.

Escenarios futuros plausibles que este proceso no detectaba:

1. **Tag aliasing**: `docker tag doa-ops-hub:20260410 doa-ops-hub:latest` crea
   un alias silencioso. Si alguien lo hace por error, `service update --image
   latest` desplegará la imagen antigua.
2. **Cache de layers**: sin `--no-cache` y con un `.dockerignore` permisivo,
   Docker puede reutilizar una capa `RUN npm run build` de un `.next` previo
   aunque el source haya cambiado.
3. **Clon desincronizado**: si alguien hace `git checkout <branch>` en
   `/root/apps/doa-ops-hub` y olvida volver a `main`, el build sale de un
   árbol que ni siquiera está en `origin/main`.
4. **Edits locales en el VPS**: si alguien edita `lib/…` en el clon del VPS
   "para probar una cosa rápida" y no lo revierte, la imagen productiva
   llevará código que no existe en GitHub.

Todos estos escenarios se cierran con el nuevo `ops/deploy.sh`.

## 6. Controles implementados (ver `docs/deploy.md` para detalles)

1. **`GET /api/build-info`** — endpoint público que reporta `gitSha`,
   `gitBranch`, `buildTime`, `imageTag` leídos desde ENVs inyectadas en
   build-time.
2. **Dockerfile actualizado** — `ARG GIT_SHA / BUILD_TIME / IMAGE_TAG`
   promovidos a `ENV NEXT_PUBLIC_*` y a `LABEL org.opencontainers.image.*`.
3. **`ops/deploy.sh`** — proceso canónico con pre/post verification:
   - Aborta si el clon está sucio o no en `main`.
   - `--no-cache --pull` siempre.
   - Static verification del SHA leído DENTRO de la imagen antes de tocar el
     servicio.
   - Runtime verification contra `/api/build-info` con rollback automático si
     el live SHA no converge al esperado.
4. **`.dockerignore`** — ya excluía `.next/` y `node_modules/`; se añadieron
   `deploy.sh`, `ops/` y `scripts/forensics-*.sh` para que no se cuelen en el
   contexto (son scripts de host, no de imagen).
5. **`docs/deploy.md`** — runbook único y canónico.

## 7. Gaps que este hardening NO cubre

- **Sin CI/CD**: los builds siguen siendo manuales en el VPS. Un GitHub Actions
  que construya y empuje a un registry (GHCR) con tag `<sha>` eliminaría el
  VPS como punto de build y permitiría firma criptográfica (sigstore/cosign).
- **Sin alertas de regresión**: si `/api/build-info` empieza a reportar un
  `gitSha` antiguo inesperadamente, nadie recibe una página. Un hook de
  monitorización externo (UptimeRobot + webhook) cerraría el bucle.
- **Sin SBOM**: la imagen no incluye un inventario de dependencias firmado.
  `docker sbom` o `syft` serían el siguiente paso.
- **Sin multi-arquitectura**: `docker build` produce solo amd64. El VPS es
  amd64 así que no es urgente.
