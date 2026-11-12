# Notes App Playwright Assessment

Playwright Test automation for the public [Expand Testing Notes App](https://practice.expandtesting.com/notes/app) and its [Notes API](https://practice.expandtesting.com/notes/api/api-docs/). The tests create uniquely named accounts and remove them through the API. No credentials are required or stored in the repository.

See [TEST_PLAN.md](TEST_PLAN.md) for supported routes, assumptions, limitations, and suite coverage.

## Requirements and setup

- Node.js 20 or newer
- npm

```powershell
npm ci
npx playwright install chromium
```

No credentials or environment variables are required. Tests generate unique accounts through the public API; target URLs are declared in `tests/helpers/notes-api.ts`. UI coverage signs in through the UI after API registration. API and integration tests also create unique users. Tests delete their accounts through `DELETE /users/delete-account` in `finally` cleanup.

## Commands

```powershell
npm test                 # all UI, API, integration, and mock specs
npm run test:ui           # UI CRUD
npm run test:api          # API CRUD, auth, and ownership
npm run test:integration  # API-to-UI-to-API verification
npm run test:mocks        # deterministic success and failure routes
npm run report            # open the generated HTML report
```

The Playwright configuration runs headlessly in Chromium, retains traces and screenshots on failure, and writes the HTML report to `playwright-report/`. On CI, tests retry twice and use one worker.

## Test plan and coverage

| Suite | Coverage |
|---|---|
| `tests/ui/notes-crud.spec.ts` | API-register a unique user, log in via UI, create/edit a note, reload to verify the update, delete it, and reload to verify absence. |
| `tests/api/notes-crud.spec.ts` | Register/login two users; unauthenticated request; create/list/get/update/delete; verify user B cannot list, read, or update user A's note. |
| `tests/integration/notes-cross-layer.spec.ts` | Create with API, verify in logged-in UI, edit with UI, and poll/read the resulting API state. |
| `tests/mocks/notes-mocking.spec.ts` | Fulfill the live list endpoint with two synthetic notes; return 401 for a protected live endpoint; return 500 for a real note-creation request and verify it was not written. |

Major workflow stages use `test.step`. Tests use independent unique users and data, and mock tests use isolated Playwright pages; no mock routes are installed in the live CRUD or integration tests.

## Observed request shapes

Observed against the live public app during implementation (2026-11-11):

- Login: `POST /notes/api/users/login`, URL-encoded `{ "email": "...", "password": "..." }`.
- Note list: `GET /notes/api/notes`.
- Note create from UI: `POST /notes/api/notes/` with JSON `{ "title": "...", "description": "...", "category": "Home", "completed": false }`.
- Authenticated requests use the `x-auth-token` header returned as `data.token` by login.
- Note cards expose `data-testid="note-card"`, `note-card-title`, `note-card-description`, `note-edit`, and `note-delete`.
- Success responses use an envelope with `success`, `status`, `message`, and `data`. Note objects include `id`, `title`, `description`, `completed`, `created_at`, `updated_at`, `category`, and `user_id`.

The docs describe request fields as form data for some operations, but the live UI create request was observed as JSON. API helpers use URL-encoded forms for registration/login and JSON for note mutations. The test mocks use the live list/mutation URLs and envelope shape; their note data is synthetic and does not represent server state.

## Mocking design, routes, and limitations

- `page.route()` matches only the real notes endpoint (`https://practice.expandtesting.com/notes/api/notes`, optional trailing slash); handlers check the HTTP method so other requests continue normally.
- `route.fulfill()` is used for the list, 401, and 500 cases to return controlled status codes and realistic JSON envelopes. This makes the UI outcomes deterministic and prevents the intercepted list/mutation request from reaching the server. The successful list mock proves interception with a counter and checks the rendered synthetic titles and descriptions.
- The expired-session spec fulfills the real authenticated list request with HTTP 401 and the API's JSON error-envelope shape. Observed UI behavior: the dashboard shell remains visible (including Logout) and no note cards render; the app does not redirect to login on this response.
- The failed-create spec intercepts the real note `POST`, returns a JSON 500, verifies that no success card appears and that the editor stays available for retry, then checks the live API contains no note with that title.
- No routes are registered for assets or unrelated endpoints. Each spec uses its own Playwright page; page teardown removes its routes, keeping mocks out of live CRUD and integration tests.

These are live-target UI tests with controlled responses, not a local app or unrelated endpoint. The public service may change, rate-limit requests, or be unavailable; failures caused by that service are not evidence of local application regressions. API/UI test data cleanup is attempted through the documented account-deletion endpoint.

## Reports and debugging

Run the tests to generate the HTML report and failure artifacts:

```powershell
npm test
npm run report
```

The HTML report is written to `playwright-report/`. On failure, Playwright retains a screenshot and trace under `test-results/`; open a trace with:

```powershell
npx playwright show-trace "test-results\<test-folder>\trace.zip"
```

The GitHub Actions workflow uploads both `playwright-report/` and `test-results/` as the `playwright-report` artifact, retained for 30 days.
