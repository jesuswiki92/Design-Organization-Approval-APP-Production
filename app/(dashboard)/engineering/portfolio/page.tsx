/**
 * Portfolio de proyectos (engineering).
 *
 * La vista Lista quedo deprecada (filtraba vacio por desajuste entre `estado`
 * legacy y `estado_v2`). La unica vista soportada es el Tablero, que agrupa
 * proyectos por los 13 estados v2 en 4 fases. Esta ruta redirige al tablero
 * para preservar enlaces existentes.
 */
import { redirect } from 'next/navigation'

export default function EngineeringPortfolioPage() {
  redirect('/engineering/portfolio/tablero')
}
