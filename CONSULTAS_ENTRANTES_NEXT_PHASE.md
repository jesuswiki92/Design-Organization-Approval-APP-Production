# Consultas Entrantes: siguiente fase

## Objetivo

Reservar la bandeja `Consultas entrantes` solo para nuevas entradas pendientes de triage.

Cuando el usuario pulse `Revisado. Enviar a cliente` y el webhook responda correctamente:

- la consulta debe pasar a estado `espera_formulario_cliente`
- debe salir de la bandeja principal de `Consultas entrantes`
- debe quedar trazado que ya se envio una respuesta al cliente

## Hallazgo actual

La UI actual no persiste el estado real de la consulta.

Punto concreto:

- [incoming-queries.ts](C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\app\(dashboard)\quotations\incoming-queries.ts) asigna siempre `estado: 'nuevo'` en memoria

Eso significa que hoy:

- la bandeja no diferencia entre consulta nueva y consulta ya respondida
- el boton de enviar correo no mueve la consulta a un estado persistente

## Columnas minimas recomendadas en `public.doa_consultas_entrantes`

- `estado text not null default 'nuevo'`
- `cliente_id uuid null`
- `contacto_id uuid null`
- `correo_cliente_enviado_at timestamptz null`
- `correo_cliente_enviado_by uuid null`
- `ultimo_borrador_cliente text null`
- `contexto_enriquecido jsonb not null default '{}'::jsonb`

## Estados recomendados

- `nuevo`
- `en_revision`
- `espera_formulario_cliente`
- `convertida_a_quotation`
- `descartada`

## Comportamiento recomendado

### Bandeja principal

La query de [page.tsx](C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\app\(dashboard)\quotations\page.tsx) deberia mostrar solo:

- `estado = 'nuevo'`
- y de forma transitoria, `estado is null` para compatibilidad con registros viejos

### Al enviar correo al cliente

Tras un `200 OK` del webhook en [route.ts](C:\Users\Jesús Andrés\Desktop\Aplicaciones - Desarrollo\Design Organization Approval - APP Production\01.Desarrollo de App\app\api\consultas\[id]\send-client\route.ts), deberia ejecutarse un `update` sobre la consulta:

- `estado = 'espera_formulario_cliente'`
- `correo_cliente_enviado_at = now()`
- `ultimo_borrador_cliente = <mensaje final enviado>`

Si ya esta resuelto el mapeo con cliente/contacto:

- `cliente_id = <cliente conocido>`
- `contacto_id = <contacto conocido>`

## Enriquecimiento con cliente conocido

Para el caso demo de `jesus.arevalotorres@gmail.com`, el encaje recomendado es:

- match exacto por email contra `doa_clientes_contactos.email`
- si existe contacto, resolver `cliente_id` desde `cliente_id`
- cargar contexto comercial:
  - nombre del cliente
  - contacto conocido
  - proyectos previos relacionados
  - modelo/plataforma recurrente

## Resultado esperado

Con esto, una consulta nueva de un contacto conocido:

- entra en `Consultas entrantes`
- se enriquece con cliente/contacto/proyectos previos
- al enviar el correo, desaparece de la bandeja
- queda trazada en `espera_formulario_cliente`
- mas adelante puede pasar a `convertida_a_quotation`
