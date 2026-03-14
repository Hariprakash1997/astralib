# Astralib

Reusable utility packages for Node.js applications — email automation, account management, analytics, and UI components.

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@astralibx/core](./packages/core) | Shared errors, types, and validation for all packages | `0.1.0` |
| [@astralibx/email-rule-engine](./packages/email-rule-engine) | Rule-based email automation with MJML + Handlebars templates, throttling, and distributed locking | `2.0.0` |
| [@astralibx/email-account-manager](./packages/email-account-manager) | Email account lifecycle — SMTP pooling, warmup, health tracking, bounce detection, SES webhooks | `1.0.0` |
| [@astralibx/email-analytics](./packages/email-analytics) | Event recording, timezone-aware aggregation, and query API for email metrics | `1.0.0` |
| [@astralibx/email-ui](./packages/email-ui) | 22 Lit Web Components for managing accounts, rules, and analytics dashboards | `1.0.0` |

## Installation

```bash
npm install @astralibx/<package-name>
```

## Development

This is a monorepo powered by [Turborepo](https://turbo.build/) with [Changesets](https://github.com/changesets/changesets) for version management.

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Test all packages
npm run test

# Create a changeset (after making changes)
npm run changeset
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development and publishing workflows.

## License

MIT
