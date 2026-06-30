import { Schema, model, models, type Document, type Model } from 'mongoose';

export type AlertKind = 'PRICE' | 'PCT_CHANGE' | 'RSI';
export type AlertCondition = 'ABOVE' | 'BELOW';

export interface IAlert extends Document {
    userId: string;
    symbol: string;
    kind: AlertKind;
    targetPrice: number;     // used when kind === 'PRICE'
    threshold: number;       // % move (PCT_CHANGE) or RSI level (RSI)
    condition: AlertCondition;
    active: boolean;
    triggered: boolean;
    expiresAt: Date;
    createdAt: Date;
}

const AlertSchema = new Schema<IAlert>(
    {
        userId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        kind: { type: String, enum: ['PRICE', 'PCT_CHANGE', 'RSI'], default: 'PRICE' },
        targetPrice: { type: Number, default: 0 },
        threshold: { type: Number, default: 0 },
        condition: { type: String, enum: ['ABOVE', 'BELOW'], required: true },
        active: { type: Boolean, default: true },
        triggered: { type: Boolean, default: false },
        expiresAt: {
            type: Date,
            default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days from now
        },
        createdAt: { type: Date, default: Date.now },
    },
    { timestamps: true }
);

export const Alert: Model<IAlert> = (models?.Alert as Model<IAlert>) || model<IAlert>('Alert', AlertSchema);
