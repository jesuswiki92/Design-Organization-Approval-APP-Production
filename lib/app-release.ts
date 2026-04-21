/**
 * INFORMACION DE LA VERSION ACTUAL DE LA APLICACION
 *
 * Este archivo contiene los data de la version publicada de la app DOA Operations Hub.
 * Estos data se muestran en la interfaz (por ejemplo, en el pie de page o en
 * la pantalla de "Acerca de") para que los users sepan que version estan usando.
 *
 * Cada vez que se publica una new version de la app, se actualiza este archivo
 * con la date, el numero de version y un name descriptivo de la actualizacion.
 */

import packageJson from '@/package.json'

// Data de la version actual de la app
// - version: identificador technical de la version (formato: ano.mes.dia-identificador)
// - updatedAtLabel: date de la ultima actualizacion en formato legible (dia/mes/ano)
// - releaseName: name descriptivo de esta actualizacion para identificarla facilmente
export const APP_RELEASE = {
  version: packageJson.version,
  updatedAtLabel: '29/03/2026',
  releaseName: 'Saneamiento Lote 6',
} as const
