const BASE_URL = process.env.SMOKE_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'
const AUTH_COOKIE = process.env.SMOKE_AUTH_COOKIE || ''
const ENABLE_CHAT = process.env.SMOKE_ENABLE_CHAT === '1'

function log(message) {
  process.stdout.write(`${message}\n`)
}

function fail(message) {
  throw new Error(message)
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (AUTH_COOKIE) {
    headers.set('Cookie', AUTH_COOKIE)
  }

  return fetch(new URL(path, BASE_URL), {
    redirect: 'manual',
    ...options,
    headers,
  })
}

async function expectPage(path, config) {
  const response = await request(path)
  const text = await response.text()

  if (!config.statuses.includes(response.status)) {
    fail(`${path} returned ${response.status}, expected one of ${config.statuses.join(', ')}`)
  }

  if (config.locationIncludes) {
    const location = response.headers.get('location') || ''
    if (!location.includes(config.locationIncludes)) {
      fail(`${path} redirect location "${location}" does not include "${config.locationIncludes}"`)
    }
  }

  if (config.bodyIncludes && !text.includes(config.bodyIncludes)) {
    fail(`${path} body does not include "${config.bodyIncludes}"`)
  }

  log(`PASS ${path} -> ${response.status}`)
}

/**
 * Assert that a protected API route returns 401 (JSON) when called WITHOUT
 * a session cookie. Used to verify that requireUserApi() guards run BEFORE
 * any DB lookup or body validation. Used by Fase 3b to lock in API authz.
 */
async function expectUnauthorized(method, path, body) {
  const init = { method }
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' }
    init.body = JSON.stringify(body)
  }

  const response = await request(path, init)

  if (response.status !== 401) {
    fail(`${method} ${path} returned ${response.status}, expected 401`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('application/json')) {
    fail(`${method} ${path} content-type "${contentType}" is not JSON (expected JSON 401, got HTML?)`)
  }

  const payload = await response.json().catch(() => null)
  if (!payload || typeof payload.error !== 'string' || payload.error.length === 0) {
    fail(`${method} ${path} did not return a valid 401 error payload`)
  }

  log(`PASS ${method} ${path} -> 401`)
}

async function expectChat(path) {
  const response = await request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      question: 'Hello',
      history: [],
    }),
  })

  if (response.status !== 200) {
    fail(`${path} returned ${response.status}, expected 200`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (!contentType.includes('text/event-stream')) {
    fail(`${path} content-type "${contentType}" is not SSE`)
  }

  log(`PASS ${path} -> ${response.status}`)
}

async function main() {
  log(`Running smoke tests against ${BASE_URL}`)
  log(AUTH_COOKIE ? 'Authenticated mode: enabled' : 'Authenticated mode: disabled (redirect checks only)')

  if (AUTH_COOKIE) {
    await expectPage('/home', { statuses: [200], bodyIncludes: 'DOA Operations Hub' })
    await expectPage('/quotations', { statuses: [200], bodyIncludes: 'Quotation' })
    await expectPage('/engineering/portfolio', { statuses: [200], bodyIncludes: 'Portfolio' })
    await expectPage('/tools/experto', { statuses: [200], bodyIncludes: 'OpenRouter' })
  } else {
    await expectPage('/login', { statuses: [200], bodyIncludes: 'DOA Operations Hub' })
    await expectPage('/home', { statuses: [307], locationIncludes: '/login' })
    await expectPage('/quotations', { statuses: [307], locationIncludes: '/login' })
    await expectPage('/engineering/portfolio', { statuses: [307], locationIncludes: '/login' })
    await expectPage('/tools/experto', { statuses: [307], locationIncludes: '/login' })

    // Fase 3b: protected API routes must return JSON 401 when called without
    // a session cookie. The check must run BEFORE any DB lookup or body
    // validation, so a fake/empty body is enough to trigger the auth gate.
    await expectUnauthorized('POST', '/api/tools/chat', { question: 'Hello', history: [] })
    await expectUnauthorized('DELETE', '/api/consultas/test-id')
    await expectUnauthorized('PATCH', '/api/consultas/test-id/state', { estado: 'NUEVO' })
    await expectUnauthorized('POST', '/api/consultas/test-id/send-client', {})
    await expectUnauthorized('DELETE', '/api/consultas/test-id/referencias', { proyecto_id: 'x' })
    await expectUnauthorized('POST', '/api/consultas/test-id/documentos', { docs: {} })
    await expectUnauthorized('POST', '/api/consultas/test-id/quotation', {})
    await expectUnauthorized('PATCH', '/api/proyectos/test-id/state', { estado: 'NUEVO' })
    await expectUnauthorized('DELETE', '/api/proyectos/test-id', {})
    await expectUnauthorized('POST', '/api/proyectos/test-id/precedentes', {})
    await expectUnauthorized('GET', '/api/proyectos-historico/search?q=test')
    await expectUnauthorized('POST', '/api/workflow/transition', {})

    // Fase 3d: webhook proxy routes must also return JSON 401 without a session.
    // These proxies forward client requests to n8n server-side so the webhook
    // URLs never leak into the client bundle.
    await expectUnauthorized('POST', '/api/webhooks/quotation-state', {})
    await expectUnauthorized('POST', '/api/webhooks/project-state', {})
    await expectUnauthorized('POST', '/api/webhooks/conteo-horas', {})
  }

  if (ENABLE_CHAT) {
    if (!AUTH_COOKIE) {
      log('SKIP /api/tools/chat SSE check (requires SMOKE_AUTH_COOKIE since Fase 3b)')
    } else {
      await expectChat('/api/tools/chat')
    }
  } else {
    log('SKIP /api/tools/chat (set SMOKE_ENABLE_CHAT=1 to enable chat smoke)')
  }

  log('Smoke tests completed successfully.')
}

main().catch((error) => {
  process.stderr.write(`SMOKE TEST FAILED: ${error.message}\n`)
  process.exit(1)
})
