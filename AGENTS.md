# Playwright API testing guide

This repository is for Playwright API tests using JavaScript and `@playwright/test`.

## Directory layout

- `tests/api/`: API test cases. Name test files `*.spec.js` and group them by resource or feature.
- `tests/fixtures/`: Reusable Playwright fixtures, such as authenticated request contexts.
- `tests/helpers/`: Request builders, authentication helpers, and response assertion utilities.
- `test-data/`: Static JSON payloads and expected response data. Use descriptive file names and keep data independent of secrets and environments.

## Test conventions

- Use Playwright's `request` fixture for HTTP calls and `expect` for assertions.
- Keep the test's request, expected status, and important response assertions visible in each case. Move only repeated setup or behavior into fixtures and helpers.
- Prefer isolated test data. Clean up resources created by a test, and avoid relying on execution order or state left by another test.
- Read hostnames, credentials, and tokens from environment variables. Never commit `.env`, real credentials, or personal data.
- Use `API_BASE_URL` for relative request URLs. Add any new required variables to `.env.example` with safe placeholders.
- Cover successful responses and relevant validation or authorization failures when adding tests for an endpoint.

## Commands

1. Run `npm install`.
2. Copy `.env.example` to `.env` and set the values needed by the API under test.
3. Run `npm test` to execute API tests, or `npx playwright test --list` to inspect discovered cases.
4. Run `npm run report` to open the HTML report.

`tests/api/example.spec.js` is a self-contained GET example backed by a local HTTP server. Use its request and assertion pattern with a real API endpoint once the path, authentication, and expected response are known.
