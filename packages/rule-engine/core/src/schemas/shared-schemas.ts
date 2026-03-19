import { Schema } from 'mongoose';

export function createRunStatsSchema() {
  return new Schema({
    matched: { type: Number, default: 0 },
    sent: { type: Number, default: 0 },
    skipped: { type: Number, default: 0 },
    throttled: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  }, { _id: false });
}
