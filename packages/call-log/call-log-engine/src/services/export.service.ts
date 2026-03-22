import type { Model } from 'mongoose';
import type { LogAdapter } from '@astralibx/core';
import type { ExportFormat, ExportFilter, DateRange } from '@astralibx/call-log-types';
import type { ICallLogDocument } from '../schemas/call-log.schema.js';
import type { PipelineAnalyticsService } from './pipeline-analytics.service.js';
import { CallLogNotFoundError } from '../errors/index.js';

// ── CSV columns ───────────────────────────────────────────────────────────────

const CSV_HEADER = 'callLogId,contactName,contactPhone,contactEmail,direction,pipelineId,currentStageId,priority,agentId,callDate,isClosed,tags';

// ── Service ───────────────────────────────────────────────────────────────────

export class ExportService {
  constructor(
    private CallLog: Model<ICallLogDocument>,
    private pipelineAnalytics: PipelineAnalyticsService,
    private logger: LogAdapter,
  ) {}

  async exportCallLog(callLogId: string, format: ExportFormat): Promise<string> {
    const callLog = await this.CallLog.findOne({ callLogId });
    if (!callLog) throw new CallLogNotFoundError(callLogId);

    if (format === 'csv') {
      return this.toCSV([callLog]);
    }

    return JSON.stringify(
      (callLog as unknown as { toObject(): unknown }).toObject
        ? (callLog as unknown as { toObject(): unknown }).toObject()
        : callLog,
      null,
      2,
    );
  }

  async exportCallLogs(filter: ExportFilter, format: ExportFormat): Promise<string> {
    const query: Record<string, unknown> = {};

    if (filter.pipelineId) query.pipelineId = filter.pipelineId;
    if (filter.stageId) query.currentStageId = filter.stageId;
    if (filter.agentId) query.agentId = filter.agentId;
    if (filter.tags && filter.tags.length > 0) query.tags = { $in: filter.tags };
    if (filter.category) query.category = filter.category;
    if (filter.isClosed !== undefined) query.isClosed = filter.isClosed;

    if (filter.dateFrom || filter.dateTo) {
      const dateFilter: Record<string, unknown> = {};
      if (filter.dateFrom) dateFilter.$gte = new Date(filter.dateFrom);
      if (filter.dateTo) dateFilter.$lte = new Date(filter.dateTo);
      query.callDate = dateFilter;
    }

    const callLogs = await this.CallLog.find(query).sort({ callDate: -1 });

    if (format === 'csv') {
      return this.toCSV(callLogs);
    }

    return JSON.stringify(
      callLogs.map((c) =>
        (c as unknown as { toObject(): unknown }).toObject
          ? (c as unknown as { toObject(): unknown }).toObject()
          : c,
      ),
      null,
      2,
    );
  }

  async exportPipelineReport(pipelineId: string, dateRange: DateRange, format: ExportFormat): Promise<string> {
    const report = await this.pipelineAnalytics.getPipelineStats(pipelineId, dateRange);

    if (format === 'csv') {
      const header = 'pipelineId,pipelineName,totalCalls,stageId,stageName,count,avgTimeMs,conversionRate,bottleneckStage';
      const rows: string[] = [header];
      for (const stage of report.stages) {
        rows.push(
          [
            this.escapeCSV(report.pipelineId),
            this.escapeCSV(report.pipelineName),
            String(report.totalCalls),
            this.escapeCSV(stage.stageId),
            this.escapeCSV(stage.stageName),
            String(stage.count),
            String(stage.avgTimeMs),
            String(stage.conversionRate),
            this.escapeCSV(report.bottleneckStage ?? ''),
          ].join(','),
        );
      }
      this.logger.info('Pipeline report exported as CSV', { pipelineId });
      return rows.join('\n');
    }

    this.logger.info('Pipeline report exported as JSON', { pipelineId });
    return JSON.stringify(report, null, 2);
  }

  private toCSV(callLogs: ICallLogDocument[]): string {
    const rows: string[] = [CSV_HEADER];

    for (const c of callLogs) {
      const row = [
        this.escapeCSV(c.callLogId),
        this.escapeCSV(c.contactRef?.displayName ?? ''),
        this.escapeCSV(c.contactRef?.phone ?? ''),
        this.escapeCSV(c.contactRef?.email ?? ''),
        this.escapeCSV(c.direction ?? ''),
        this.escapeCSV(c.pipelineId ?? ''),
        this.escapeCSV(c.currentStageId ?? ''),
        this.escapeCSV(c.priority ?? ''),
        this.escapeCSV(c.agentId?.toString() ?? ''),
        c.callDate ? new Date(c.callDate).toISOString() : '',
        String(c.isClosed ?? false),
        this.escapeCSV((c.tags ?? []).join(';')),
      ].join(',');
      rows.push(row);
    }

    return rows.join('\n');
  }

  private escapeCSV(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
