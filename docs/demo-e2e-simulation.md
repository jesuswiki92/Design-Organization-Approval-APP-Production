# Simulación end-to-end sin Outlook real

Guía para ejecutar una demo o test de QA que recorra el pipeline completo de la app **sin esperar un correo real** desde Outlook. Última revisión: 2026-04-22.

## El pipeline productivo (referencia)

En producción, una request entra así:

1. Llega un correo a la bandeja compartida de DOA (Outlook / Microsoft 365).
2. El workflow n8n **`DOA - Intake Email`** (id `pEFW1V46yyLR58c8`, 42 nodos) se dispara por el trigger de Outlook:
   - Guarda una fila en `doa_incoming_requests` (subject, sender, original_body, classification IA, ai_reply, status `new`).
   - Guarda un `doa_emails` con `direction='inbound'`, `from_addr`, `to_addr`, `subject`, `body`, `message_id`, `in_reply_to`.
3. Desde ahí el operador abre el hilo en Quotations y sigue el flujo normal (revisar, enviar al cliente con enlace al formulario, abrir proyecto, etc.).

El trigger de Outlook **no se puede simular desde fuera**: el workflow sólo es disparable desde un evento real del buzón. Por eso, para demos, usamos la "Opción C".

## Opción C — inyectar la request directamente en Supabase

Tres pasos: INSERT en `doa_incoming_requests`, INSERT en `doa_emails`, y llamada al endpoint `/api/forms/issue-link` para emitir el token del formulario.

### 1. INSERT en `doa_incoming_requests`

Payload mínimo (sacado de la demo real del 2026-04-22, `3bae1652-6e59-4452-9bd4-3e5b52c2a32d`):

```sql
INSERT INTO doa_incoming_requests (
  subject,
  sender,
  original_body,
  classification,
  ai_reply,
  status,
  entry_number,
  aircraft_manufacturer,
  aircraft_model
) VALUES (
  'Consulta modificación menor - instalación wifi cabina A320',
  'cliente.demo@example.com',
  'Hola, queremos instalar wifi en cabina de un A320. Necesitamos cotización.',
  'minor_mod',
  'Estimado cliente, adjunto enlace al formulario para recopilar los detalles de la modificación: [Acceder al formulario del proyecto]. Un saludo.',
  'new',
  'ENT-' || to_char(now(), 'YYYYMMDD') || '-DEMO',
  'Airbus',
  'A320-200'
) RETURNING id;
```

Guarda el `id` devuelto — es el `incoming_request_id` para los siguientes pasos.

### 2. INSERT en `doa_emails` (mensaje inbound simulado)

El workflow real inserta una fila inbound; para que la UI de Quotations muestre el hilo de emails correctamente, replícala:

```sql
INSERT INTO doa_emails (
  incoming_request_id,
  direction,
  from_addr,
  to_addr,
  subject,
  body,
  sent_at,
  message_id
) VALUES (
  '<incoming_request_id>',           -- el id devuelto en el paso 1
  'inbound',
  'cliente.demo@example.com',
  'consultas@doa-internal.example',
  'Consulta modificación menor - instalación wifi cabina A320',
  'Hola, queremos instalar wifi en cabina de un A320. Necesitamos cotización.',
  now(),
  'demo-' || gen_random_uuid() || '@local.test'
);
```

> **Nota**: las columnas se llaman `from_addr` / `to_addr` (no `from_address` / `to_address`). Si un script antiguo usa los nombres largos, actualízalo.

### 3. Emitir token del formulario

`POST https://doa.testn8n.com/api/forms/issue-link`

Headers:
```
Authorization: Bearer <DOA_N8N_INBOUND_SECRET>
Content-Type: application/json
```

Body:
```json
{
  "incoming_request_id": "<incoming_request_id>",
  "slug": "cliente_desconocido",
  "ttl_days": 14
}
```

Respuesta:
```json
{
  "url": "https://doa.testn8n.com/f/enRm_-...",
  "token": "enRm_-ndycAhtiV7m3xnyEhdIVI6VtFfDR_wvdzbw9o",
  "expires_at": "2026-05-06T18:40:41Z"
}
```

Abre la `url` en un navegador privado, rellena el formulario y envíalo — la respuesta se guarda en `doa_incoming_requests` (via el RPC `submit_form_v2`) y el estado pasa a `form_completed` (o similar, revisa `lib/workflow-states.ts`).

A partir de ahí, la interfaz de Quotations toma el relevo igual que si viniera de Outlook real.

## Paso 4 (opcional) — disparar "enviar al cliente" sin cookie-auth

El endpoint `/api/incoming-requests/[id]/send-client` exige sesión de usuario, así que no se puede golpear desde un bot. Para simular que un operador lo pulsa:

- **Opción recomendada**: inicia sesión normal en la app y dale al botón "Enviar al cliente" desde el detalle de la request.
- **Opción alternativa sin UI**: llama directamente al workflow downstream n8n `I59H3jFoXXPkRCGc` con el payload *flatten* (ver `app/api/incoming-requests/[id]/send-client/route.ts` para la forma exacta — incluye `consulta.*` y `body` a nivel raíz). Este workflow no usa HMAC, sólo necesita la URL.

## Paso 5 (opcional) — abrir proyecto

Igual que el anterior: el endpoint `/open-project` requiere cookie. La forma limpia es autenticarse y dar al botón. Una vez abierto, el workflow n8n `cqxT0uIYH7VB4Gir` (Crear Carpeta Drive Proyecto) crea la carpeta Drive con los 6 subfolders EASA Part 21J.

## Cleanup post-demo

```sql
-- Mueve o borra los datos de prueba cuando termines.
-- Ojo con ON DELETE en relaciones: doa_emails, doa_form_tokens, doa_projects
-- tienen FK hacia doa_incoming_requests; considera borrar en orden inverso
-- o respeta las cascadas definidas.
DELETE FROM doa_form_tokens WHERE incoming_request_id = '<incoming_request_id>';
DELETE FROM doa_emails      WHERE incoming_request_id = '<incoming_request_id>';
DELETE FROM doa_projects    WHERE incoming_request_id = '<incoming_request_id>';
DELETE FROM doa_incoming_requests WHERE id = '<incoming_request_id>';
```

## Ver también

- `docs/03-flujo-consultas.md` — flujo completo de la sección Quotations.
- `docs/n8n-workflows/` — especificaciones de los workflows que este pipeline dispara.
- Entrada de memoria `e2e-demo-run-2026-04-22` (engram) — ejecución de referencia que inspiró esta guía.
