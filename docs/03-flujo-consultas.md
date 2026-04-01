# Flujo de Consultas Entrantes

## Resumen
Este documento explica como funciona el flujo principal de la aplicacion: desde que un cliente envia un email hasta que recibimos su formulario.

## Los 3 estados

### 1. Nueva entrada
- **Que significa**: Ha llegado una consulta de un cliente por email
- **Como llega**: n8n (nuestra herramienta de automatizacion) procesa el email y crea un registro en la app
- **Que ve el ingeniero**: La consulta aparece en /quotations como "Nueva entrada"
- **Que tiene que hacer**: Revisar la consulta y enviar una respuesta al cliente

### 2. Formulario enviado
- **Que significa**: El ingeniero ya envio el email de respuesta al cliente con un enlace a un formulario
- **Como llega**: El ingeniero pulsa "Enviar al cliente" en la app
- **Que pasa por detras**: La app llama a n8n, que envia el email real al cliente
- **Que ve el ingeniero**: La consulta pasa a "Formulario enviado"

### 3. Formulario recibido. Revisar
- **Que significa**: El cliente ha completado y enviado el formulario
- **Como llega**: (Futuro) Un webhook recibira la respuesta del formulario y actualizara el estado
- **Que pasa despues**: Aqui entraran futuras fases de recoleccion de datos y automatizacion

## Diagrama del flujo

```
Cliente envia email
       ?
  n8n procesa el email
       ?
  Se crea registro en la app ? Estado: NUEVA ENTRADA
       ?
  Ingeniero revisa y envia respuesta con formulario
       ?
  n8n envia el email ? Estado: FORMULARIO_ENVIADO
       ?
  Cliente rellena el formulario
       ?
  Webhook recibe respuesta ? Estado: FORMULARIO_RECIBIDO_REVISAR
       ?
  (Futuras fases de automatizacion)
```

## Donde esta el codigo

| Parte del flujo | Archivo | Que hace |
|-----------------|---------|----------|
| Workspace de quotations | `app/(dashboard)/quotations/page.tsx` | Pagina principal con tablero/lista y la base visual del flujo comercial |
| Cabecera, tabs y tablero | `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | Selector de vistas, columnas reales, cards mock, alta y borrado local de estados |
| Datos compartidos de quotations | `app/(dashboard)/quotations/quotation-board-data.ts` | Datos mock, helpers de persistencia local y normalizacion de estados |
| Detalle de quotation | `app/(dashboard)/quotations/[id]/page.tsx` | Pagina de detalle con bloques preparados para crecer |
| Panel de consultas nuevas | `app/(dashboard)/quotations/IncomingQueriesPanel.tsx` | Panel que muestra las consultas pendientes |
| Detalle de consulta | `app/(dashboard)/quotations/incoming/[id]/page.tsx` | Vista detallada de una consulta |
| Enviar al cliente | `app/api/consultas/[id]/send-client/route.ts` | API que envia el email via n8n |
| Estados | `lib/workflow-states.ts` | Definicion de los estados visuales del board y de las consultas entrantes |
| Configuracion editable de estados | `lib/workflow-state-config.ts` + `app/api/workflow/state-config/route.ts` | Capa que separa codigo tecnico y label visible, con persistencia en Supabase |
| Tipos de datos | `types/database.ts` -> `ConsultaEntrante` | Estructura de datos de una consulta |
| Logica de estados | `app/(dashboard)/quotations/incoming-queries.ts` | Funciones para filtrar y normalizar estados |

## Estado actual de la UI

- Las cards del tablero de quotations incluyen `Mas detalle` y abren `/quotations/[id]`.
- La vista `Lista` usa los mismos datos del board para mantener coherencia visual.
- Los estados nuevos de quotations se crean y eliminan localmente por ahora.
- Los estados base de `Quotations` y del flujo de consultas ya pueden renombrarse, reordenarse y recolorearse desde la propia app sin cambiar el `state_code` tecnico.
- La seccion visible de `Engineering` ya se presenta como `Proyectos` y tiene vistas `Tablero` y `Lista` mock.

## Como anadir un nuevo estado

1. Anadir el estado visual en `lib/workflow-states.ts` -> `QUOTATION_BOARD_STATES`
2. Anadir la configuracion visual en `QUOTATION_BOARD_STATE_CONFIG` (label, color, descripcion)
3. Si el estado tambien debe afectar al flujo de consultas, actualizar `CONSULTA_ESTADOS` y `CONSULTA_STATE_CONFIG`
4. Si necesitas filtrar por el nuevo estado, actualizar `incoming-queries.ts` o la vista del tablero
