# Buenas Prácticas de Desarrollo

Reglas que seguimos en este proyecto. Están pensadas para mantener el código limpio y predecible.

---

## Estructura de archivos

### Regla: Servidor vs Cliente
- `page.tsx` = componente del SERVIDOR. Aquí se cargan datos de Supabase.
- `NombreClient.tsx` = componente del CLIENTE. Aquí va la interfaz interactiva.
- **Nunca mezclar**: No poner queries de Supabase en componentes cliente, ni `useState`/`useEffect` en page.tsx.

### Regla: Un archivo, una responsabilidad
- Cada componente en su propio archivo
- Los tipos van en `types/database.ts`
- Las constantes de estado van en `lib/workflow-states.ts`
- Las utilidades de Supabase van en `lib/supabase/`

---

## Nombres y convenciones

| Qué | Convención | Ejemplo |
|-----|-----------|---------|
| Archivos de página | `page.tsx` (siempre) | `app/(dashboard)/clients/page.tsx` |
| Componentes cliente | PascalCase + "Client" | `ClientsPageClient.tsx` |
| Archivos de utilidad | camelCase | `incoming-queries.ts` |
| Variables CSS | kebab-case | `--color-primary` |
| Constantes | UPPER_SNAKE_CASE | `CONSULTA_ESTADOS` |
| Tipos TypeScript | PascalCase | `ConsultaEntrante` |
| Tablas Supabase | snake_case con prefijo `doa_` | `doa_consultas_entrantes` |

---

## Código limpio

### No hardcodear strings de estado
MAL:
```tsx
if (consulta.estado === 'nuevo') { ... }
```
BIEN:
```tsx
import { CONSULTA_ESTADOS } from '@/lib/workflow-states'
if (consulta.estado === CONSULTA_ESTADOS.NUEVO) { ... }
```

### No duplicar funciones
Si una función se usa en más de un archivo, moverla a `lib/`. Ejemplo: `isMissingSchemaError` está en `lib/supabase/errors.ts`.

### No dejar código comentado
Si no se usa, se borra. Git tiene el historial si algún día se necesita recuperar.

### Errores con contexto
MAL:
```tsx
console.error(error)
```
BIEN:
```tsx
console.error('Error cargando consultas entrantes:', error)
```

### Variables de entorno para URLs externas
MAL:
```tsx
const url = 'https://mi-webhook.com/endpoint'
```
BIEN:
```tsx
const url = process.env.MI_WEBHOOK_URL!
```

---

## Supabase

### Siempre verificar autenticación en APIs
```tsx
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
```

### Usar `createClient` del servidor en page.tsx
```tsx
import { createClient } from '@/lib/supabase/server'
```

### Manejar errores de query
```tsx
const { data, error } = await supabase.from('tabla').select('*')
if (error) {
  console.error('Error en query de tabla:', error)
  return []
}
```

---

## Estilos (Tailwind)

- Usar las clases de Tailwind directamente, no CSS custom
- Para colores del tema, usar las variables CSS definidas en `globals.css`
- El modo oscuro está siempre activo (clase `dark` en `<html>`)
- Para componentes nuevos, reutilizar los estilos de shadcn/ui cuando sea posible

---

## Antes de entregar cualquier cambio

1. ¿Compila sin errores? → `npm run build`
2. ¿Los imports son correctos? → No hay imports de archivos eliminados
3. ¿Los strings de estado vienen de constantes? → No hay strings sueltos
4. ¿La documentación está actualizada? → Si cambiaste algo, actualizar el doc correspondiente
5. ¿Las URLs están en variables de entorno? → No hay URLs hardcodeadas
