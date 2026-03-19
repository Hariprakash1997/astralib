import type { Redis } from 'ioredis';
import type { RunStatusResponse } from '../types/run.types';
import type { RuleRunStats } from '../types/rule.types';

export async function updateRunProgress(
  redis: Redis,
  keyPrefix: string,
  runId: string,
  data: Partial<RunStatusResponse>
): Promise<void> {
  const key = `${keyPrefix}run:${runId}:progress`;
  const flat: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'object' && v !== null) {
      flat.push(k, JSON.stringify(v));
    } else {
      flat.push(k, String(v));
    }
  }
  if (flat.length > 0) {
    await redis.hset(key, ...flat);
    await redis.expire(key, 3600);
  }
}

export async function updateRunSendProgress(
  redis: Redis,
  keyPrefix: string,
  runId: string,
  stats: RuleRunStats
): Promise<void> {
  const key = `${keyPrefix}run:${runId}:progress`;
  const existing = await redis.hget(key, 'progress');
  let progress = { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, invalid: 0 };
  if (existing) {
    try { progress = JSON.parse(existing); } catch { /* use default */ }
  }
  progress.sent = stats.sent;
  progress.failed = stats.failed;
  progress.skipped = stats.skipped + stats.throttled;
  await redis.hset(key, 'progress', JSON.stringify(progress));
  await redis.expire(key, 3600);
}

export async function getRunStatus(
  redis: Redis,
  keyPrefix: string,
  runId: string
): Promise<RunStatusResponse | null> {
  const key = `${keyPrefix}run:${runId}:progress`;
  const data = await redis.hgetall(key);
  if (!data || Object.keys(data).length === 0) return null;

  let progress = { rulesTotal: 0, rulesCompleted: 0, sent: 0, failed: 0, skipped: 0, invalid: 0 };
  if (data.progress) {
    try { progress = JSON.parse(data.progress); } catch { /* use default */ }
  }

  return {
    runId: data.runId || runId,
    status: (data.status as RunStatusResponse['status']) || 'running',
    currentRule: data.currentRule || '',
    progress,
    startedAt: data.startedAt || '',
    elapsed: parseInt(data.elapsed || '0', 10)
  };
}

export async function cancelRun(
  redis: Redis,
  keyPrefix: string,
  runId: string
): Promise<{ ok: boolean }> {
  const progressKey = `${keyPrefix}run:${runId}:progress`;
  const exists = await redis.exists(progressKey);
  if (!exists) return { ok: false };

  const cancelKey = `${keyPrefix}run:${runId}:cancel`;
  await redis.set(cancelKey, '1', 'EX', 3600);
  return { ok: true };
}
