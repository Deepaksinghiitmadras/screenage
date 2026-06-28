import { Schema, model, models, type Document, type Model } from 'mongoose';

/**
 * A saved AI screener run: the query, the interpreted summary, the derived
 * criteria and the result rows. Lets users revisit past screens without
 * re-calling the LLM (saves cost).
 */
export interface ScreenerHistoryDoc extends Document {
    userId: string;
    query: string;
    interpreted?: string;
    result: unknown; // full ScreenerResult snapshot
    matches: number;
    createdAt: Date;
    updatedAt: Date;
}

const ScreenerHistorySchema = new Schema<ScreenerHistoryDoc>(
    {
        userId: { type: String, required: true, index: true },
        query: { type: String, required: true },
        interpreted: { type: String },
        result: { type: Schema.Types.Mixed, required: true },
        matches: { type: Number, default: 0 },
    },
    { timestamps: true },
);

ScreenerHistorySchema.index({ userId: 1, updatedAt: -1 });

export const ScreenerHistoryModel: Model<ScreenerHistoryDoc> =
    (models?.ScreenerHistory as Model<ScreenerHistoryDoc>) ||
    model<ScreenerHistoryDoc>('ScreenerHistory', ScreenerHistorySchema);
