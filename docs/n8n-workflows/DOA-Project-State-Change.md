# n8n workflow: DOA-Project-State-Change

Runbook del workflow que reacciona a cambios de estado "simples" de un proyecto disparados desde el dropdown del Tablero (card) o desde el selector del detalle.

Esto es solo un documento de referencia. El workflow en si se importa en la instancia n8n de la organizacion.

## Proposito

Recibir una peticion HTTP desde la app (`POST /api/proyectos/{id}/transicion`) tras una transicion inline de la maquina v2 y disparar efectos colaterales: notificaciones, side-effects en sistemas externos, y -- en el caso terminal -- alimentar el indice de precedentes.

El endpoint de la app **no bloquea** en la respuesta de este workflow: la transicion de estado en `doa_proyectos` ya ocurrio antes del dispatch. Si el webhook falla, la app loguea `severity=warn` pero NO revierte. Este workflow debe ser idempotente o fail-safe.

## Trigger

- **Webhook** (`n8n-nodes-base.webhook`), HTTP POST.
- Path sugerido: `doa-project-state-change`.
- La URL publica resultante va a `N8N_PROJECT_STATE_WEBHOOK_URL` en el entorno de la app.
- Raw body: ON (necesario para verificar HMAC).

### Body esperado

```
{
  "proyecto_id": "<uuid>",
  "from_state": "<ProjectExecutionState>",
  "to_state": "<ProjectExecutionState>",
  "user_id": "<uuid del actor>",
  "timestamp": "<ISO-8601>"
}
```

Los valores de `from_state` y `to_state` pertenecen a la maquina v2 (`PROJECT_EXECUTION_STATES` en `lib/workflow-states.ts`): `proyecto_abierto`, `planificacion`, `en_ejecucion`, `revision_interna`, `listo_para_validacion`, `en_validacion`, `validado`, `devuelto_a_ejecucion`, `preparando_entrega`, `entregado`, `confirmacion_cliente`, `cerrado`, `archivado_proyecto`.

### Cabecera HMAC

Si la app tiene `DOA_N8N_WEBHOOK_SECRET` configurado, incluye:

```
x-doa-signature: <hex(hmac_sha256(raw_body, DOA_N8N_WEBHOOK_SECRET))>
```

En produccion el secreto es obligatorio; si falta, la app NO despacha y registra `severity=warn`. En dev puede llegar sin cabecera (log de warn en consola).

## Nodos

### 1. Webhook (trigger)
- Method: POST
- Response mode: "When Last Node Finishes"
- Response code: 200
- Response data: "Last Node"
- Raw body: ON

### 2. Function — HMAC Verify
Recibe el raw body y la cabecera `x-doa-signature`. Calcula `hmac_sha256(raw_body, $env.DOA_N8N_WEBHOOK_SECRET)` en hex y compara con timing-safe equality.

- Si no coincide -> `Respond to Webhook` con `{ ok: false, status: 401 }` y corta el flujo.
- Si coincide -> pasa el JSON parseado.

```javascript
// Pseudocodigo del Function node
const crypto = require('crypto')
const rawBody = $input.first().json.body // o $input.first().binary.data
const signature = $input.first().json.headers['x-doa-signature']
const computed = crypto
  .createHmac('sha256', $env.DOA_N8N_WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex')
if (!crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature))) {
  throw new Error('HMAC mismatch')
}
return JSON.parse(rawBody)
```

### 3. Switch — Branch by `to_state`

Campo: `{{$json.to_state}}`. Una salida por cada estado con side-effects; el resto pasa por el branch "fallback" (solo notifica o loguea).

Side-effects sugeridos por estado destino:

| `to_state`             | Side-effect                                                                                                  |
|------------------------|--------------------------------------------------------------------------------------------------------------|
| `en_ejecucion`         | Notificar al owner del proyecto via Slack/email ("Ejecucion retomada" si viene de `devuelto_a_ejecucion`).    |
| `en_validacion`        | Notificar a DOH/DOS que hay un proyecto esperando su firma.                                                  |
| `validado`             | Notificar al owner ("Validacion aprobada") y al PM.                                                          |
| `devuelto_a_ejecucion` | Notificar al owner con enlace al detalle para ver las observaciones de la validacion devuelta.                |
| `preparando_entrega`   | Notificar al PM y preparar plantillas de comunicacion al cliente.                                            |
| `entregado`            | Ya lo maneja `DOA-Enviar-Entregables`. Este branch puede quedarse como NO-OP o enviar resumen al canal interno. |
| `confirmacion_cliente` | Notificar al PM que el cliente confirmo recepcion.                                                           |
| `cerrado`              | Notificar a Direccion, archivar referencias internas, preparar encuesta de lecciones aprendidas.             |
| `archivado_proyecto`   | (Opcional) notificar a RAG que re-indexe precedentes — la app ya lo dispara fail-soft desde `/archivar`.     |

Los branches que queden sin uso simplemente deben pasar al `Respond to Webhook` con 200 sin hacer nada.

### 4. Nodes de notificacion (por branch)

- **Slack** (`n8n-nodes-base.slack`): mensaje al canal operativo segun branch. Usar credenciales OAuth2 de un bot dedicado.
- **Gmail / SMTP**: si aplica notificacion a owners externos.
- **HTTP Request**: por ejemplo al endpoint interno `/api/engineering/precedentes/reindex` para reforzar el re-index tras `archivado_proyecto` (ya se dispara desde la app fail-soft, esto es redundancia opcional).

### 5. Respond to Webhook
- Status: 200
- Body JSON: `{ "execution_id": "{{$execution.id}}" }`

La app NO espera este body (fire-and-forget), pero devolver el `execution_id` facilita la observabilidad cruzada.

## Ruta de error

- Wrap de los nodos sensibles con "Continue On Fail" desactivado.
- Al final del workflow, anade un nodo "Error Trigger" (o un branch con "IF" tras cada nodo critico) que apunte a un `Respond to Webhook` con status 500 y un cuerpo:
  `{ "error": "<mensaje>" }`.
- La app interpreta cualquier respuesta no-2xx como warn (no error) y registra el evento `project.state.transicion.webhook_failed`. La transicion ya esta aplicada en BD.

## Variables de entorno en n8n

Definir en n8n (Settings -> Environment o `.env` del host):

- `DOA_N8N_WEBHOOK_SECRET` — el mismo valor que `DOA_N8N_WEBHOOK_SECRET` en la app.
- Credenciales Slack/Gmail/SMTP segun los branches que activen notificaciones.

## Variables de entorno en la app

- `N8N_PROJECT_STATE_WEBHOOK_URL` — URL publica del webhook de este workflow.
- `DOA_N8N_WEBHOOK_SECRET` — secreto HMAC compartido. Obligatorio en produccion.

## Observabilidad

La app emite los siguientes eventos en `doa_app_events`:

- `project.state.transicion` (outcome=success) — cuando la transicion inline aplica.
- `project.state.transicion` (mode=requires_input) — cuando el dropdown redirige al detalle en lugar de aplicar.
- `project.state.transicion.webhook_failed` (severity=warn) — si el fetch a n8n falla (red, timeout, status no-2xx).
- `project.state.transicion.webhook_skipped` (severity=warn) — si falta URL o secreto en produccion.

## Pruebas manuales

1. En la app, abrir un proyecto en `cerrado` y usar el dropdown del Tablero para llevarlo a `archivado_proyecto`.
2. Verificar que la app devolvio 200 y la card refresco.
3. En n8n comprobar que la ejecucion entro (headers incluyen `x-doa-signature`).
4. Probar el camino `requires_input` moviendo un proyecto `validado` a `preparando_entrega` — la app debe redirigir al detalle (`?tab=entrega`) y NO disparar el webhook.

## TODO

- Definir plantillas finales de notificacion por branch (Slack/email).
- Considerar un único canal Slack "estado-proyectos" con un formato unificado (from → to, owner, enlace al detalle).
- Evaluar deduplicacion: si un proyecto cambia de estado varias veces en pocos segundos, evitar notificaciones duplicadas.
