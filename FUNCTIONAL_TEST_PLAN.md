# DOA Operations Hub Functional Test Plan

## Purpose

This document defines the minimum functional baseline to verify that the app is healthy before adding more features.

The goal is not exhaustive QA. The goal is to confirm that the house foundations are solid:
- the app starts
- auth works
- protected routes behave correctly
- critical APIs respond
- visible workflows load
- the current release/version shown in `home` matches the shipped build

## Scope

These tests are designed for the current runtime app:
- auth/login
- home
- quotations
- engineering portfolio
- project detail
- tools/experto
- workflow transition API
- OpenRouter chat API

## Preconditions

Before running the tests:

1. Start the app in local dev or use the deployed environment.
2. Ensure environment variables are configured:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `OPENROUTER_API_KEY` for chat tests
   - `OPENROUTER_MODEL` optional, default is `anthropic/claude-sonnet-4`
3. Use a valid test user that can log in.
4. If workflow persistence is being verified, apply migration:
   - `supabase/migrations/202603281710_project_and_quotation_states.sql`
5. If testing protected routes, know both cases:
   - unauthenticated user
   - authenticated user

## Automated Baseline

A minimal automated smoke suite is now available:

```bash
npm run smoke
```

Supported environment variables:
- `SMOKE_BASE_URL` or `BASE_URL`: target app URL, default `http://localhost:3000`
- `SMOKE_AUTH_COOKIE`: optional cookie string to run authenticated route checks
- `SMOKE_ENABLE_CHAT=1`: enables the OpenRouter endpoint smoke test

What the automated smoke covers:
- `/login`
- protected route redirect behavior when unauthenticated
- authenticated route availability if `SMOKE_AUTH_COOKIE` is provided
- `POST /api/workflow/transition` contract for incomplete payloads
- `POST /api/tools/chat` contract when explicitly enabled

## Release Check

Current release baseline:
- Version: `2026.03.29-l5`
- Updated label: `29/03/2026`
- Release name: `Saneamiento Lote 5`

The value shown in `home` must remain stable after refresh. It is a release marker, not a live timestamp.

## Priority Levels

- `P0`: must pass before continuing product work
- `P1`: should pass before shipping or merging major changes
- `P2`: useful regression checks after larger refactors

## P0 Smoke Tests

### FT-001 App boot reaches login
- Priority: `P0`
- Preconditions: app running
- Steps:
  1. Open `/login`
- Expected:
  - page loads with `200`
  - login form is visible
  - no runtime error screen appears

### FT-002 Protected routes redirect when logged out
- Priority: `P0`
- Preconditions: logged out
- Steps:
  1. Open `/home`
  2. Open `/quotations`
  3. Open `/engineering/portfolio`
  4. Open `/tools/experto`
- Expected:
  - each route redirects to `/login` or is blocked by auth middleware as intended
  - no broken navigation or blank page

### FT-003 Invalid login shows a clear error
- Priority: `P0`
- Preconditions: app running
- Steps:
  1. Open `/login`
  2. Enter an invalid email/password
  3. Submit
- Expected:
  - login is rejected
  - user remains on login screen
  - an error message is shown

### FT-004 Valid login reaches home
- Priority: `P0`
- Preconditions: valid credentials available
- Steps:
  1. Open `/login`
  2. Sign in with valid credentials
- Expected:
  - redirect to `/home`
  - no auth/runtime error
  - top navigation and main dashboard shell render correctly

### FT-005 Home release marker is stable
- Priority: `P0`
- Preconditions: authenticated session
- Steps:
  1. Open `/home`
  2. Note version, release name and updated label
  3. Refresh the page
  4. Refresh again
- Expected:
  - version remains `2026.03.29-l5`
  - updated label remains `29/03/2026`
  - release name remains `Saneamiento Lote 5`
  - values do not change on refresh

### FT-006 Quotations list loads
- Priority: `P0`
- Preconditions: authenticated session
- Steps:
  1. Open `/quotations`
- Expected:
  - page returns `200`
  - list/table renders
  - search/filter controls render
  - state badges render without crashing

### FT-007 Engineering portfolio loads
- Priority: `P0`
- Preconditions: authenticated session
- Steps:
  1. Open `/engineering/portfolio`
- Expected:
  - page returns `200`
  - portfolio cards/list render
  - workflow state labels are visible
  - no mixed quotation states appear as canonical project states

### FT-008 Tools expert page loads
- Priority: `P0`
- Preconditions: authenticated session
- Steps:
  1. Open `/tools/experto`
- Expected:
  - page returns `200`
  - chat UI renders
  - no references to missing RAG/source panels remain

### FT-009 OpenRouter chat responds
- Priority: `P0`
- Preconditions:
  - authenticated session
  - `OPENROUTER_API_KEY` configured
- Steps:
  1. Open `/tools/experto`
  2. Send a simple message like `Hello`
- Expected:
  - request completes
  - chat receives an assistant response
  - no server error is shown

### FT-010 OpenRouter API route responds
- Priority: `P0`
- Preconditions:
  - app running
  - `OPENROUTER_API_KEY` configured
- Steps:
  1. Send `POST /api/tools/chat` with a small valid payload
- Expected:
  - route returns `200`
  - response stream begins successfully
  - no type/runtime crash in server logs

## P1 Workflow and Navigation Tests

### FT-011 Sidebar navigation integrity
- Priority: `P1`
- Preconditions: authenticated session
- Steps:
  1. Click each visible sidebar item
- Expected:
  - every link resolves to a real page
  - no dead links remain

### FT-012 Quotation state change
- Priority: `P1`
- Preconditions:
  - authenticated session
  - at least one editable quotation
  - workflow migration applied if persistence is under test
- Steps:
  1. Open `/quotations`
  2. Change a quotation state to a valid next state
- Expected:
  - UI accepts only valid transitions
  - waiting states require a reason when applicable
  - new state is reflected in the list after save

### FT-013 Project state change
- Priority: `P1`
- Preconditions:
  - authenticated session
  - at least one editable project
  - workflow migration applied if persistence is under test
- Steps:
  1. Open `/engineering/portfolio`
  2. Open a project or use the visible state action
  3. Change the project to a valid next state
- Expected:
  - only operational project states are offered
  - quotation states are not mixed into project workflow
  - invalid jumps are rejected

### FT-014 Project detail page loads
- Priority: `P1`
- Preconditions: authenticated session and existing project ID
- Steps:
  1. Open `/engineering/projects/[id]`
- Expected:
  - page loads
  - project header renders
  - workflow state is visible in the header if applicable
  - no crash caused by legacy state mapping

### FT-015 Workflow transition API enforces rules
- Priority: `P1`
- Preconditions:
  - authenticated session
  - valid quotation/project ID
- Steps:
  1. Call `POST /api/workflow/transition` with a valid transition
  2. Call again with an invalid transition
- Expected:
  - valid transition succeeds
  - invalid transition is rejected
  - error message is explicit enough for debugging

## P2 Regression and Stability Tests

### FT-016 Login to home to tools round-trip
- Priority: `P2`
- Steps:
  1. Log in
  2. Visit `/home`
  3. Visit `/tools`
  4. Visit `/tools/experto`
  5. Return to `/home`
- Expected:
  - no hydration or navigation crashes
  - shell layout remains consistent

### FT-017 Login to quotations to project flow
- Priority: `P2`
- Steps:
  1. Log in
  2. Open `/quotations`
  3. Open `/engineering/portfolio`
  4. Open a project detail
- Expected:
  - all pages load in sequence
  - no stale state or obvious UI corruption

### FT-018 Build baseline
- Priority: `P2`
- Steps:
  1. Run `npm.cmd run lint`
  2. Run `npm.cmd run build`
- Expected:
  - lint passes
  - build passes
  - build must not depend on `ignoreBuildErrors`

## Execution Cadence

Run all `P0` tests:
- before merging a structural refactor
- after auth changes
- after changing chat/OpenRouter integration
- after changing workflow logic
- after changing `proxy.ts`, route protection, or release/version handling

Run `P1` tests:
- before deployment
- after workflow or route changes

Run `P2` tests:
- after sanitation batches
- after larger UI refactors

## Known Current Dependencies

- Workflow persistence checks depend on migration `202603281710_project_and_quotation_states.sql`.
- Auth-dependent API tests require a real session and working RLS.
- OpenRouter checks depend on a valid `OPENROUTER_API_KEY`.

## Exit Criteria For “Good Foundations”

The app can be considered on a stable baseline when:
- all `P0` tests pass
- `lint` and `build` pass
- auth redirects behave correctly
- `quotations`, `portfolio` and `tools/experto` load without errors
- chat responds through OpenRouter
- workflow transitions can be validated under a real session
