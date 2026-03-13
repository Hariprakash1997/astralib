# Contributing to Astralib

## Creating a New Package

1. Create the package directory:
```bash
mkdir -p packages/my-package/src
```

2. Copy the template files:
```bash
cp _template/package.json packages/my-package/package.json
cp _template/tsconfig.json packages/my-package/tsconfig.json
cp _template/jest.config.ts packages/my-package/jest.config.ts
cp _template/src/index.ts packages/my-package/src/index.ts
```

3. Update `package.json`:
   - Change `name` to `@astralibx/my-package`
   - Update `description`
   - Add peer dependencies specific to your package

4. Write your code in `src/`, export from `src/index.ts`

5. Build and test:
```bash
npx turbo run build --filter=@astralibx/my-package
npx turbo run test --filter=@astralibx/my-package
```

## Making Changes

1. Make your code changes
2. Record the changeset:
```bash
npm run changeset
# Select affected packages
# Choose semver bump type (patch/minor/major)
# Write a summary
```
3. Commit everything (including the `.changeset/*.md` file)

## Releasing

1. Version all changed packages:
```bash
npm run version-packages
```
2. Review the version bumps and CHANGELOG.md updates
3. Commit and push to main
4. CI publishes bumped packages automatically

## Versioning Rules

- **patch**: Bug fixes, internal refactors that don't change API
- **minor**: New features, new exports, new optional config fields
- **major**: Breaking changes to config shape, removed exports, renamed types

## Cross-Package Dependencies

Use `workspace:*` for internal deps:
```json
{
  "dependencies": {
    "@astralibx/logger": "workspace:*"
  }
}
```

Changesets automatically resolves `workspace:*` to real versions on publish.
