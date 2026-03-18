import { Schema } from 'mongoose';

export function createRunStatsSchema() {
  return new Schema({
    matched: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    skippedByThrottle: { type: Number, default: 0 },
    errorCount: { type: Number, default: 0 },
  }, { _id: false });
}
