# Astralib

Reusable utility packages for Node.js applications.

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [@astralibx/email-rule-engine](./packages/email-rule-engine) | Rule-based email automation with MJML + Handlebars templates, throttling, and distributed locking | `1.0.0` |

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
