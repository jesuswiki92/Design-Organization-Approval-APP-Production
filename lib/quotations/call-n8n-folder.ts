/**
 * ============================================================================
 * Phase C — client-side helper for the "Crear Carpeta Drive Proyecto" webhook.
 * ============================================================================
 *
 * Swaps out the local `mkdir` that `/api/incoming-requests/[id]/open-project`
 * used to do. Posts to the n8n workflow `AMS - Crear Carpeta Drive Proyecto`
 * (id `cqxT0uIYH7VB4Gir`) which:
 *   1. Verifies our `x-doa-signature` HMAC (shared secret `DOA_N8N_WEBHOOK_SECRET`).
 *   2. Creates the main Drive folder under `DOA_DRIVE_ROOT_FOLDER_ID`.
 *   3. Creates the 6 EASA Part 21J subfolders (must stay in sync with
 *      `lib/project-builder.ts` → `PROJECT_FOLDER_STRUCTURE`).
 *   4. Updates `doa_projects.drive_folder_id` + `drive_folder_url`.
 *   5. Returns `{ ok, folderId, folderUrl }`.
 *
 * Env vars (both required in production):
 *   N8N_FOLDER_WEBHOOK_URL   — e.g. https://sswebhook.testn8n.com/webhook/doa-project-folder-create
 *   DOA_N8N_WEBHOOK_SECRET   — shared HMAC secret (same value on both stacks).
 *
 * HMAC contract matches `app/api/projects/[id]/transition/route.ts` —
 * `x-doa-signature` = hex(HMAC-SHA256(JSON.stringify(body), secret)).
 * ============================================================================
 */

import 'server-only'

import { createHmac } from 'node:crypto'

const N8N_TIMEOUT_MS = 15_000

export type CreateProjectFolderInput = {
  projectId: string
  projectNumber: string
  incomingRequestId: string | null
  clientName?: string | null
  subject?: string | null
}

export type CreateProjectFolderResult = {
  folderId: string
  folderUrl: string
  subfolderCount?: number
}

export class CreateProjectFolderError extends Error {
  readonly code:
    | 'webhook_url_missing'
    | 'webhook_secret_missing'
    | 'timeout'
    | 'upstream_error'
    | 'invalid_response'
    | 'network_error'
  readonly status?: number
  readonly upstreamBody?: string

  constructor(
    code: CreateProjectFolderError['code'],
    message: string,
    opts: { status?: number; upstreamBody?: string } = {},
  ) {
    super(message)
    this.name = 'CreateProjectFolderError'
    this.code = code
    this.status = opts.status
    this.upstreamBody = opts.upstreamBody
  }
}

/**
 * Fire the folder-creation webhook and wait for n8n's response.
 *
 * Throws `CreateProjectFolderError` on every non-happy path. Callers should
 * log the failure but are free to keep the project open — the row already
 * exists in Supabase without a folder reference and can be backfilled.
 */
export async function createProjectFolder(
  input: CreateProjectFolderInput,
): Promise<CreateProjectFolderResult> {
  const webhookUrl = process.env.N8N_FOLDER_WEBHOOK_URL
  if (!webhookUrl) {
    throw new CreateProjectFolderError(
      'webhook_url_missing',
      'N8N_FOLDER_WEBHOOK_URL is not configured.',
    )
  }

  const secret = process.env.DOA_N8N_WEBHOOK_SECRET
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new CreateProjectFolderError(
      'webhook_secret_missing',
      'DOA_N8N_WEBHOOK_SECRET is required in production for signed webhook calls.',
    )
  }

  // Folder name convention: the project_number (e.g. `208_001`). Keeping the
  // underscore form matches the on-disk legacy convention and the name is
  // something humans will type when searching in Drive.
  const folderName = input.projectNumber.trim()
  const payload = {
    project_id: input.projectId,
    folder_name: folderName,
    project_number: input.projectNumber,
    incoming_request_id: input.incomingRequestId,
    client_name: input.clientName ?? null,
    subject: input.subject ?? null,
    timestamp: new Date().toISOString(),
  }
  const bodyStr = JSON.stringify(payload)

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (secret) {
    headers['x-doa-signature'] = createHmac('sha256', secret)
      .update(bodyStr)
      .digest('hex')
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: bodyStr,
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timer)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new CreateProjectFolderError(
        'timeout',
        `Folder webhook timed out after ${N8N_TIMEOUT_MS}ms.`,
      )
    }
    throw new CreateProjectFolderError(
      'network_error',
      err instanceof Error ? err.message : 'Unknown network error',
    )
  }
  clearTimeout(timer)

  if (!res.ok) {
    const rawBody = await res.text().catch(() => '')
    throw new CreateProjectFolderError(
      'upstream_error',
      `Folder webhook returned HTTP ${res.status}.`,
      { status: res.status, upstreamBody: rawBody.slice(0, 500) },
    )
  }

  let parsed: unknown
  try {
    parsed = await res.json()
  } catch {
    throw new CreateProjectFolderError(
      'invalid_response',
      'Folder webhook response was not valid JSON.',
    )
  }

  // n8n Respond-to-Webhook may wrap the body inside an array; normalise.
  const payloadObj = Array.isArray(parsed) ? parsed[0] : parsed
  if (!payloadObj || typeof payloadObj !== 'object') {
    throw new CreateProjectFolderError(
      'invalid_response',
      'Folder webhook response missing expected object.',
    )
  }

  const p = payloadObj as Record<string, unknown>
  const folderId = typeof p.folderId === 'string' ? p.folderId : null
  const folderUrl = typeof p.folderUrl === 'string' ? p.folderUrl : null
  if (!folderId || !folderUrl) {
    throw new CreateProjectFolderError(
      'invalid_response',
      'Folder webhook response missing folderId/folderUrl.',
    )
  }

  return {
    folderId,
    folderUrl,
    subfolderCount: typeof p.subfolderCount === 'number' ? p.subfolderCount : undefined,
  }
}
