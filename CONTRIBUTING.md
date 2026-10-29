# Contributing

Bug reports, focused improvements and documentation fixes are welcome.
For vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Local setup

Use Node.js 24 for the dashboard and Node.js 22 for the Azure Functions collector.
Follow the [quick start](README.md#quick-start) to configure a local PostgreSQL database and demo authentication.
Do not use production credentials or real inventory data in tests, screenshots or issues.

## Development conventions

- Use JavaScript/JSX and JSDoc, following the existing feature and layer boundaries.
- Keep changes focused and add regression tests for changed behaviour.
- Provide both English and Spanish translations for user-facing text.
- Update related documentation and keep the collector and dashboard inventory contracts in sync.
- Do not commit generated site assets, local configuration or credentials.

## Validation

```bash
npm ci
npm --prefix functions ci
npm run lint
npm run format:check
npm test
npm run test:functions
npm run build
```

For browser changes, install Chromium with `npx playwright install chromium`.
Run `npm run test:site` for the static product site.
Dashboard browser tests (`npm run test:e2e`) and database integration tests need an isolated PostgreSQL database:

```bash
export RUN_DB_TESTS=1
export DB_HOST=127.0.0.1
export DB_PORT=5432
export DB_NAME=inventory_test
export DB_USER=inventory
export DB_PASSWORD='<local test password>'
export DB_SSL=false
npm test
npm run test:e2e
```

The database name must end in `_test`. Never point these commands at a production database.
CI creates its own PostgreSQL service and uses synthetic data; no Azure credentials are needed.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Describe the problem, your changes and how you tested them.
3. Link related issues and include sanitised screenshots for UI changes.
4. Wait for the required checks and address review feedback.

CI selects checks based on the complete pull request diff. Documentation-only changes check
formatting without starting PostgreSQL or browser tests. Changes to shared code also validate
affected consumers. The required **CI** check aggregates applicable jobs; skipped suites are normal
when their inputs have not changed. See the [workflow guide](.github/WORKFLOWS.md).

External workflow runs require maintainer approval. Pull requests never receive deployment
credentials and never deploy the website or Azure resources. Please do not request secrets to run tests.

Dependency updates are proposed by Dependabot and reviewed before merging; they are not automatically merged.
