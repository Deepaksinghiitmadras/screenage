import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface HoldingItem extends Document {
    userId: string;
    symbol: string;
    company: string;
    quantity: number;
    avgPrice: number;       // average buy price per share (₹)
    buyDate?: Date;         // optional, used for annualized-return estimate
    createdAt: Date;
    updatedAt: Date;
}

const HoldingSchema = new Schema<HoldingItem>(
    {
        userId: { type: String, required: true, index: true },
        symbol: { type: String, required: true, uppercase: true, trim: true },
        company: { type: String, required: true, trim: true },
        quantity: { type: Number, required: true, min: 0 },
        avgPrice: { type: Number, required: true, min: 0 },
        buyDate: { type: Date },
    },
    { timestamps: true }
);

// One aggregated holding per symbol per user.
HoldingSchema.index({ userId: 1, symbol: 1 }, { unique: true });

export const Holding: Model<HoldingItem> =
    (models?.Holding as Model<HoldingItem>) || model<HoldingItem>('Holding', HoldingSchema);
