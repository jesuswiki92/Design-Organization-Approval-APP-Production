# AMS — Health Check Log (bitácora viva)

> Archivo de memoria institucional. Cada vez que un problema nos cueste tiempo,
> se añade una entrada aquí. Lo consulta tanto el humano como el agente antes
> de tocar el stack. El script `03. Deploy/docker/ams/healthcheck-routine.sh`
> se apoya en la columna **Regression check** para detectar reincidencias.
>
> **Reglas de la bitácora:**
> - Nuevo arriba (orden cronológico inverso).
> - No borrar entradas resueltas; marcarlas como `RESUELTO` pero dejar el cuerpo.
> - Si el fix requiere una decisión humana que aún no se ha tomado → va a
>   **Decisiones arquitectónicas pendientes**.
> - Si el fix fue puntual y debería codificarse (compose, script, migración)
>   → va a **Deuda técnica conocida**.

---

## 1. Incidencias conocidas e históricas

### 2026-04-19 — Rename `ams_*` → sin prefijo (retomada y cierre)
- **Componente:** Postgres (`ams-postgres-app`) + Next.js (`ams-nextjs`) + n8n
- **Severidad:** DEGRADED durante la ventana de corte
- **Síntoma:** Rename ejecutado en BD pero una segunda sesión lo detuvo a
  mitad; workflows n8n seguían apuntando a `ams_*` (ya inexistentes) y el
  agente se paró antes de smoke test.
- **Diagnóstico retomada:**
  - BD: 28 tablas sin prefijo, 0 funciones `ams_*` restantes -> fase SQL OK.
  - Código TS: 21 matches `ams_` en 8 archivos, todos comentarios históricos,
    `ams_internal` (red docker), o `match_ams_part21` (RPC pre-existente roto
    a función inexistente — fuera de scope del rename).
  - `types/database.ts`: 0 matches en identificadores activos (los 12 de grep
    eran comentarios).
  - n8n: 9/10 workflows con `tableId: ams_*`; `Uyg8yWc47Z9EuSHU` ya actualizado.
- **Fix:** Vía MCP n8n (`n8n_update_partial_workflow`): 41 operaciones
  `updateNode` repartidas en 9 workflows (Simulador 14, Outlook 14, Receptor
  Formularios 4, Web Server Formularios 2, Enviar Correo Cliente 2, Guardar
  Quotation 2, Cambio Estado Quotation 1, Project Cambio Estado 1, Guardar
  Docs Compliance 1). Migración renombrada con header `-- APLICADO 2026-04-19`.
- **Smoke test:** `/home` → HTTP 307 a `/login`; `/login` → HTTP 200;
  `docker logs ams-nextjs | grep -iE "pgrst205|perhaps you meant"` → 0 líneas.
- **Pendiente del usuario:** Reactivar los workflows AMS a mano
  (`pEFW1V46yyLR58c8` Outlook queda **inactivo** por decisión explícita; los
  otros 9 estaban pausados durante el corte — decidir si se reactivan).
  Bug separado: `match_ams_part21` RPC no existe en BD, su error lo traga
  el `catch` silenciosamente; revisar si hace falta esa función o quitarlo.
- **Regression check:**
  ```bash
  docker exec ams-postgres-app bash -c 'export PGPASSWORD=$(cat /run/secrets/postgres_app_password); psql -U postgres -d postgres -c "SELECT count(*) FROM pg_tables WHERE schemaname=\"public\" AND tablename LIKE \"ams_%\";"'
  # debe ser 0
  docker logs --tail 200 ams-nextjs 2>&1 | grep -c "PGRST205"  # debe ser 0
  ```
- **Estado:** RESUELTO (app funcional); reactivación de workflows pendiente
  decisión usuario.

### 2026-04-19 — Critique de demo end-to-end: 5 bugs funcionales
- **Componente:** Next.js app (`01.Desarrollo de App`)
- **Severidad:** HIGH (bug 1 era demo-breaker)
- **Síntoma:** Critique de paseo end-to-end identifica 5 defectos antes del demo.
- **Bugs resueltos:**
  1. **Panel de decision de consulta sin handlers** — los 3 CTAs ("Crear proyecto",
     "Solicitar mas info", "Rechazar") eran `<button>` sin `onClick`.
     Fix: nuevo `app/(dashboard)/quotations/incoming/[id]/DecisionPanel.tsx`
     que delega a `/api/consultas/[id]/abrir-proyecto` (POST) y
     `/api/consultas/[id]/state` (PATCH a `formulario_enviado` / `oferta_rechazada`).
  2. **Home con copy interno de reestructuracion** — quitados los bloques
     "Baseline saneada / Estado del saneamiento / Siguiente foco".
     Reemplazados por 4 KPIs reales (consultas triage, ofertas revision,
     proyectos validacion, entregas pendientes) con queries a
     `ams_consultas_entrantes` y `ams_proyectos`. Titulo cambiado a
     "AMS DOA Operation Hub".
  3. **Placeholder `EASA.21J.XXXX (PENDIENTE)` en SoC PDF** —
     `app/api/proyectos/[id]/preparar-entrega/route.ts` ahora devuelve 500 si
     `DOA_COMPANY_APPROVAL_NO` no esta definido, con log
     `project.preparar_entrega.config_missing`. Añadido a `.env.example` y
     `03. Deploy/docker/ams/.env.example`.
  4. **Dead code `IncomingQueryStateControl`** — función de 86 lineas en
     `app/(dashboard)/quotations/QuotationStatesBoard.tsx` sin uso.
     Confirmado 0 llamadas (solo la definicion y el doc comment). Eliminada.
  5. **Docs drift `doa_consultas_entrantes` → `ams_consultas_entrantes`** —
     actualizado en `docs/01-guia-proyecto.md`, `docs/03-flujo-consultas.md` y
     `docs/06-estado-actual.md`. Tambien `doa_respuestas_formularios` →
     `ams_respuestas_formularios` donde procede.
- **Regression check:**
  ```bash
  grep -rn "EASA.21J.XXXX" "01.Desarrollo de App/"      # debe ser 0
  grep -rn "IncomingQueryStateControl" "01.Desarrollo de App/app/"  # debe ser 0
  grep -rn "doa_consultas_entrantes" "01.Desarrollo de App/docs/01-guia-proyecto.md" \
    "01.Desarrollo de App/docs/03-flujo-consultas.md" \
    "01.Desarrollo de App/docs/06-estado-actual.md"     # debe ser 0
  ```
- **Estado:** RESUELTO.

### 2026-04-19 — LocalAI: preload URL drift
- **Componente:** LocalAI (`ams-localai`)
- **Severidad:** BLOCKER
- **Síntoma:** `ams-localai` en crash loop tras reiniciar Docker. Logs:
  `unsupported protocol scheme ""`, `first path segment in URL cannot contain colon`.
- **Causa raíz:** En LocalAI v4.1.3 el campo YAML `url:` se parsea con
  `net/url.Parse`. Valores como `localai@...` y `:q4_k_m` no son URLs válidas
  y revientan el parser antes de llegar al selector de galería.
- **Fix:** Cambiar `url:` → `id:` en
  `03. Deploy/docker/ams/localai/models-preload.yaml`. El selector de galería
  usa `id:` con formato `<gallery>@<model-name>`.
- **Regression check:**
  ```bash
  docker exec ams-litellm python -c "import urllib.request,json; print(json.load(urllib.request.urlopen('http://ams-localai:8080/v1/models')))"
  ```
  Debe devolver ambos aliases: `embedding-default` y `llm-default`.
  Opcional: `POST /v1/embeddings` y verificar `dim=768`.
- **Tiempo perdido:** ~15 min de diagnóstico + ~10 min del fix secundario (chown).
- **Estado:** RESUELTO.

### 2026-04-19 — LocalAI: volúmenes anónimos con ownership incorrecto
- **Componente:** LocalAI (`ams-localai`) + Docker volumes
- **Severidad:** DEGRADED
- **Síntoma:** `mkdir /backends/cpu-llama-cpp: permission denied` en startup.
- **Causa raíz:** Los volúmenes anónimos (`/backends`, `/configuration`,
  `/data`, `/models`) se crean como `root:root 755`, pero el contenedor
  ejecuta como UID 1000.
- **Fix:** One-shot por cada volumen:
  ```bash
  docker run --rm --user root -v <vol>:/<mnt> alpine chown 1000:1000 /<mnt>
  ```
  Persiste entre reinicios, NO entre recreaciones del volumen.
- **Regression check:**
  ```bash
  docker exec ams-localai stat -c '%U:%G' /backends /configuration /data /models
  ```
  Debe devolver `1000:1000` para los cuatro (uid/gid mapeado).
- **Estado:** RESUELTO (manual). Pendiente codificar — ver deuda técnica.

### 2026-04-19 — Bugs de correo (4 bugs aparcados)
- **Componente:** App code (`send-client/route.ts`, `syncConsultaEmails`) + n8n
  (workflows `pEFW1V46yyLR58c8` y `LXrCDXbl3zKUmRRE`)
- **Severidad:** DEGRADED (Bug 3 era BLOCKER funcional para el hilo)
- **Síntoma / Causa / Fix:**
  - **Bug 1 — `correo_cliente_enviado_at/_by` nunca se poblaba.** Columnas
    huérfanas, sin writer. *Fix:* añadidas al UPDATE existente en
    `send-client/route.ts`.
  - **Bug 2 — No había `.eml` saliente en storage.** No se hacía INSERT en
    `ams_emails` con `direccion='saliente'`. *Fix:* en la misma ruta +
    llamada a `syncConsultaEmails`.
  - **Bug 3 — Cada email creaba una consulta nueva (sin thread matching).**
    Bloqueado pendiente de decisión → se eligió estrategia `conversationId`
    (opción a). *Fix:* en curso.
  - **Bug 4 — Sobrescritura de clasificación en cada respuesta.** El nodo
    `Actualizar Fila entrantes` escribía ciegamente el output de IA incluyendo
    el fallback `'Clasificacion pendiente'`. *Fix:* eliminado `clasificacion`
    de 3 nodos UPDATE en los workflows `pEFW1V46yyLR58c8` y `LXrCDXbl3zKUmRRE`.
- **Regression check (Bug 4):**
  ```sql
  SELECT count(*)
    FROM ams_consultas_entrantes
   WHERE clasificacion = 'Clasificacion pendiente'
     AND updated_at > now() - interval '30 minutes';
  ```
  Tras procesar una respuesta, un registro con clasificación real no debería
  volver a `'Clasificacion pendiente'`.
- **Tiempo perdido:** ~6 h (diagnóstico + fix).
- **Estado:** Bugs 1, 2 y 4 RESUELTOS. Bug 3 en curso.

### 2026-04-18 → 2026-04-19 — Docker Desktop se paró de noche
- **Componente:** Docker Desktop (host Windows)
- **Severidad:** DEGRADED
- **Síntoma:** El smoke test devolvió
  `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine`.
- **Causa raíz:** Docker Desktop se cerró durante la noche (posible sleep /
  update automático / config de usuario).
- **Fix:** Reiniciar Docker Desktop manualmente.
- **Regression check:** `docker info` responde; ver check 1 de la rutina.
- **Estado:** RESUELTO. Deuda técnica: la propia rutina de monitoring depende
  de Docker Desktop → necesita ruta de alerta que funcione CON DOCKER CAÍDO.
  Ver deuda técnica.

### 2026-04-19 — Login en bucle: CSP + `NEXT_PUBLIC_SUPABASE_ANON_KEY` ausente en runtime
- **Componente:** Caddy (`ams-caddy`) + Next.js (`ams-nextjs`)
- **Severidad:** BLOCKER (login imposible en self-hosted)
- **Síntoma:** Credenciales correctas, el navegador se queda en bucle en
  `/login`. DevTools muestra 6 errores
  `Executing inline script violates the following Content Security Policy
  directive 'script-src 'self''` más `Uncaught (in promise) Error: Connection
  closed.` (stream de React Server Components que se corta).
- **Causa raíz:**
  - **CSP**: el header en el snippet `(security_headers)` del Caddyfile
    tenía `script-src 'self'` y bloqueaba los bootstrap scripts inline que
    Next.js 16 usa para hidratar la página (RSC/flight). Sin ellos, el
    cliente nunca llega a ejecutar `supabase.auth.signInWithPassword` con
    éxito en su UI -> vuelve a `/login`.
  - **Anon key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY` no llegaba al proceso
    `node` / `next-server` final dentro de `ams-nextjs`. Verificado con
    `tr "\0" "\n" < /proc/1/environ | grep NEXT_PUBLIC_SUPABASE_ANON_KEY`
    -> vacío. El patrón `entrypoint.sh` + `read_required_secret` + `eval`
    definía la variable en la shell del entrypoint pero no se propagaba al
    hijo `node server.js`, por lo que el cliente de Supabase se
    inicializaba sin key y las llamadas a `/auth/v1/token` nunca cuajaban.
- **Fix:**
  - Caddyfile (`03. Deploy/docker/ams/caddy/Caddyfile` línea 40): ampliar
    CSP a
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'` y añadir
    `https://ams.local` (además del wildcard `https://*.ams.local`) en
    `connect-src`. Reload en caliente:
    ```bash
    MSYS_NO_PATHCONV=1 docker exec ams-caddy \
      caddy reload --config /etc/caddy/Caddyfile
    ```
  - docker-compose (`03. Deploy/docker/ams/docker-compose.yml`, bloque
    `environment:` de `ams-nextjs`, justo después de
    `NODE_EXTRA_CA_CERTS`): añadir
    ```yaml
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${NEXT_PUBLIC_SUPABASE_ANON_KEY}
    ```
    El `.env` vecino ya tenía el JWT self-hosted. Recreación sin rebuild:
    ```bash
    docker compose --profile phase-5 up -d --force-recreate ams-nextjs
    ```
- **Regression check:**
  ```bash
  # 1. Anon key llega al proceso Next.js (PID 1 = next-server):
  MSYS_NO_PATHCONV=1 docker exec ams-nextjs sh -c \
    'tr "\0" "\n" < /proc/1/environ | grep -E "^NEXT_PUBLIC_SUPABASE_ANON_KEY=" | head -c 50'
  # Debe empezar por NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs

  # 2. CSP con unsafe-inline en script-src y style-src:
  MSYS_NO_PATHCONV=1 docker exec ams-caddy sh -c \
    'grep -o "unsafe-inline" /etc/caddy/Caddyfile | wc -l'
  # Debe ser >= 2

  # 3. La app responde:
  curl -sk -o /dev/null -w "%{http_code}\n" https://localhost/        # 307
  curl -sk -o /dev/null -w "%{http_code}\n" https://localhost/login   # 200
  ```
- **Notas / gotchas:**
  - Git-Bash reescribe `/etc/...` a ruta Windows al pasarlo a `docker exec`.
    Usar `MSYS_NO_PATHCONV=1` como prefijo.
  - La imagen `ams-nextjs` es slim: NO tiene `pgrep`. `node` corre como
    PID 1 y su `comm` es `next-server (v...`. Consultar directamente
    `/proc/1/environ`.
  - `grep -c PATRÓN FILE` cuenta LÍNEAS con match, no matches. Los tres
    tokens `'unsafe-inline'` / `'unsafe-eval'` viven en una sola línea
    (el header CSP es una string única), así que para contar ocurrencias
    usar `grep -o PATRÓN FILE | wc -l`.
  - `docker compose up ams-nextjs` requiere `--profile phase-5`
    (el servicio vive en ese profile).
  - El reload de Caddy se confirma por `using config from file` +
    `adapted config to JSON` en el log del admin API, no por una línea
    literal "reloaded configuration".
- **Tiempo perdido:** ~20 min de diagnóstico + ~5 min del fix aplicado.
- **Estado:** RESUELTO.

### Histórico — `bootstrap.sh` parser de comentarios inline
- **Componente:** `03. Deploy/docker/ams/bootstrap.sh`
- **Severidad:** DEGRADED
- **Síntoma:** mkcert falló porque la variable `AMS_DOMAIN` se leyó como
  `"ams.local                 # Dominio local..."` incluyendo el comentario.
- **Causa raíz:** `strip_inline_comment` no se llamaba en todas las variables;
  en concreto `PHASE5_ENABLED` era inconsistente con `PHASE3_ENABLED` y
  `PGB_STANZA`.
- **Fix:** Añadir `strip_inline_comment` en la lectura de `PHASE5_ENABLED`.
- **Regression check:**
  ```bash
  grep -E 'strip_inline_comment.*PHASE' bootstrap.sh | wc -l
  ```
  Debe ser ≥ 3.
- **Estado:** RESUELTO.

---

## 2. Decisiones arquitectónicas pendientes

- **2026-04-19 — Plan de rename `ams_*` → sin prefijo APLICADO.** Migraciones
  `supabase/migrations/20260419120000_rename_to_unprefixed.sql` +
  `20260419120001_rename_functions_unprefixed.sql` aplicadas en Postgres
  self-hosted. BD confirmada sin tablas ni funciones `ams_*` (28 tablas sin
  prefijo, 0 funciones `ams_*`). Código TS limpio en tiempo real (8 archivos
  con residuos que son todos comentarios históricos o falsos positivos —
  `ams_internal` es una red docker, `match_ams_part21` es un RPC a una función
  inexistente pre-rename). 10 workflows n8n actualizados (`Uyg8yWc47Z9EuSHU`
  ya estaba al día; los otros 9 recibieron entre 1 y 14 `tableId` updates vía
  MCP, total 41 ops). Smoke test post-rename: `/home` → 307 a `/login`,
  `/login` → 200, 0 errores PGRST205 en logs. Reactivación de workflows queda
  pendiente de acción manual del usuario (el MCP n8n no expone `activate`).
- **2026-04-19 — Tokens AMS light aplicados al shell.** Se unifica la marca
  en modo claro: tokens `--ams-navy` (`#0F4C81`), `--ams-navy-light`
  (`#1E6FB8`), `--ams-ink` (`#0F1A2E`), `--ams-navy-soft` (`#E7EEF6`)
  añadidos a `app/globals.css`. Rehidratados `--primary`, `--ring`,
  `--sidebar-primary`, `--sidebar-ring` para usar las CSS vars. Eliminado
  el bloque `.dark {…}` placebo y la clase `dark` del `<html>`; el body
  ya no hardcodea `#0F1117`. Nuevo componente `components/brand/AmsMark.tsx`
  consumido por `Sidebar.tsx` (reemplaza `<Shield>` de branding) y
  `app/(auth)/login/page.tsx` (rediseñado a tema claro). `TopBar.tsx`
  pierde el buscador `⌘K` sin handler y la campana de notificaciones sin
  popover; los botones restantes ganan `focus-visible:ring` con el token
  navy-light.
- **Bug 3 — estrategia de thread-matching de correos.**
  DECIDIDO 2026-04-19 → usar `conversationId` (opción a). Falta terminar la
  implementación y su regression check.
- **Webhook paths: `doa-*` → `ams-*`.**
  En n8n los paths siguen nombrados `doa-*`. Renombrar requiere actualización
  en lockstep de `lib/webhooks/*` en Next.js. NO DECIDIDO todavía.
- **RLS hardening.**
  14 tablas `ams_*` no tienen policies ("tal cual" aplicado por compatibilidad
  con comportamiento Cloud). Hay que decidir antes de exposición externa
  (ver también el pending del auto-folder webhook en MEMORY).

---

## 3. Deuda técnica conocida

- **LocalAI chown de volúmenes es one-shot.** Codificarlo: sidecar init en
  `docker-compose.yml` o cambiar a volúmenes nombrados con `user:` explícito
  en el servicio de compose.
- **`mensaje_id` sintético en `send-client/route.ts`** usa `@doa-ops-hub`.
  Follow-up tras el rebrand a `ams-*`.
- **Cast `admin as any` en `lib/rag/precedentes.ts:231`** sigue presente.
  El agente de regeneración de tipos devolvió output vacío; hay que reintentar.
- **Monitoring fuera de Docker.** La rutina de health-check corre dentro del
  shell del host, pero si Docker Desktop está caído no puede inspeccionar
  contenedores. Hace falta un canal de alerta que no dependa del stack
  (Windows Task Scheduler → log local → email/Discord).
- **Exposición pública de Next.js para callbacks de n8n cloud.** Webhook de
  auto-folder cableado pero bloqueado por falta de URL pública; fallback por
  page-open sigue activo (ver MEMORY).

---

## Plantilla para nuevas entradas

```markdown
### YYYY-MM-DD — <título corto>
- **Componente:** <LocalAI | n8n | Postgres | Caddy | Next.js | App code | ...>
- **Severidad:** <BLOCKER | DEGRADED | COSMETIC>
- **Síntoma:** <qué vimos>
- **Causa raíz:** <qué estaba realmente mal>
- **Fix:** <qué hicimos>
- **Regression check:** <comando / SQL / llamada n8n que lo detectaría>
- **Tiempo perdido:** <minutos aprox, opcional>
- **Estado:** <ACTIVO | RESUELTO | EN CURSO>
```
