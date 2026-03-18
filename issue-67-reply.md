Fixed. Added `@astralibx/core` as a peer dependency with `^1.2.0` minimum version in `package.json`. This ensures npm installs a compatible core version that includes `RedisLock`.

The `RedisLock` class was added in core 1.2.0. Versions before that (like 1.1.3) don't export it, causing the `core.RedisLock is not a constructor` error.
