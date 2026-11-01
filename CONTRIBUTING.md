# Contributing

Bug reports, focused improvements and documentation fixes are welcome. Contributions to this distribution use the [repository licence](LICENSE). Read [licensing scope](LICENSING.md), including the noncommercial restriction and the status of earlier MIT distributions.
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
npm audit --include=dev --audit-level=moderate
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

Maintainers can run all suites from **Actions → Goliat - CI → Run workflow**, selecting `main`.
Use this entry point for a manual Pages publication too: deployment runs only after successful checks.
CodeQL also runs weekly without code changes, to check the existing code with updated analysis.

Every CI run includes a **Summary** table of applicable checks and their results.
Maintainers can use **Goliat - Release notes** on `main` to preview grouped release notes,
download them, or create a draft release for manual review. It never publishes automatically.
Classify pull requests with `bug`, `enhancement`, `documentation` or `dependencies` labels
so GitHub groups them correctly. See the [workflow guide](.github/WORKFLOWS.md).

Dependency updates are proposed by Dependabot and reviewed before merging; they are not automatically merged.

The root manifest temporarily overrides `minimatch` to `11.0.3` within ESLint's dependency tree,
including `@eslint/config-array`, to address [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).
ESLint's current dependency ranges still select the vulnerable major version. Remove the override
once the upstream dependency tree resolves patched versions without it, after checking clean
installation, linting, `tests/dependency-security.test.mjs` and the audit. CI audits development
and runtime dependencies, blocking moderate or higher advisories.
