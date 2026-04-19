#!/usr/bin/env node
// DOA Flow Watcher — polling live de BD + filesystem
// Uso: node scripts/watch-flow.mjs  (Ctrl+C para detener)

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// ─────────────────────────── Config ───────────────────────────

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ENV_PATH = path.resolve(__dirname, '..', '.env.local')
const POLL_MS = 2000

const FS_WATCH_DIR =
  'C:\\Users\\Jesús Andrés\\Desktop\\Aplicaciones - Desarrollo\\Design Organization Approval - APP Production\\02. Datos DOA\\00. APP sinulation\\01. DOA_ENTRADAS'

// ─────────────────────── dotenv parser ligero ───────────────────────

async function loadEnv(filepath) {
  const raw = await fs.readFile(filepath, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!(key in process.env)) process.env[key] = val
  }
}

// ─────────────────────── Colores (ANSI básico) ───────────────────────

const useColor = process.stdout.isTTY
const c = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s)
const gray = (s) => c('90', s)
const green = (s) => c('32', s)
const yellow = (s) => c('33', s)
const cyan = (s) => c('36', s)
const magenta = (s) => c('35', s)
const red = (s) => c('31', s)
const bold = (s) => c('1', s)

function ts() {
  const d = new Date()
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return gray(`[${hh}:${mm}:${ss}]`)
}

function log(...parts) {
  console.log(ts(), ...parts)
}

// ─────────────────────── Utilidades ───────────────────────

function short(val, n = 80) {
  if (val == null) return ''
  const s = String(val).replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n - 1) + '…' : s
}

function pickFirst(row, keys) {
  for (const k of keys) {
    if (row && row[k] != null && row[k] !== '') return { key: k, value: row[k] }
  }
  return null
}

// Set de errores ya reportados (evitar spam si una columna no existe)
const reportedErrors = new Set()
function reportOnce(tag, err) {
  const key = `${tag}:${err?.code || err?.message || err}`
  if (reportedErrors.has(key)) return
  reportedErrors.add(key)
  log(red(`⚠️  error [${tag}]: ${err?.message || err}`))
}

// ─────────────────────── Estado previo ───────────────────────

const prev = {
  consultas: new Map(), // id -> snapshot
  respuestas: new Set(), // ids
  proyectos: new Map(), // id -> snapshot
  eventos: new Set(), // ids
  fs: new Map(), // path -> mtimeMs
}

const disabled = new Set() // tags desactivados por error repetido

// ─────────────────────── Pollers BD ───────────────────────

async function pollConsultas(sb) {
  if (disabled.has('consultas')) return
  const { data, error } = await sb
    .from('ams_consultas_entrantes')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    reportOnce('consultas', error)
    return
  }
  const first = prev.consultas.size === 0
  for (const row of data) {
    const id = row.id
    const numero = row.numero_entrada || row.numero || row.id
    const estado = row.estado || row.status || null
    const asunto = row.asunto || row.subject || ''
    const remitente = row.remitente || row.cliente_email || row.email || ''
    const respuestaIa = row.respuesta_ia || null
    const urlForm = row.url_formulario || null

    const old = prev.consultas.get(id)
    if (!old) {
      if (!first) {
        log(
          green('✅ NUEVA CONSULTA'),
          bold(numero),
          gray('|'),
          `remitente=${short(remitente, 40)}`,
          gray('|'),
          `asunto=${short(asunto, 60)}`,
          gray('|'),
          `estado=${yellow(estado ?? '—')}`,
        )
      }
    } else {
      if (old.estado !== estado) {
        log(
          cyan('🔄'),
          bold(numero),
          `${yellow(old.estado ?? '—')} → ${yellow(estado ?? '—')}`,
        )
      }
      if (!old.respuestaIa && respuestaIa) {
        log(
          magenta('🤖'),
          bold(numero),
          `IA generó respuesta (${String(respuestaIa).length} chars)`,
        )
      }
      if (!old.urlForm && urlForm) {
        log(cyan('📋'), bold(numero), `formulario asignado → ${short(urlForm, 100)}`)
      }
    }
    prev.consultas.set(id, { estado, respuestaIa, urlForm })
  }
}

async function pollRespuestas(sb) {
  if (disabled.has('respuestas')) return
  const { data, error } = await sb
    .from('ams_respuestas_formularios')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    reportOnce('respuestas', error)
    // Si la tabla no existe, no tiene sentido seguir
    if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
      disabled.add('respuestas')
    }
    return
  }
  const first = prev.respuestas.size === 0
  for (const row of data) {
    const id = row.id
    if (prev.respuestas.has(id)) continue
    if (!first) {
      const consultaId =
        row.consulta_id ||
        row.consulta_entrante_id ||
        row.id_consulta ||
        row.consulta ||
        '?'
      log(cyan('📝'), `Respuesta formulario recibida para consulta_id=${bold(consultaId)}`)
    }
    prev.respuestas.add(id)
  }
}

async function pollProyectos(sb) {
  if (disabled.has('proyectos')) return
  const { data, error } = await sb
    .from('ams_proyectos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    reportOnce('proyectos', error)
    if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
      disabled.add('proyectos')
    }
    return
  }
  const first = prev.proyectos.size === 0
  for (const row of data) {
    const id = row.id
    const numero = row.numero_proyecto || row.numero || row.codigo || row.id
    const estado = row.estado || row.status || null
    const consultaId =
      row.consulta_id || row.consulta_entrante_id || row.id_consulta || null

    const old = prev.proyectos.get(id)
    if (!old) {
      if (!first) {
        log(
          green('🏗️  PROYECTO CREADO'),
          bold(numero),
          gray('|'),
          `consulta_id=${consultaId ?? '—'}`,
          gray('|'),
          `estado=${yellow(estado ?? '—')}`,
        )
      }
    } else if (old.estado !== estado) {
      log(
        cyan('🔄 proyecto'),
        bold(numero),
        `${yellow(old.estado ?? '—')} → ${yellow(estado ?? '—')}`,
      )
    }
    prev.proyectos.set(id, { estado })
  }
}

async function pollEventos(sb) {
  if (disabled.has('eventos')) return
  const { data, error } = await sb
    .from('ams_app_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) {
    reportOnce('eventos', error)
    if (error.code === '42P01' || /does not exist/i.test(error.message || '')) {
      disabled.add('eventos')
    }
    return
  }
  const first = prev.eventos.size === 0
  for (const row of data) {
    const id = row.id ?? row.event_id ?? JSON.stringify(row).slice(0, 40)
    if (prev.eventos.has(id)) continue
    if (!first) {
      const tipo =
        pickFirst(row, ['tipo_evento', 'event_type', 'tipo', 'type', 'action'])?.value ??
        '?'
      const sev =
        pickFirst(row, ['severidad', 'severity', 'level'])?.value ?? null
      const msg =
        pickFirst(row, ['mensaje', 'message', 'descripcion', 'description', 'detalle'])
          ?.value ?? ''
      const entity =
        pickFirst(row, [
          'entity_id',
          'consulta_id',
          'proyecto_id',
          'target_id',
          'ref_id',
        ])?.value ?? null

      const bits = []
      if (sev) bits.push(`sev=${sev}`)
      if (entity) bits.push(`entity=${entity}`)
      if (msg) bits.push(short(msg, 100))

      log(
        cyan('📌 EVENT'),
        bold(String(tipo)),
        bits.length ? gray('|') + ' ' + bits.join(' ') : '',
      )
    }
    prev.eventos.add(id)
  }
}

// ─────────────────────── Filesystem watcher ───────────────────────

async function walk(dir) {
  const out = []
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch (err) {
    return out
  }
  for (const e of entries) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) {
      out.push({ path: full, isDir: true })
      const sub = await walk(full)
      out.push(...sub)
    } else if (e.isFile()) {
      out.push({ path: full, isDir: false })
    }
  }
  return out
}

async function pollFs() {
  const entries = await walk(FS_WATCH_DIR)
  const first = prev.fs.size === 0
  const seen = new Set()

  for (const { path: p, isDir } of entries) {
    seen.add(p)
    let stat
    try {
      stat = await fs.stat(p)
    } catch {
      continue
    }
    const mtime = stat.mtimeMs
    const old = prev.fs.get(p)
    const rel = path.relative(FS_WATCH_DIR, p) || path.basename(p)
    if (old == null) {
      if (!first) {
        log(
          green('📁 FS:'),
          `creado ${isDir ? gray('(dir) ') : ''}${bold(rel)}`,
        )
      }
    } else if (!isDir && old !== mtime) {
      log(yellow('📝 FS:'), `modificado ${bold(rel)}`)
    }
    prev.fs.set(p, mtime)
  }

  // Detectar borrados (opcional, silencioso)
  for (const p of prev.fs.keys()) {
    if (!seen.has(p)) prev.fs.delete(p)
  }
}

// ─────────────────────── Main loop ───────────────────────

async function main() {
  try {
    await loadEnv(ENV_PATH)
  } catch (err) {
    console.error(red(`No pude leer .env.local en ${ENV_PATH}: ${err.message}`))
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error(red('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local'))
    process.exit(1)
  }

  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const header = [
    '╔═══════════════════════════════════════════════════════╗',
    '║  DOA Flow Watcher — polling cada 2s                   ║',
    '║  Ctrl+C para detener                                  ║',
    '╚═══════════════════════════════════════════════════════╝',
  ].join('\n')
  console.log(useColor ? `\x1b[1;36m${header}\x1b[0m` : header)
  log(gray(`Supabase: ${url}`))
  log(gray(`FS dir: ${FS_WATCH_DIR}`))
  log(gray('Primer tick = baseline silencioso (solo imprime cambios a partir del 2º tick)…'))
  console.log()

  // Tick loop
  let stopping = false
  process.on('SIGINT', () => {
    stopping = true
    console.log()
    log(yellow('Deteniendo…'))
    process.exit(0)
  })

  while (!stopping) {
    const started = Date.now()
    await Promise.allSettled([
      pollConsultas(sb),
      pollRespuestas(sb),
      pollProyectos(sb),
      pollEventos(sb),
      pollFs(),
    ])
    const elapsed = Date.now() - started
    const wait = Math.max(0, POLL_MS - elapsed)
    await new Promise((r) => setTimeout(r, wait))
  }
}

main().catch((err) => {
  console.error(red('Fallo fatal:'), err)
  process.exit(1)
})
