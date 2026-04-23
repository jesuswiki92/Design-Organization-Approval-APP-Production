/**
 * ============================================================================
 * GET /api/build-info
 * ============================================================================
 *
 * PUBLIC endpoint (no session required) that reports which commit is baked
 * into the running image. Used by `deploy.sh` post-deploy verification and by
 * anyone who needs to confirm, from outside the container, which revision of
 * the app is live.
 *
 * It is intentionally public and read-only — it exposes only build metadata
 * (SHA, branch, build timestamp, image tag) that is already visible to anyone
 * inspecting the container. No secrets.
 *
 * All values come from build-time ARGs injected by the Dockerfile:
 *   - NEXT_PUBLIC_GIT_SHA   — full SHA of HEAD at build time
 *   - NEXT_PUBLIC_GIT_BRANCH — branch name (usually "main")
 *   - NEXT_PUBLIC_BUILD_TIME — ISO-8601 UTC timestamp
 *   - NEXT_PUBLIC_IMAGE_TAG  — the Docker tag applied to this image
 *
 * If a value is missing, the response returns "unknown" for that field rather
 * than failing, so the endpoint still works on local dev builds where the
 * Dockerfile ARGs were not provided.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const gitSha = process.env.NEXT_PUBLIC_GIT_SHA?.trim() || 'unknown'
  const gitShaShort = gitSha === 'unknown' ? 'unknown' : gitSha.slice(0, 7)
  const gitBranch = process.env.NEXT_PUBLIC_GIT_BRANCH?.trim() || 'unknown'
  const buildTime = process.env.NEXT_PUBLIC_BUILD_TIME?.trim() || 'unknown'
  const imageTag = process.env.NEXT_PUBLIC_IMAGE_TAG?.trim() || 'unknown'
  const nodeEnv = process.env.NODE_ENV || 'unknown'

  return Response.json(
    {
      gitSha,
      gitShaShort,
      gitBranch,
      buildTime,
      imageTag,
      nodeEnv,
      // Ephemeral runtime timestamp — useful to confirm the response is fresh.
      serverTime: new Date().toISOString(),
    },
    {
      headers: {
        // Never cache the build-info response — deploy verification depends
        // on it reflecting the *current* running image, not an intermediate
        // CDN cache.
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  )
}
