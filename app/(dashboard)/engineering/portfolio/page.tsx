/**
 * Portfolio de projects (engineering).
 *
 * La vista Lista quedo deprecada (filtraba vacio por desajuste entre `status`
 * legacy y `execution_status`). La unica vista soportada es el Tablero, que agrupa
 * projects por los 13 statuses v2 en 4 fases. Esta path redirige al tablero
 * para preservar enlaces existentes.
 */
import { redirect } from 'next/navigation'

export default function EngineeringPortfolioPage() {
  redirect('/engineering/portfolio/tablero')
}
