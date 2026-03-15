# Astralib

Reusable utility packages for Node.js applications — email automation, account management, analytics, and UI components.

## Packages

| Package | Description |
|---------|-------------|
| [@astralibx/core](https://github.com/Hariprakash1997/astralib/tree/main/packages/core) | Shared errors, types, and validation for all packages |
| [@astralibx/email-rule-engine](https://github.com/Hariprakash1997/astralib/tree/main/packages/email-rule-engine) | Rule-based email automation with MJML + Handlebars templates, throttling, and distributed locking |
| [@astralibx/email-account-manager](https://github.com/Hariprakash1997/astralib/tree/main/packages/email-account-manager) | Email account lifecycle — SMTP pooling, warmup, health tracking, bounce detection, SES webhooks |
| [@astralibx/email-analytics](https://github.com/Hariprakash1997/astralib/tree/main/packages/email-analytics) | Event recording, timezone-aware aggregation, and query API for email metrics |
| [@astralibx/email-ui](https://github.com/Hariprakash1997/astralib/tree/main/packages/email-ui) | 22 Lit Web Components for managing accounts, rules, and analytics dashboards |

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

See [CONTRIBUTING.md](https://github.com/Hariprakash1997/astralib/blob/main/CONTRIBUTING.md) for detailed development and publishing workflows.

## License

MIT
