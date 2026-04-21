# Arquitectura de Workflows n8n — DOA (Design Organization Approval)

## Visión General

El sistema DOA utiliza n8n como engine de automatización para gestionar todo el ciclo de vida de las requests de clients aeronáuticos. La arquitectura se divide en **workflows independientes** que se comunican entre sí a través de **URLs dinámicas con IDs de Supabase** y **webhooks**.

---

## Mapa de Workflows

```
┌─────────────────────────────────────┐
│   WF1: Emails Entrantes            │
│   (Trigger: Outlook cada 1 min)     │
│                                     │
│   Outlook → IA Clasifica → Prepara  │
│   Path → IA Redacta → Normaliza →   │
│   Supabase INSERT → Marcar Leído    │
│                                     │
│   Output: URL con ID embebido       │
│   sent al client por email      │
└──────────────┬──────────────────────┘
               │
               │ (El client hace clic en la URL
               │  horas/días después)
               ▼
┌─────────────────────────────────────┐
│   WF2: Web Server Forms       │
│   (Trigger: Webhook GET /doa-form)  │
│                                     │
│   Webhook → Supabase GET request → │
│   Supabase GET contacto →           │
│   Supabase GET empresa →            │
│   Google Drive HTML → Inyectar →    │
│   Responder HTML al navegador       │
│                                     │
│   Output: Form HTML           │
│   personalizado en el navegador     │
└──────────────┬──────────────────────┘
               │
               │ (El client llena y envía
               │  el form)
               ▼
┌─────────────────────────────────────┐
│   WF3: Send Email al Client     │
│   (Trigger: Llamada desde App)      │
│                                     │
│   Recibe payload → Supabase UPDATE  │
│   → Outlook envía email            │
│                                     │
│   Output: Email sent al client  │
└─────────────────────────────────────┘
```

---

## WF1: DOA - 0 - Outlook a App (Emails Entrantes)

**ID:** `pEFW1V46yyLR58c8`
**Trigger:** Microsoft Outlook Trigger (polling cada 1 minuto, emails no leídos)
**Status:** Active en producción

### Cadena de Nodos (Versión Activa / Producción)

```
Outlook Trigger
    → Clasificar Email IA (OpenAI GPT-5.2)
        → Prepare Path (Code JS)
            → Redactar Response IA (OpenAI GPT-5.2)
                → Normalizar Email (Code JS)
                    → Edit Fields (Set)
                        → Insertar en Supabase (INSERT doa_incoming_requests)
                            → Marcar Email como Leído (Outlook Update)
```

### Cadena de Nodos (Versión Draft / En desarrollo)

```
Outlook Trigger
    → Clasificar Email IA
        → Switch (Classification)
            ├─ Project New ──┐
            └─ Modificación ────┤
                                ▼
                            Merge
                                → Crear fila en entrantes (Supabase INSERT)
                                    → Filtro Email entrante (Set: extrae ID de Supabase)
                                        → Ver si el client es conocido (Supabase GET doa_client_contacts)
                                            → Actualizar Fila entrantes (Supabase UPDATE)
                                                → Switch1 (¿Client conocido?)
                                                    ├─ Conocido → Get a row1 (empresa) → Data empresa (Set) → Generar URL Form → Redactar Response IA → Normalizar → Edit Fields → Insertar Supabase → Marcar Leído
                                                    └─ No Conocido → Generar URL Form → ...
```

### Nodo Clave: "Prepare Path" (Code JS)

Este nodo centraliza toda la lógica de classification y enrutamiento:

- **Input:** Payload crudo de OpenAI con la classification
- **Lógica:**
  - Parsea el JSON de la IA (con fallback robusto para múltiples formatos)
  - Normaliza la classification a una de 3 etiquetas canónicas:
    - `Client solicita project new`
    - `Client solicita modificacion a project existente`
    - `Classification pending`
  - Asigna `form_variant` (type de form) y `route_instruction` (instrucción operativa para la IA redactora)
  - **Genera la URL pública del form** con el dominio de producción

- **Output:** Objeto limpio con: `subject`, `sender`, `original_body`, `clasificacion_canonica`, `razon_clasificacion`, `form_variant`, `route_instruction`, `public_form_url`

### Nodo Clave: "Generar URL Form" (Set)

- **Expresión:** `={{ 'https://sswebhook.testn8n.com/webhook/doa-form?id=' + $('Filtro Email entrante').first().json.id.supabase.doa.requests.entrantes }}`
- **Propósito:** Construye la URL dinámica que conecta WF1 con WF2 a través del ID de Supabase

### Tablas Supabase Involucradas

| Table | Operación | Propósito |
|-------|-----------|-----------|
| `doa_incoming_requests` | INSERT | Guardar cada email entrante clasificado |
| `doa_client_contacts` | GET | Buscar si el sender es un contacto conocido |
| `doa_clients` | GET | Obtener data de la empresa del contacto |

### Credenciales Utilizadas

- **Microsoft Outlook OAuth2** (`LWbjIUOv0OUB6zRO`)
- **OpenAI API** (`vAmNhoKH5n8YHlp6`) — Model: GPT-5.2
- **Supabase API** (`H1ZHvBDstWZ1K6KS`)
- **Google Drive OAuth2** (`q2a47wq7RmewYPQG`)

---

## WF2: DOA - Web Server Forms Clients (Dinámico)

**ID:** `GCLA8OK26yNr90cd`
**Trigger:** Webhook GET en `/webhook/doa-form`
**URL Producción:** `https://sswebhook.testn8n.com/webhook/doa-form`
**Status:** Active en producción

### Cadena de Nodos

```
Webhook Servidor GET (recibe ?id=xxx)
    → Buscar Request (Supabase GET doa_incoming_requests por id)
        → Buscar Contacto (Supabase GET doa_client_contacts por email del sender)
            → Buscar Empresa (Supabase GET doa_clients por client_id)
                → Descargar Plantilla HTML (Google Drive: formulario_cliente_conocido.txt)
                    → Extraer Texto HTML (Extract from File → text drawing)
                        → Inyectar Data en HTML (Code JS)
                            → Responder Navegador (Respond to Webhook con Content-Type: text/html)
```

### Nodo Clave: "Inyectar Data en HTML" (Code JS)

Reemplaza placeholders en la template HTML:

| Placeholder | Dato | Fuente |
|-------------|------|--------|
| `{{CLIENT_COMPANY_NAME}}` | Name de la empresa | Nodo "Buscar Empresa" |
| `{{CLIENT_CONTACT_FULL_NAME}}` | Name + Apellidos | Nodo "Buscar Contacto" |
| `{{CLIENT_CONTACT_EMAIL}}` | Email del contacto | Nodo "Buscar Contacto" |
| Campo oculto `incoming_request_id` | ID de la request | Query param del Webhook (`?id=xxx`) |

### Patrón de Comunicación con WF1

```
WF1 genera URL: https://sswebhook.testn8n.com/webhook/doa-form?id={UUID}
                                                                    │
WF2 Webhook recibe ─────────────────────────────────────────────────┘
    → Extrae: $json.query.id
    → Usa ese ID para buscar en Supabase
    → Sirve HTML personalizado
```

---

## WF3: DOA - Send Email al Client

**Trigger:** Webhook (llamado desde la aplicación React)
**Propósito:** Envía el email final al client después de que un humano apruebe el borrador de la IA.

### Cadena de Nodos

```
Webhook (recibe payload con id, email, subject, body)
    → Normalizar Payload Envio (Code JS)
        → Supabase UPDATE doa_incoming_requests (status → "sent")
            → Outlook Send Email
```

### Nodo Clave: "Update a row" (Supabase)

- **Match por:** columna `id` usando `incoming_request_id` del payload
- **Campos actualizados:** `status`, `respuesta_enviada`, `fecha_envio`

---

## Tablas Supabase (Schema Completo)

### `doa_incoming_requests`
| Columna | Tipo | Description |
|---------|------|-------------|
| `id` | UUID (PK, auto) | Identificador único de la request |
| `subject` | text | Subject del email |
| `sender` | text | Email del sender |
| `original_body` | text | Preview del body del email |
| `classification` | text | Classification canónica de la IA |
| `ai_response` | text | Borrador de response generado por IA |
| `status` | text | Status del ciclo: new, sent, completed |
| `created_at` | timestamptz | Date de creación |

### `doa_client_contacts`
| Columna | Tipo | Description |
|---------|------|-------------|
| `id` | UUID (PK) | ID del contacto |
| `email` | text | Email del contacto (clave de search) |
| `name` | text | Name del contacto |
| `last_name` | text | Apellidos del contacto |
| `client_id` | UUID (FK) | Referencia a doa_clients |

### `doa_clients`
| Columna | Tipo | Description |
|---------|------|-------------|
| `id` | UUID (PK) | ID de la empresa |
| `name` | text | Name de la empresa |
| `vat_tax_id` | text | CIF/VAT de la empresa |
| `country` | text | Country |
| `city` | text | City |
| `address` | text | Address |
| `phone` | text | Phone |
| `website` | text | Sitio website |
| `email_domain` | text | Dominio de email corporativo |
| `client_type` | text | Tipo de client |

---

## Plantillas HTML (Google Drive)

| Archivo | ID Google Drive | Uso |
|---------|-----------------|-----|
| `formulario_cliente_conocido.txt` | `1Clb0bv9zeGTRcBdLEHKAoO6cBCelx-pS` | Form para clients ya registrados en la base de data |

### Placeholders disponibles en el HTML

- `{{CLIENT_COMPANY_NAME}}` — Name de la empresa
- `{{CLIENT_CONTACT_FULL_NAME}}` — Name completo del contacto
- `{{CLIENT_CONTACT_EMAIL}}` — Email del contacto
- Campo oculto `incoming_request_id` — Se inyecta dinámicamente con el UUID de la request

---

## URLs y Endpoints

| Endpoint | Método | Workflow | Propósito |
|----------|--------|----------|-----------|
| `/webhook/doa-form` | GET | WF2 | Servir form HTML al client |
| Dominio: `sswebhook.testn8n.com` | — | Producción webhooks | Base URL para webhooks de producción |
| Dominio: `ssn8n.testn8n.com` | — | Test webhooks | Base URL para webhooks de desarrollo/test |

---

## Restricciones y Lecciones Aprendidas

1. **Trim obligatorio en emails:** Los emails de Outlook vienen con espacios invisibles. Siempre usar `.trim()` antes de buscar en Supabase.
2. **Nodo HTML de n8n ≠ servidor HTML:** El nodo "HTML" de n8n sirve para *extraer* data de HTML, NO para servir páginas website. Usar "Respond to Webhook" con Content-Type `text/html`.
3. **Variables con puntos en n8n:** Si nombras una variable `id.supabase.doa`, n8n la convierte en un objeto anidado (`json.id.supabase.doa`), NO en una clave con puntos literales. Acceder con notación de puntos, no con corchetes.
4. **Webhook URLs:** El dominio de producción para webhooks es `sswebhook.testn8n.com`, diferente al dominio de la interfaz `ssn8n.testn8n.com`.
5. **API de n8n para schema del Switch:** La API de n8n rechaza payloads del Switch si faltan campos internos como `version`, `id`, etc. Es más seguro hacer cambios en el Switch desde la interfaz visual.
6. **responseMode del Webhook:** Para servir HTML, el Webhook debe usar `responseMode: "responseNode"` y tener un nodo "Respond to Webhook" al final de la cadena.

---

## Pendientes / Roadmap

1. **WF4: Receptor de Forms (POST)** — Workflow con Webhook POST que reciba los data que el client llena en el form HTML y actualice `doa_incoming_requests` en Supabase.
2. **Rama "Client No Conocido"** — Implementar lógica para clients nuevos no registrados en la base de data (onboarding).
3. **Form para modificaciones** — Crear template HTML diferenciada para solicitudes de modificación de projects existentes.
4. **Activación en producción** — Migrar las URLs de test a las URLs de producción definitivas cuando el servidor n8n se estabilice.
