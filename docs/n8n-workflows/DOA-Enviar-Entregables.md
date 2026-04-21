# n8n workflow: DOA-Enviar-Entregables

Runbook del workflow que envia el Statement of Compliance al cliente tras pulsar "Enviar entrega" en la pestana Entrega del detalle de proyecto.

Esto es solo un documento de referencia. El workflow en si se importa en la instancia n8n de la organizacion.

## Proposito

Recibir una peticion HTTP desde la app (`POST /api/proyectos/{id}/enviar-entrega`), descargar el PDF firmado desde la URL temporal de Supabase Storage, componer un email al cliente con el PDF adjunto y un boton de confirmacion, y devolver el `execution_id` a la app para que lo persista en la fila de `doa_project_deliveries`.

## Trigger

- **Webhook** (`n8n-nodes-base.webhook`), HTTP POST.
- Path: p. ej. `doa-enviar-entregables`.
- La URL publica resultante va a `N8N_DELIVERY_WEBHOOK_URL` en el entorno de la app.
- Autenticacion: `Header Auth` opcional; el flujo usa en su lugar verificacion HMAC propia (paso siguiente).

### Body esperado

```
{
  "delivery_id": "<uuid>",
  "proyecto_id": "<uuid>",
  "recipient_email": "cliente@empresa.com",
  "recipient_name": "Nombre apellido" | null,
  "cc_emails": ["cc1@x.com", "cc2@y.com"] | null,
  "subject": "Statement of Compliance — <titulo>",
  "body": "Cuerpo del email en texto plano",
  "soc_pdf_signed_url": "https://<supabase>/storage/v1/object/sign/...",
  "soc_pdf_sha256": "<hex>",
  "confirmation_link": "https://<app>/api/proyectos/<id>/confirmar-entrega?token=..."
}
```

### Cabecera HMAC

Si la app tiene `DOA_N8N_WEBHOOK_SECRET` configurado, incluye:

```
x-doa-signature: <hex(hmac_sha256(raw_body, DOA_N8N_WEBHOOK_SECRET))>
```

Si no llega esa cabecera, la app ya ha registrado en logs que el secreto no estaba configurado. El workflow puede aceptar la peticion, pero se recomienda rechazar con 401 en produccion.

## Nodos

### 1. Webhook (trigger)
- Method: POST
- Response mode: "When Last Node Finishes"
- Response code: 200
- Response data: "Last Node"

### 2. Function — HMAC Verify
Recibe el raw body y la cabecera `x-doa-signature`. Calcula `hmac_sha256(raw_body, $env.DOA_N8N_WEBHOOK_SECRET)` en hex y compara via timing-safe equality.

- Si no coincide -> retorna `{ ok: false, status: 401 }` y el flujo corta aqui.
- Si coincide -> deja los items pasar.

Nota: en n8n el raw body se consigue con el webhook configurado en "Raw body" ON; luego se parsea dentro del Function node.

### 3. HTTP Request — Descargar PDF
- Method: GET
- URL: `{{$json.soc_pdf_signed_url}}`
- Response format: "File" (binary)
- Property name: `soc_pdf`

Produce un binary property `soc_pdf` con `application/pdf` que los nodos de email pueden adjuntar.

### 4. Gmail / SMTP — Enviar email al cliente

Opcion A (Gmail): nodo `Gmail` con credenciales OAuth2 de una cuenta corporativa.

- To: `{{$json.recipient_email}}`
- CC: `{{$json.cc_emails ? $json.cc_emails.join(",") : ""}}`
- Subject: `{{$json.subject}}`
- Message (HTML):
  - Parrafo saludo
  - El contenido de `body` convertido a HTML (conservar saltos de linea)
  - Un boton de llamada a la accion:
    `<a href="{{$json.confirmation_link}}">Confirmar recepcion</a>`
  - Firma DOA
- Attachments:
  - Nombre: `Statement_of_Compliance.pdf`
  - Binary property: `soc_pdf`

Opcion B (SMTP): nodo `Send Email`. Mismos campos, adjuntar via propiedad binaria.

### 5. Respond to Webhook
- Status: 200
- Body JSON: `{ "execution_id": "{{$execution.id}}" }`

La app lee ese `execution_id` y lo persiste en `doa_project_deliveries.n8n_execution_id`.

## Ruta de error

- Wrap de los nodos sensibles con "Continue On Fail" desactivado.
- Al final del workflow, anade un nodo "Error Trigger" (o un branch con "IF" tras cada nodo critico) que apunte a un `Respond to Webhook` con status 500 y un cuerpo:
  `{ "error": "<mensaje>" }`.
- La app interpreta cualquier respuesta no-2xx como `dispatch_status='fallo'` y registra el evento `project.delivery.send_failed` con `severity=error`.

## Variables de entorno en n8n

Definir en n8n (Settings -> Environment o `.env` del host):

- `DOA_N8N_WEBHOOK_SECRET` — el mismo valor que `DOA_N8N_WEBHOOK_SECRET` en la app.
- Credenciales Gmail/SMTP.

## Pruebas manuales

1. En la app, llegar a un proyecto en estado `preparando_entrega` con una delivery pendiente.
2. Disparar el envio desde la pestana Entrega.
3. Verificar en n8n que la ejecucion entro y completo los pasos.
4. Verificar que llega el email con el PDF adjunto y el boton de confirmacion.
5. Pulsar el boton y comprobar que:
   - Se devuelve el HTML de agradecimiento.
   - `doa_project_deliveries.dispatch_status = 'confirmado_cliente'`.
   - `doa_proyectos.estado_v2 = 'confirmacion_cliente'`.

## TODO

- Anadir retry automatico para fallos transitorios de SMTP/Gmail.
- Considerar plantilla HTML profesional (MJML) para el cuerpo del email.
- Limitar por IP/header en el webhook en produccion.
