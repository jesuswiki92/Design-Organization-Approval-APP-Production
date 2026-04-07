/**
 * INFORMACION DE LA VERSION ACTUAL DE LA APLICACION
 *
 * Este archivo contiene los datos de la version publicada de la app DOA Operations Hub.
 * Estos datos se muestran en la interfaz (por ejemplo, en el pie de pagina o en
 * la pantalla de "Acerca de") para que los usuarios sepan que version estan usando.
 *
 * Cada vez que se publica una nueva version de la app, se actualiza este archivo
 * con la fecha, el numero de version y un nombre descriptivo de la actualizacion.
 */

import packageJson from '@/package.json'

// Datos de la version actual de la app
// - version: identificador tecnico de la version (formato: ano.mes.dia-identificador)
// - updatedAtLabel: fecha de la ultima actualizacion en formato legible (dia/mes/ano)
// - releaseName: nombre descriptivo de esta actualizacion para identificarla facilmente
export const APP_RELEASE = {
  version: packageJson.version,
  updatedAtLabel: '29/03/2026',
  releaseName: 'Saneamiento Lote 6',
} as const
