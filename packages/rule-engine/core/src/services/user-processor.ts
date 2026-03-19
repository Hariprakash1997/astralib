import type { TemplateRenderService } from './template-render.service';
import type { RuleRunStats } from '../types/rule.types';
import type { RuleEngineConfig, LogAdapter } from '../types/config.types';
import type { SendLogModel } from '../schemas/send-log.schema';
import type { ErrorLogModel } from '../schemas/error-log.schema';
import type { UserThrottle } from './throttle';
import { checkThrottle } from './throttle';
import { updateRunSendProgress } from './run-progress';
import type { Redis } from 'ioredis';

const MS_PER_DAY = 86400000;

export interface CompiledVariants {
  subjectFns: ((data: any) => string)[];
  bodyFns: ((data: any) => string)[];
  textBodyFn: ((data: any) => string) | null;
  preheaderFns?: ((data: any) => string)[];
}

export function compileTemplateVariants(templateRenderer: TemplateRenderService, template: any): CompiledVariants {
  const preheaders: string[] = template.preheaders || [];
  const compiledVariants = templateRenderer.compileBatchVariants(
    template.subjects || [], template.bodies || [], preheaders.length > 0 ? preheaders : undefined
  );
  const textBodyFn = template.textBody
    ? templateRenderer.compile(template.textBody)
    : null;
  return { ...compiledVariants, textBodyFn };
}

export function emitSendEvent(
  config: RuleEngineConfig,
  rule: any,
  contactValue: string,
  status: string,
  templateId: string,
  runId: string,
  opts?: { accountId?: string; subjectIndex?: number; bodyIndex?: number; failureReason?: string }
): void {
  config.hooks?.onSend?.({
    ruleId: rule._id.toString(), ruleName: rule.name, contactValue, status: status as any,
    accountId: opts?.accountId ?? '', templateId, runId: runId || '',
    subjectIndex: opts?.subjectIndex ?? -1, bodyIndex: opts?.bodyIndex ?? -1,
    failureReason: opts?.failureReason,
  });
}

export async function processSingleUser(params: {
  rule: any;
  contactValue: string;
  userKey: string;
  identifier: { id: string; contactId: string };
  user: Record<string, unknown>;
  sendMap: Map<string, any>;
  throttleMap: Map<string, UserThrottle>;
  throttleConfig: any;
  template: any;
  compiledVariants: CompiledVariants;
  templateId: string;
  ruleId: string;
  runId?: string;
  stats: RuleRunStats;
  config: RuleEngineConfig;
  logger: LogAdapter;
  SendLog: SendLogModel;
  ErrorLog: ErrorLogModel;
}): Promise<'sent' | 'skipped' | 'error'> {
  const {
    rule, contactValue, userKey, identifier, user, sendMap, throttleMap,
    throttleConfig, template, compiledVariants, templateId, ruleId, runId, stats,
    config, logger, SendLog, ErrorLog
  } = params;

  const emitFn = (cv: string, status: string, templateIdArg: string, runIdArg: string, opts?: any) =>
    emitSendEvent(config, rule, cv, status, templateIdArg, runIdArg, opts);

  const lastSend = sendMap.get(userKey);
  if (lastSend) {
    if (rule.sendOnce && rule.resendAfterDays == null) {
      stats.skipped++;
      emitFn(contactValue, 'skipped', templateId, runId || '', { failureReason: 'send once' });
      return 'skipped';
    }
    if (rule.resendAfterDays != null) {
      const daysSince = (Date.now() - new Date(lastSend.sentAt).getTime()) / MS_PER_DAY;
      if (daysSince < rule.resendAfterDays) {
        stats.skipped++;
        emitFn(contactValue, 'skipped', templateId, runId || '', { failureReason: 'resend too soon' });
        return 'skipped';
      }
    } else {
      stats.skipped++;
      emitFn(contactValue, 'skipped', templateId, runId || '', { failureReason: 'send once' });
      return 'skipped';
    }
    if (rule.cooldownDays) {
      const daysSince = (Date.now() - new Date(lastSend.sentAt).getTime()) / MS_PER_DAY;
      if (daysSince < rule.cooldownDays) {
        stats.skipped++;
        emitFn(contactValue, 'skipped', templateId, runId || '', { failureReason: 'cooldown period' });
        return 'skipped';
      }
    }
  }

  const throttleEmitFn = (cv: string, status: string, failureReason: string) =>
    emitFn(cv, status, templateId || '', runId || '', { failureReason });
  if (!checkThrottle(rule, userKey, contactValue, throttleMap, throttleConfig, stats, throttleEmitFn)) return 'skipped';

  const agentSelection = await config.adapters.selectAgent(identifier.id, { ruleId, templateId });
  if (!agentSelection) {
    stats.skipped++;
    emitFn(contactValue, 'skipped', templateId, runId || '', { failureReason: 'no account available' });
    return 'skipped';
  }

  const resolvedData = config.adapters.resolveData(user);
  const templateData = { ...(template.fields || {}), ...resolvedData };

  const si = compiledVariants.subjectFns.length > 0
    ? Math.floor(Math.random() * compiledVariants.subjectFns.length)
    : -1;
  const bi = Math.floor(Math.random() * compiledVariants.bodyFns.length);

  const renderedSubject = si >= 0 ? compiledVariants.subjectFns[si](templateData) : undefined;
  const renderedBody = compiledVariants.bodyFns[bi](templateData);
  const renderedTextBody = compiledVariants.textBodyFn
    ? compiledVariants.textBodyFn(templateData)
    : undefined;

  let finalBody = renderedBody;
  let finalTextBody = renderedTextBody;
  let finalSubject = renderedSubject;

  let pi: number | undefined;
  if (compiledVariants.preheaderFns && compiledVariants.preheaderFns.length > 0 && finalBody.includes('<body')) {
    pi = Math.floor(Math.random() * compiledVariants.preheaderFns.length);
    const renderedPreheader = compiledVariants.preheaderFns[pi](templateData);
    if (renderedPreheader) {
      const preheaderHtml = `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${renderedPreheader}</div>`;
      finalBody = finalBody.replace(/(<body[^>]*>)/i, `$1${preheaderHtml}`);
    }
  }

  if (config.hooks?.beforeSend) {
    try {
      const modified = await config.hooks.beforeSend({
        body: finalBody,
        textBody: finalTextBody,
        subject: finalSubject,
        account: {
          id: agentSelection.accountId,
          contactValue: agentSelection.contactValue,
          metadata: agentSelection.metadata,
        },
        user: {
          id: String(userKey),
          contactValue,
          name: String((user as any).name || (user as any).firstName || ''),
        },
        context: {
          ruleId,
          templateId,
          runId: runId || '',
        },
      });
      finalBody = modified.body;
      finalTextBody = modified.textBody;
      finalSubject = modified.subject;
    } catch (hookErr: any) {
      logger.error(`beforeSend hook failed for contactValue ${contactValue}: ${hookErr.message}`);
      stats.failed++;
      emitFn(contactValue, 'error', templateId, runId || '', { accountId: agentSelection.accountId, subjectIndex: si, bodyIndex: bi, failureReason: (hookErr as Error).message });
      return 'error';
    }
  }

  try {
    await config.adapters.send({
      identifierId: identifier.id,
      contactId: identifier.contactId,
      accountId: agentSelection.accountId,
      subject: finalSubject,
      body: finalBody,
      textBody: finalTextBody,
      ruleId,
      autoApprove: rule.autoApprove ?? true,
      metadata: template.metadata ? { ...template.metadata, attachments: template.attachments } : (template.attachments?.length ? { attachments: template.attachments } : undefined),
    });
  } catch (err) {
    await ErrorLog.create({
      ruleId, ruleName: rule.name, contactValue: contactValue || 'unknown',
      error: (err as Error).message, stack: (err as Error).stack,
      context: { templateId, runId }
    });
    stats.failed++;
    emitFn(contactValue, 'error', templateId, runId || '', { accountId: agentSelection.accountId, subjectIndex: si, bodyIndex: bi, failureReason: (err as Error).message });
    return 'error';
  }

  await SendLog.logSend(
    ruleId,
    userKey,
    identifier.id,
    undefined,
    { status: 'sent', accountId: agentSelection.accountId, subject: finalSubject }
  );

  const current = throttleMap.get(userKey) || { today: 0, thisWeek: 0, lastSentDate: null };
  throttleMap.set(userKey, {
    today: current.today + 1,
    thisWeek: current.thisWeek + 1,
    lastSentDate: new Date()
  });

  stats.sent++;
  emitFn(contactValue, 'sent', templateId, runId || '', { accountId: agentSelection.accountId, subjectIndex: si, bodyIndex: bi });

  return 'sent';
}

export interface ProcessUsersParams {
  rule: any;
  template: any;
  throttleMap: Map<string, UserThrottle>;
  throttleConfig: any;
  stats: RuleRunStats;
  runId?: string;
  users: { contactValue: string; userKey: string; user: Record<string, unknown>; identifier: { id: string; contactId: string } | null }[];
  sendMap: Map<string, any>;
  compiledVariants: CompiledVariants;
  ruleId: string;
  templateId: string;
  config: RuleEngineConfig;
  logger: LogAdapter;
  redis: Redis;
  keyPrefix: string;
  SendLog: SendLogModel;
  ErrorLog: ErrorLogModel;
  checkCancelledFn: (runId: string | undefined, index: number) => Promise<boolean>;
  applySendDelayFn: (isLast: boolean) => Promise<void>;
}

export async function processUsers(params: ProcessUsersParams): Promise<void> {
  const {
    rule, template, throttleMap, throttleConfig, stats, runId,
    users, sendMap, compiledVariants, ruleId, templateId,
    config, logger, redis, keyPrefix, SendLog, ErrorLog,
    checkCancelledFn, applySendDelayFn
  } = params;

  let totalProcessed = 0;

  for (let i = 0; i < users.length; i++) {
    const { contactValue, userKey, user, identifier } = users[i];

    if (await checkCancelledFn(runId, i)) break;

    try {
      if (!identifier) {
        stats.skipped++;
        emitSendEvent(config, rule, contactValue, 'invalid', templateId, runId || '', { failureReason: 'invalid contact value' });
        continue;
      }

      const result = await processSingleUser({
        rule, contactValue, userKey, identifier, user, sendMap, throttleMap,
        throttleConfig, template, compiledVariants, templateId, ruleId, runId, stats,
        config, logger, SendLog, ErrorLog
      });

      if (result === 'sent') {
        totalProcessed++;
        if (runId && totalProcessed % 10 === 0) await updateRunSendProgress(redis, keyPrefix, runId, stats);
        await applySendDelayFn(i >= users.length - 1);
      }
    } catch (err) {
      stats.failed++;
      emitSendEvent(config, rule, contactValue || 'unknown', 'error', templateId, runId || '', { failureReason: (err as Error).message || 'unknown error' });
      logger.error(`Rule "${rule.name}" failed for ${userKey}`, { error: err });
    }
  }
}
