# Security policy

## Supported versions

Security fixes are provided for the latest release. Update to the latest release before reporting an issue when possible.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/danieljsaldana/goliat-cloud-inventory/security/advisories/new).
Do not disclose vulnerabilities in public issues or pull requests.

Include the affected version, prerequisites, reproduction steps, expected impact and a minimal proof of concept.
Use synthetic data and redact tokens, passwords, connection strings, tenant details and resource identifiers.
Do not test against environments you do not own or have permission to assess.

Reports are reviewed on a best-effort basis; this project does not offer a guaranteed response time or a bug bounty.
Please coordinate public disclosure with the maintainer.

## Deployment responsibilities

Keep dependencies and deployments updated. Configure TLS, least-privilege identities, backups and your organisation's access policies.
Never commit `.env`, local settings, credentials or real inventory exports.
See the [security model](https://github.com/danieljsaldana/goliat-cloud-inventory/wiki/Security).
