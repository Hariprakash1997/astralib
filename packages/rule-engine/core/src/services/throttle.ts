import { RULE_TYPE } from '../constants';
import type { RuleRunStats } from '../types/rule.types';

const MS_PER_DAY = 86400000;

export interface UserThrottle {
  today: number;
  thisWeek: number;
  lastSentDate: Date | null;
}

export function getTodayStart(timezone?: string): Date {
  if (timezone) {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(now);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
    const tzNowMs = Date.UTC(
      parseInt(get('year')),
      parseInt(get('month')) - 1,
      parseInt(get('day')),
      parseInt(get('hour')),
      parseInt(get('minute')),
      parseInt(get('second'))
    );
    const tzMidnightMs = Date.UTC(
      parseInt(get('year')),
      parseInt(get('month')) - 1,
      parseInt(get('day'))
    );
    const offsetMs = now.getTime() - tzNowMs;
    return new Date(tzMidnightMs + offsetMs);
  }
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  return todayStart;
}

export function buildThrottleMap(recentSends: any[], todayStart: Date): Map<string, UserThrottle> {
  const map = new Map<string, UserThrottle>();

  for (const send of recentSends) {
    const key = send.userId.toString();
    const current = map.get(key) || { today: 0, thisWeek: 0, lastSentDate: null };
    const sentAt = new Date(send.sentAt);

    current.thisWeek++;
    if (sentAt >= todayStart) {
      current.today++;
    }
    if (!current.lastSentDate || sentAt > current.lastSentDate) {
      current.lastSentDate = sentAt;
    }

    map.set(key, current);
  }

  return map;
}

export function checkThrottle(
  rule: any,
  userId: string,
  contactValue: string,
  throttleMap: Map<string, UserThrottle>,
  config: any,
  stats: RuleRunStats,
  emitFn: (contactValue: string, status: string, failureReason: string) => void
): boolean {
  if (rule.ruleType === RULE_TYPE.Transactional || rule.bypassThrottle) return true;

  const overrides = rule.throttleOverride || {};
  const dailyLimit = overrides.maxPerUserPerDay ?? config.maxPerUserPerDay;
  const weeklyLimit = overrides.maxPerUserPerWeek ?? config.maxPerUserPerWeek;
  const minGap = overrides.minGapDays ?? config.minGapDays;

  const userThrottle = throttleMap.get(userId) || { today: 0, thisWeek: 0, lastSentDate: null };

  if (userThrottle.today >= dailyLimit) {
    stats.throttled++;
    emitFn(contactValue, 'throttled', 'daily throttle limit');
    return false;
  }
  if (userThrottle.thisWeek >= weeklyLimit) {
    stats.throttled++;
    emitFn(contactValue, 'throttled', 'weekly throttle limit');
    return false;
  }
  if (userThrottle.lastSentDate) {
    const daysSinceLastSend = (Date.now() - userThrottle.lastSentDate.getTime()) / MS_PER_DAY;
    if (daysSinceLastSend < minGap) {
      stats.throttled++;
      emitFn(contactValue, 'throttled', 'min gap days');
      return false;
    }
  }

  return true;
}
