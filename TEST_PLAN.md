# Test Plan

## Scope and supported routes

The tests exercise the public Expand Testing Notes App at
`https://practice.expandtesting.com/notes/app` and its API at
`https://practice.expandtesting.com/notes/api`.

| Method and route | Purpose |
|---|---|
| `POST /users/register` | Register a unique test account (URL-encoded form). |
| `POST /users/login` | Authenticate and obtain the `x-auth-token` (URL-encoded form). |
| `GET /notes` | List the authenticated user's notes; also the list endpoint intercepted by the mock tests. |
| `POST /notes/` | Create a note with JSON; intercepted with HTTP 500 in the failed-create test. |
| `GET /notes/{id}` | Read a note and verify persisted state. |
| `PUT /notes/{id}` | Update a note with JSON. |
| `DELETE /notes/{id}` | Delete a note. |
| `DELETE /users/delete-account` | Remove each test account and its test data. |

These are API-relative paths; prepend
`https://practice.expandtesting.com/notes/api` to form the full API URL.
The UI tests navigate to the app's login page and exercise its note dashboard.

## Coverage

| Suite | Test coverage |
|---|---|
| `tests/ui/notes-crud.spec.ts` | Log in, create and edit a note, verify the edit after reload, delete it, and verify it remains absent after reload. |
| `tests/api/notes-crud.spec.ts` | Check unauthenticated access, note CRUD and persistence, and isolation between two users. |
| `tests/integration/notes-cross-layer.spec.ts` | Create with the API, verify and edit in the UI, then verify the saved state through the API. |
| `tests/mocks/notes-mocking.spec.ts` | Fulfill the notes-list `GET` with two synthetic notes; fulfill it with a `401`; fulfill note-create `POST` with a `500` and verify no note was persisted. |

## Mocking design

Mock tests use `page.route()` with a narrow match for the real notes endpoint and inspect the method before intercepting. `route.fulfill()` returns deterministic JSON responses: a valid two-note list, an invalid-session `401`, or a failed-create `500`. It is used because the tests need controlled status codes and response bodies; the selected requests must not be sent to the live service. Requests to other endpoints and methods continue normally.

Each mock test creates its own account and uses its own Playwright page. Route handlers are page-scoped and removed when that page is torn down. Mock tests live under `tests/mocks/`; live CRUD and integration tests do not install mock routes. The failed-create test additionally queries the live API to confirm the mocked mutation did not create a note.

## Assumptions and limitations

- The public app and API are reachable and retain the request/response behavior observed during implementation. They can change, become unavailable, or rate-limit tests.
- Each test registers a unique account and expects the documented registration, login, and account-deletion API operations to work.
- The list mock supplies synthetic note data only for the intercepted browser request; it does not create notes on the server.
- The `401` case records the app's observed behavior: the dashboard remains open with Logout visible and no note cards; it does not automatically redirect to login.
- Cleanup is attempted in `finally` blocks. A service outage or cleanup API failure can leave test data behind or cause a test failure.
- These tests cover Chromium and the specified UI/API workflows; they do not claim cross-browser coverage or validate the service's internal implementation.

## Reports and failure artifacts

Run `npm test` to generate `playwright-report/`. Run `npm run report` to view it. Playwright retains screenshots and traces on failure in `test-results/`; inspect a trace with:

```powershell
npx playwright show-trace "test-results\<test-folder>\trace.zip"
```

The GitHub Actions workflow uploads the HTML report and `test-results/` as a downloadable artifact.
