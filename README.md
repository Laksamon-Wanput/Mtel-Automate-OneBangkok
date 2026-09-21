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

Run the Retailbanner cases with `npx playwright test tests/api/Retailbanner.spec.js --project=api`. Set the `LOGIN_*` values and `RETAIL_BANNER_URL` in `.env` first. TC_001 signs in, TC_002 requests a BZB access key, and TC_003 checks the account's banners against `test-data/retailbanner-expected-banners.json`. The cases run in order. Selecting TC_002 or TC_003 alone also runs its prerequisite API requests.
