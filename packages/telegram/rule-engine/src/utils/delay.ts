/**
 * Calculate delay with random jitter.
 * Returns milliseconds.
 */
export function calculateDelay(baseMs: number, jitterMs: number): number {
  const jitter = (Math.random() - 0.5) * 2 * jitterMs;
  return Math.max(0, baseMs + jitter);
}

/**
 * Check if the current time is within the configured send window.
 * Uses `Intl.DateTimeFormat` for timezone conversion — no manual offset math.
 */
export function isWithinSendWindow(config: { startHour: number; endHour: number; timezone: string }): boolean {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: config.timezone,
  });

  const currentHour = Number(formatter.format(new Date()));

  if (config.startHour <= config.endHour) {
    return currentHour >= config.startHour && currentHour < config.endHour;
  }

  // Wraps around midnight (e.g., startHour: 22, endHour: 6)
  return currentHour >= config.startHour || currentHour < config.endHour;
}

/**
 * Adjust a base delay based on account health score.
 * Health 100 = 1x, Health 50 = ~2.5x, Health 0 = (1 + multiplier)x.
 * Returns milliseconds.
 */
export function getHealthAdjustedDelay(baseMs: number, healthScore: number, multiplier = 3): number {
  const factor = 1 + (multiplier * (1 - Math.max(0, Math.min(100, healthScore)) / 100));
  return Math.round(baseMs * factor);
}

/**
 * Calculate a human-like delay with optional "thinking pause".
 * Returns milliseconds.
 */
export function getHumanDelay(
  baseMs: number,
  jitterMs: number,
  thinkingPauseProbability: number,
): number {
  let delay = calculateDelay(baseMs, jitterMs);

  if (Math.random() < thinkingPauseProbability) {
    // Add a "thinking pause" — an additional 2x-4x of the base delay
    const pauseMultiplier = 2 + Math.random() * 2;
    delay += baseMs * pauseMultiplier;
  }

  return Math.round(delay);
}
