# Flujo de Consultas Entrantes

## Resumen
Este documento explica como funciona el flujo principal de la aplicacion: desde que un cliente envia un email hasta que recibimos su formulario.

## Los 3 estados

### 1. Nuevo
- **Que significa**: Ha llegado una consulta de un cliente por email
- **Como llega**: n8n (nuestra herramienta de automatizacion) procesa el email y crea un registro en la app
- **Que ve el ingeniero**: La consulta aparece en /quotations como "Nuevo"
- **Que tiene que hacer**: Revisar la consulta y enviar una respuesta al cliente

### 2. Esperando formulario
- **Que significa**: El ingeniero ya envio el email de respuesta al cliente con un enlace a un formulario
- **Como llega**: El ingeniero pulsa "Enviar al cliente" en la app
- **Que pasa por detras**: La app llama a n8n, que envia el email real al cliente
- **Que ve el ingeniero**: La consulta pasa a "Esperando formulario"

### 3. Formulario recibido
- **Que significa**: El cliente ha completado y enviado el formulario
- **Como llega**: (Futuro) Un webhook recibira la respuesta del formulario y actualizara el estado
- **Que pasa despues**: Aqui entraran futuras fases de recoleccion de datos y automatizacion

## Diagrama del flujo

```
Cliente envia email
       ?
  n8n procesa el email
       ?
  Se crea registro en la app ? Estado: NUEVO
       ?
  Ingeniero revisa y envia respuesta con formulario
       ?
  n8n envia el email ? Estado: ESPERANDO_FORMULARIO
       ?
  Cliente rellena el formulario
       ?
  Webhook recibe respuesta ? Estado: FORMULARIO_RECIBIDO
       ?
  (Futuras fases de automatizacion)
```

## Donde esta el codigo

| Parte del flujo | Archivo | Que hace |
|-----------------|---------|----------|
| Tablero y lista de quotations | `app/(dashboard)/quotations/page.tsx` | Pagina principal con tablero visual de estados y bandeja de consultas |
| Cabecera, tabs y tablero | `app/(dashboard)/quotations/QuotationStatesBoard.tsx` | Selector de vistas, columnas reales, cards mock y alta local de estados |
| Panel de consultas nuevas | `app/(dashboard)/quotations/IncomingQueriesPanel.tsx` | Panel que muestra las consultas pendientes |
| Detalle de consulta | `app/(dashboard)/quotations/incoming/[id]/page.tsx` | Vista detallada de una consulta |
| Enviar al cliente | `app/api/consultas/[id]/send-client/route.ts` | API que envia el email via n8n |
| Estados | `lib/workflow-states.ts` | Definicion de los estados visuales del board y de las consultas entrantes |
| Tipos de datos | `types/database.ts` -> `ConsultaEntrante` | Estructura de datos de una consulta |
| Logica de estados | `app/(dashboard)/quotations/incoming-queries.ts` | Funciones para filtrar y normalizar estados |

## Como anadir un nuevo estado

1. Anadir el estado visual en `lib/workflow-states.ts` -> `QUOTATION_BOARD_STATES`
2. Anadir la configuracion visual en `QUOTATION_BOARD_STATE_CONFIG` (label, color, descripcion)
3. Si el estado tambien debe afectar al flujo de consultas, actualizar `CONSULTA_ESTADOS` y `CONSULTA_STATE_CONFIG`
4. Si necesitas filtrar por el nuevo estado, actualizar `incoming-queries.ts` o la vista del tablero
