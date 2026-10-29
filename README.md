# Goliat - Cloud Inventory

[![Tests](https://github.com/danieljsaldana/goliat-cloud-inventory/actions/workflows/dashboard-check.yml/badge.svg)](https://github.com/danieljsaldana/goliat-cloud-inventory/actions/workflows/dashboard-check.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js >= 22.12](https://img.shields.io/badge/node-%3E%3D22.12-339933?logo=node.js&logoColor=white)](package.json)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)](https://nextjs.org/)

**Website:** <https://danieljsaldana.github.io/goliat-cloud-inventory/> · **Español:** [README.es.md](README.es.md)

Goliat is a self-hosted **Microsoft Azure inventory and FinOps dashboard**. An Azure Function collects the resources of one or more subscriptions through Azure Resource Graph and ARM, publishes a single JSON snapshot to Blob Storage, and a Next.js backend imports it into PostgreSQL. The web UI (Spanish and English) offers **73 views across 12 service groups**, interactive charts, global search, tag management, real cost analysis from Azure Cost Management, and an administration panel for the collector.

![Goliat - Cloud Inventory](public/social/cloud-inventory.png)

## Features

- **Inventory**: [73 views in 12 service groups](docs/azure-services.md) (compute, containers, web, networking, storage, databases, security, integration, monitoring, tags…). Each category has an **Overview** with KPIs, interactive charts and unique resources; every detail table supports subscription filter, search, column filters, grouping, sorting, pagination and export.
- **Global search** (`Ctrl+K` / `⌘K`): resources by name, ID, tag or subscription, plus subscriptions and views, over the whole loaded inventory without extra cloud calls.
- **FinOps** ([docs/finops.md](docs/finops.md)): actual or amortized costs from Azure Cost Management with month, subscription and currency filters, daily evolution, breakdown by service and per-resource detail. Missing data, insufficient permissions and partial results are shown explicitly, never as "zero cost". Currencies are never mixed.
- **Administration** ([docs/administration.md](docs/administration.md)): Function status and metrics, PostgreSQL and Blob Storage health, comparison between the published and the imported inventory, timer schedule and the tag keys displayed as columns.
- **Members** ([docs/members.md](docs/members.md)): optional role management backed by Entra ID and PostgreSQL.
- **Architecture view**: interactive diagrams of the application flow and of the Azure deployment, rendered from JSON ([docs/architecture.json](docs/architecture.json), [docs/azure-deployment.json](docs/azure-deployment.json)).
- **Authentication**: Microsoft Entra ID (single tenant, PKCE, Auth.js) or a demo user/password mode. Pages and data APIs are protected server-side.
- **Atomic snapshots**: each import is one PostgreSQL transaction; a failure keeps the previous snapshot. The same blob ETag is never imported twice.
- **i18n**: Spanish and English catalogs for the whole UI; Azure identifiers and values are kept verbatim.

## Architecture

```text
Azure Function (timer / queue / authenticated HTTP)
        │  Resource Graph + ARM, managed identity
        ▼
Blob Storage  ──  azure/latest.json (schemaVersion 2, ETag)
        │  read-only identity
        ▼
Next.js backend  ──  normaliser → PostgreSQL snapshot (one transaction)
        │
        ▼
Dashboard (React, shadcn/ui, Recharts)  ──  Entra ID or demo login
        │
        └──  FinOps → Azure Cost Management (server-side identity, Cost Management Reader)
```

The **Refresh** button asks the Function for a new generation with an Entra token, waits for publication, imports the blob and reloads the dashboard. A shared PostgreSQL advisory lock allows one manual refresh at a time across all users and replicas. Details in [docs/backend.md](docs/backend.md) and [docs/azure-function.md](docs/azure-function.md).

### Repository layout

| Path                    | Content                                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/`                  | Next.js App Router: pages, metadata, login, protected docs, read and refresh APIs. The browser never receives cloud or database credentials.   |
| `src/`                  | Dashboard components, hooks, services and i18n catalogs, organised by feature. `src/core/` holds models shared with the collectors (no React). |
| `server/`               | PostgreSQL pool, schema and migrations, authentication, access control, logging, FinOps, administration, refresh lock and CLI commands.        |
| `server/modules/azure/` | Blob Storage reader, normalisers, queries, repositories and seed data of the Azure inventory.                                                  |
| `functions/`            | Independent Node.js Azure Functions producer: timer, queue worker, authenticated API and deployment script ([README](functions/README.md)).    |
| `iac/`                  | Bicep + PowerShell: resource group, Function App (Flex Consumption), Storage, App Service, PostgreSQL Flexible Server, Entra registrations.    |
| `docs/`                 | Backend contract, Function guide, service catalogue, FinOps, administration, members, branding and the architecture diagrams.                  |
| `scripts/`              | Diagram rendering, brand assets, inventory contract sync and example generation.                                                               |
| `tests/`                | Unit, integration (PostgreSQL) and Playwright browser tests.                                                                                   |

## Quick start

Requirements: **Node.js 24** (minimum 22.12) and an empty **PostgreSQL** database whose user can create tables.

```bash
npm ci
cp .env.example .env
# Edit DB_HOST, DB_NAME, DB_USER, DB_PASSWORD and DB_SSL. For demo login set
# DASHBOARD_AUTH_MODE=demo, DASHBOARD_USERNAME, DASHBOARD_PASSWORD and a 32+ byte AUTH_SECRET.
npm run db:init   # creates the schema from server/schema/initial.sql (idempotent)
npm run db:seed   # optional: 73 views, 5 subscriptions and 214 fake resources, no cloud credentials
npm run dev
```

Open <http://127.0.0.1:4000>. `PORT` in `.env` drives both `dev` and `start`; `server/start-next.mjs` loads the file before Next.js starts. When changing the port also update `AUTH_URL` and `SITE_URL`.

Install dependencies on the operating system where Next.js will run (Tailwind native binaries differ between Windows and Linux); Docker uses its own `node_modules`. `.env` is never committed nor copied into images. Do not use `NEXT_PUBLIC_` prefixes for credentials.

### Scripts

| Command                                         | Purpose                                                                       |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| `npm run dev` / `start`                         | Development / production server (loads `.env` first).                         |
| `npm run build`                                 | Production build (standalone output).                                         |
| `npm run db:init`                               | Create the schema in an empty database; safe to repeat.                       |
| `npm run db:seed`                               | Load the demo inventory (refuses `NODE_ENV=production`).                      |
| `npm run db:migrate` / `db:status` / `db:check` | Apply, list and verify migrations.                                            |
| `npm run collect:azure`                         | Import `azure/latest.json` from Blob Storage into PostgreSQL.                 |
| `npm test`                                      | Unit tests; PostgreSQL integration tests when `RUN_DB_TESTS=1`.               |
| `npm run test:functions`                        | Tests of the Azure Functions producer.                                        |
| `npm run test:e2e`                              | Playwright browser tests (builds and starts Next.js on port 4100).            |
| `npm run lint` / `format` / `format:check`      | ESLint (hooks, layer boundaries, no `let`, no nested ternaries) and Prettier. |
| `npm run docs:diagram`                          | Regenerate `docs/architecture.html` and `docs/azure-deployment.html`.         |
| `npm run assets:brand`                          | Regenerate logo, favicon, Apple icon and social cover.                        |

## Configuration

All variables are documented in [.env.example](.env.example). The main groups:

| Group          | Variables                                                                                                                                                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web            | `PORT`, `SITE_URL`, `INVENTORY_REFRESH_TIMEOUT_MS` (max 900000), `INVENTORY_TAG_KEYS`                                                                                                                                                    |
| Logs           | `LOG_ENABLED`, `LOG_LEVEL` (`info` \| `warn` \| `error`), `LOG_HTTP_ENABLED`                                                                                                                                                             |
| Authentication | `DASHBOARD_AUTH_ENABLED`, `DASHBOARD_AUTH_MODE` (`demo` \| `azure-ad`), `AUTH_SECRET`, `AUTH_URL`, `DASHBOARD_USERNAME`, `DASHBOARD_PASSWORD`, `AUTH_MICROSOFT_ENTRA_ID_*`, `DASHBOARD_ADMIN_OBJECT_IDS`, `DASHBOARD_MEMBERS_ENABLED`    |
| PostgreSQL     | `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_POOL_SIZE`, `DB_QUERY_TIMEOUT_MS`, `DB_SSL`, `DB_SSL_CA_PATH`, `DB_MIGRATION_*`                                                                                           |
| Azure Storage  | `AZURE_AUTH_MODE` (`default` \| `client-secret` \| `managed-identity`), `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_STORAGE_ACCOUNT_URL`, `AZURE_STORAGE_CONTAINER`, `AZURE_STORAGE_BLOB`, `AZURE_MAX_OBJECT_MB` |
| Function       | `AZURE_FUNCTION_BASE_URL`, `AZURE_FUNCTION_SCOPE`, `AZURE_FUNCTION_RESOURCE_ID`, `AZURE_POSTGRES_RESOURCE_ID`, `AZURE_STORAGE_RESOURCE_ID`                                                                                               |
| FinOps         | `FINOPS_AUTH_MODE`, `FINOPS_SUBSCRIPTION_IDS` (max 20; empty reuses the inventory catalogue)                                                                                                                                             |

### Authentication

`DASHBOARD_AUTH_ENABLED=true` (default) requires a session on pages and data APIs. An incomplete or invalid configuration blocks access; it never falls back to public mode.

- `DASHBOARD_AUTH_MODE=demo` uses `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` with a login screen that also works without JavaScript.
- `DASHBOARD_AUTH_MODE=azure-ad` uses Microsoft Entra ID through Auth.js (NextAuth 5). Register a **web** application with the callback `<AUTH_URL>/api/auth/callback/microsoft-entra-id`, set `AUTH_MICROSOFT_ENTRA_ID_ID`, `AUTH_MICROSOFT_ENTRA_ID_SECRET` and `AUTH_MICROSOFT_ENTRA_ID_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0`. Only that tenant is accepted. The user photo is fetched once at sign-in from Microsoft Graph with the delegated `User.Read` permission and kept as a 48×48 thumbnail in the session.

Sessions are JWT cookies (`HttpOnly`, `SameSite=Lax`, 8 hours). `AUTH_SECRET` needs at least 32 random bytes; `AUTH_URL` fixes the canonical origin. Changing the mode invalidates existing sessions. Dashboard credentials are independent from the ones used by the collector.

### PostgreSQL and TLS

For a local server without TLS use `DB_SSL=false`. With `DB_SSL=true` the certificate and host name are verified against the system CAs; provide `DB_SSL_CA_PATH` (PEM) if the server uses a private CA and mount it into the container. The web process needs DML; the migrator needs DDL and may use a separate user (`DB_MIGRATION_*`). Run migrations as a pre-deployment job, never automatically on every replica start.

### Logging

Backend messages are JSON on `stderr` through [Pino](https://github.com/pinojs/pino). Each API summary includes route, status, duration and `requestId` (also returned as `X-Request-ID`); requests above one second log a warning. Bodies, cookies, tokens, query strings and SQL are never logged; external errors keep type and code without message or stack. CLI commands print their JSON result on `stdout`.

## Ingesting Azure

```bash
npm run collect:azure
```

Configure `AZURE_STORAGE_ACCOUNT_URL`, `AZURE_STORAGE_CONTAINER` and `AZURE_STORAGE_BLOB` (default `azure/latest.json`). The identity only needs blob read access. The backend downloads the JSON with its ETag, validates the contract version (`schemaVersion: 2`, 69 source reports plus four views computed by the backend), normalises the 73 views and publishes them in one transaction. The displayed date comes from the document, not from the download.

The [Functions producer](functions/README.md) publishes the full inventory with its own managed identity: daily timer, queue worker and an Entra-authenticated `POST` to generate or publish a document. It implements the [backend JSON contract](docs/backend.md#documento-azure-en-blob-storage); the dashboard takes subscriptions and tag keys from the file. The [Function development guide](docs/azure-function.md) covers the format and the Refresh integration.

## Deploying to Azure

Everything lives in one resource group (`rg-goliat-dev` by default) and is operated from the repository root with PowerShell 5.1+ and Azure CLI:

```powershell
.\goliat.ps1 help      # no configuration or login required
.\goliat.ps1 init      # creates iac/.env and the private project file (git-ignored)
.\goliat.ps1 validate  # bicep build + what-if
.\goliat.ps1 deploy    # Storage, Function (Flex Consumption), App Service F1, PostgreSQL B1ms, Entra registrations
.\goliat.ps1 stop | start | destroy-plan | destroy
```

`deploy-project.ps1` builds the web on Linux, initialises the database and publishes both projects; `-AuthMode demo|tenant` selects the login (tenant also creates the Entra app and its callback). FinOps assigns **Cost Management Reader** to the web identity on the inventory subscriptions; administration uses two custom roles with minimal permissions. See [iac/COMMANDS.md](iac/COMMANDS.md), [iac/PROJECT.md](iac/PROJECT.md) and [iac/README.md](iac/README.md). Secrets are written only to `iac/.env` and `iac/.azure/*.local.json`, both ignored by Git.

**`destroy` deletes the whole resource group and its data without an extra prompt**; use `-Confirm` for an interactive confirmation.

## Docker

The Dockerfile has three targets: `runner` (default, web), `collector` (ingestion) and `migrator` (pre-deployment job). Images use standalone output, Node.js 24 and an unprivileged user; they build without credentials or database access.

```bash
docker build -t cloud-inventory-web .
docker build --target collector -t cloud-inventory-collector .
docker build --target migrator  -t cloud-inventory-migrator .

docker run --rm --env-file .env -v "$PWD/certs:/app/certs:ro" cloud-inventory-migrator
docker run --rm --env-file .env -v "$PWD/certs:/app/certs:ro" cloud-inventory-collector azure
docker run -d --name cloud-inventory -p 4000:4000 --env-file .env -v "$PWD/certs:/app/certs:ro" cloud-inventory-web
```

`/api/health/` checks liveness and `/api/ready/` checks database and schema. [compose.example.yaml](compose.example.yaml) shows the migrate-before-serve dependency. Use `host.docker.internal` to reach a PostgreSQL on the host.

## Testing

```bash
npm test               # unit tests (PostgreSQL ones skipped unless RUN_DB_TESTS=1)
npm run test:functions
npm run lint && npm run format:check && npm run build
```

Database tests need `RUN_DB_TESTS=1` and a temporary database whose name ends in `_test`; they verify repeatable migrations, publication of the 73 views, repeatable seed, rollback and deduplication. Browser tests (`npx playwright install chromium && npm run test:e2e`) build and start the production server on port 4100 with their own demo session, a random schema and fake data; they cover navigation, ES/EN switch, filters, charts, refresh lock for two users, FinOps, administration and the architecture view on desktop (Spanish) and mobile (English).

The test workflow ([.github/workflows/dashboard-check.yml](.github/workflows/dashboard-check.yml)) runs the Functions tests on Node 22 and the unit, PostgreSQL 17 and browser tests on Node 24 for every push and pull request. It needs no secrets. The separate Pages workflow publishes only the static product website. See [.github/WORKFLOWS.md](.github/WORKFLOWS.md).

Tests mock the cloud SDKs and do not perform a real Entra ID login. Before going to production validate tenant, permissions, PostgreSQL TLS and the Azure identity of the environment, and define a retention policy for snapshots and blobs.

## Development notes

- JavaScript/JSX only; shared contracts are documented with JSDoc in `types.js` files.
- One component per folder (`index.jsx`); hooks own state, cancellation and reload; `api/` services perform requests; `src/core/` has no React and no HTTP.
- UI: **shadcn/ui (New York, Radix UI)** adapted under `src/components/ui/primitives/`, Tailwind CSS 4, Recharts 3 through `ChartContainer`. Add controls with `npx shadcn@latest add <component>` and adapt them to the folder layout and i18n.
- `npm run lint` enforces hook rules, layer boundaries and rejects `let`, nested ternaries and promise chains.
- Diagrams are rendered with [Archify](https://github.com/tt-a1i/archify) 3.0.1, vendored with its licences in `vendor/archify/`. The deployment diagram is a reference snapshot of the default `goliat-dev` environment, not a live discovery.

## Security

- Cloud and database credentials stay on the server; the browser only talks to the backend APIs.
- Data APIs return `private, no-store`; responses include `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN` and a restrictive referrer policy. The architecture iframe is sandboxed.
- FinOps validates origin, URL credentials, subscription path and pagination cycles before sending a token to ARM; it enforces per-process limits (two concurrent queries, 50 000 rows, 8 MiB per result, 16 MiB cache) and answers `429` with `Retry-After` on excess.
- Known advisory: `@azure/identity` 4.14 pins `@azure/msal-node` 6.x, which carries [GHSA-xcx6-jx8p-x3h5](https://github.com/advisories/GHSA-xcx6-jx8p-x3h5) (authorization-code flow). Goliat uses client-secret and managed-identity credentials only, so the affected flow is never exercised; the dependency will be bumped as soon as upstream releases a compatible version.

Please report vulnerabilities privately through GitHub security advisories instead of public issues.

## Branding

### Product website

The static GitHub Pages landing page lives in `site/index.html`. It shares the dashboard's
colours, locally hosted DM Sans fonts and visual patterns. The Inventory and FinOps previews
use fictional data only; they do not connect to Azure. The working menu uses the repository seed's
214 resources and five subscriptions, with subscription filters, name/ID/tag search, pagination and
resource details. Mobile users choose views with a selector. Categories use the product's own rules.
Numbered pagination reuses the product's `pageItems` helper, with first/last pages, ellipses and
compact mobile controls. Menu hover is distinct from selection; keyboard focus stays inside
each button without overlapping adjacent rows.
FinOps amounts are a deterministic three-month simulation, not billing data.
The **Users** and **Admin** tabs show six synthetic accounts and simulated service status.
Users can be filtered and role changes confirmed, except for protected or disabled accounts;
Administration lets visitors save or discard a sample schedule. Changes live in memory only,
and Admin reuses the product's labels, metric periods and synchronization rules. Charts have hourly
samples and pointer/keyboard inspection; inventory versions, cron and tag settings are interactive.
PostgreSQL and Blob Storage have separate metric cards and expandable details. Example scenarios cover
unavailable services, pending imports and editing locks during collection. Saved tags update the demo's
Tags view; querying the example never calls Azure. All changes
reset on reload and never call Graph or Azure.
The demo cannot modify resources or trigger collection. Without JavaScript it keeps the illustrative preview.
The page supports English and Spanish,
keyboard navigation and mobile layouts. Run `npm run test:site` after installing Playwright
Chromium (`npx playwright install chromium`); no PostgreSQL or cloud credentials are needed.
Screenshots are saved to `test-results/site/`. The font license is included in `site/assets/DM-Sans-LICENSE.txt`.

The Archify selector switches between application architecture and the reference Azure deployment,
updating the title, help text and full-document link. Changing the language preserves the selected
diagram and its zoom.

Run `npm run build:site` before previewing or publishing: it copies the two public Archify
documents, generates `demo-data.json` from the fixed seed and copies the shared aggregation and
pagination helpers into `site/assets/`. It does not read `.env` or query Azure or PostgreSQL.
Generated files are ignored by Git. After editing
the diagram JSON, run `npm run docs:diagram` first. GitHub Pages performs the copy automatically.
Enable **Settings → Pages → Source: GitHub Actions** to deploy this static site; the Next.js application
still requires a Node.js server and PostgreSQL.

Created by [Daniel J. Saldaña](https://danieljsaldana.dev).

The logo combines a cloud and an isometric inventory block in Azure blue. `npm run assets:brand` regenerates logo, favicon, Apple icon and the social cover; see [docs/social-image.md](docs/social-image.md).

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, tests and pull requests.
Report vulnerabilities privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Daniel J. Saldaña. Third-party notices for the vendored diagram renderer are in [vendor/archify/THIRD_PARTY_NOTICES.md](vendor/archify/THIRD_PARTY_NOTICES.md).
