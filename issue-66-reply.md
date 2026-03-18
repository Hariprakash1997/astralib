Fixed. The repeated BullMQ eviction policy warnings are now suppressed during queue/worker initialization. Instead, the queue service checks the Redis `maxmemory-policy` once at startup and logs a single warning via the configured logger if it's not set to `noeviction`.

If you're using a managed Redis that doesn't support `CONFIG GET`, the check is silently skipped.

To fix the root cause on your Redis server: `redis-cli CONFIG SET maxmemory-policy noeviction`
