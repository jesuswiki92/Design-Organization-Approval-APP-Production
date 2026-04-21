/**
 * CARGA DE CONFIGURACION DE ESTADOS DE FLUJO DE TRABAJO (SOLO SERVIDOR)
 *
 * Este archivo se ejecuta SOLO en el servidor (nunca en el navegador del user_label).
 * Su funcion es leer de la base de data la configuracion personalizada de los
 * statuses de los flujos de trabajo (como los statuses del tablero de cotizaciones
 * o los statuses de las requests entrantes).
 *
 * La table "doa_workflow_state_config" en Supabase almacena como se llaman,
 * que color tienen y en que sort_order aparecen los statuses de cada flujo.
 * Si un administrador cambia el name o color de un status, ese cambio
 * se guarda en esa table y este archivo lo lee para aplicarlo en la app.
 *
 * El resultado se guarda en cache (memoria temporal) para no consultar
 * la base de data cada vez que se necesita esta informacion durante
 * la misma peticion del user_label.
 */

import 'server-only'

import { cache } from 'react'

import { isMissingSchemaError } from '@/lib/supabase/errors'
import { createClient } from '@/lib/supabase/server'
import type { WorkflowStateConfigRow, WorkflowStateScope } from '@/types/database'

/**
 * Lee de la base de data las filas de configuracion de statuses para los ambitos solicitados.
 *
 * Esta funcion esta envuelta en "cache" de React, lo que significa que si se llama
 * varias veces con los mismos parametros durante la misma peticion del user_label,
 * solo se hace UNA request a la base de data (las demas usan el resultado guardado).
 *
 * @param scopes - Lista de ambitos de flujo de trabajo a consultar
 *                 (por ejemplo: "incoming_queries" para requests, "quotation_board" para cotizaciones)
 * @returns Lista de filas de configuracion de statuses, o una lista vacia si hay error
 */
export const getWorkflowStateConfigRows = cache(
  async (scopes: WorkflowStateScope[]): Promise<WorkflowStateConfigRow[]> => {
    try {
      // Crear la conexion a Supabase desde el servidor
      const supabase = await createClient()

      // Consultar la table de configuracion de statuses, filtrando por los ambitos solicitados
      // y ordenando primero por ambito y luego por el sort_order de aparicion (sort_order)
      const { data, error } = await supabase
        .from('doa_workflow_state_config')
        .select(
          'id, scope, state_code, label, short_label, description, color_token, sort_order, is_system, is_active, created_at, updated_at',
        )
        .in('scope', scopes)
        .order('scope', { ascending: true })
        .order('sort_order', { ascending: true })

      if (error) {
        // Si el error es porque la table o columnas no existen aun, se ignora silenciosamente
        // (esto pasa cuando hay migraciones pendientes en la base de data)
        if (!isMissingSchemaError(error)) {
          console.error('Error cargando workflow state config:', error)
        }

        return []
      }

      return (data ?? []) as WorkflowStateConfigRow[]
    } catch (error) {
      // Si ocurre cualquier error inesperado, se registra y se devuelve lista vacia
      // para que la app no se rompa
      console.error('Unexpected workflow state config error:', error)
      return []
    }
  },
)
