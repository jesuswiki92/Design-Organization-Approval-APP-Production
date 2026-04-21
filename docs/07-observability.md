# Observability Phase 1

## Alcance

La app registra eventos operativos de fase 1 en `public.doa_app_events` mediante:

- `lib/observability/server.ts` para eventos desde routes y server-side helpers
- `lib/observability/client.ts` para eventos UI enviados a `POST /api/observability/events`
- `components/observability/RouteViewTracker.tsx` para page views del dashboard y login

## Cobertura inicial

- Vistas de ruta del dashboard y login
- Login y logout
- Cambio de estado de proyectos
- Cambio de estado de consultas / quotations
- Envio al cliente (`send-client`)
- Guardado de quotation
- Guardado de documentos de compliance
- Alta/baja de referencias
- Inicio/fin de temporizador
- Edicion y borrado manual de entradas de horas desde el navegador

## Disciplina de datos

- No se guardan cuerpos de email, HTML de mensajes, subjects completos ni payloads sensibles.
- Los helpers redaccionan claves sensibles (`body`, `message`, `email`, `token`, `payload`, etc.) y recortan strings largos.
- Para operaciones de correo se registran solo metadatos operativos, por ejemplo longitud del mensaje, si habia URL de formulario y el resultado.

## Uso operativo

Consulta rapida en Supabase:

```sql
select created_at, event_name, outcome, route, entity_type, entity_id, metadata
from public.doa_app_events
order by created_at desc
limit 100;
```

## Superficie operativa en la app

- `/settings/logs` ofrece una lectura protegida por auth guard para soporte rapido.
- La pagina usa `requireUserAction()` + `createAdminClient()` para leer `doa_app_events` en servidor.
- El panel resume fallos recientes, tipos de evento dominantes, ultima accion operativa y detalle por evento con metadata redacted.

## Siguiente expansion natural

- Añadir vistas SQL agregadas por flujo y usuario
- Enlazar `request_id` con logs del runtime / proxy
- Instrumentar mas mutaciones directas a Supabase y errores de carga de datos
