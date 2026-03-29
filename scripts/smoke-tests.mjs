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

async function expectJsonError(path, body, expectedStatus) {
  const response = await request(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json().catch(() => null)

  if (response.status !== expectedStatus) {
    fail(`${path} returned ${response.status}, expected ${expectedStatus}`)
  }

  if (!payload || typeof payload.error !== 'string' || payload.error.length === 0) {
    fail(`${path} did not return a valid error payload`)
  }

  log(`PASS ${path} -> ${response.status}`)
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
  }

  await expectJsonError('/api/workflow/transition', {}, 400)

  if (ENABLE_CHAT) {
    await expectChat('/api/tools/chat')
  } else {
    log('SKIP /api/tools/chat (set SMOKE_ENABLE_CHAT=1 to enable chat smoke)')
  }

  log('Smoke tests completed successfully.')
}

main().catch((error) => {
  process.stderr.write(`SMOKE TEST FAILED: ${error.message}\n`)
  process.exit(1)
})
