# One Bangkok API tests

Playwright API test scaffold with one runnable GET example. Add real endpoint tests after the API contract and environment are available.

```text
tests/
  api/       API test cases (*.spec.js)
  fixtures/  Shared Playwright fixtures
  helpers/   Reusable request and assertion helpers
test-data/    Static payloads and expected data
```

Run `npm test` to execute the example. It starts a local HTTP endpoint, fetches `/items/42`, and compares the JSON response with `test-data/example-item.json`.

For real API tests, copy `.env.example` to `.env`, set `API_BASE_URL`, and use relative request URLs such as `request.get('/items/42')`. See `AGENTS.md` for conventions.
