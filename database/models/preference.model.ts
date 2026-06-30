import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface IPreference extends Document {
    userId: string;
    email: string;
    name?: string;
    dailyDigest: boolean;
    // Telegram notification channel
    telegramChatId?: string;
    telegramUsername?: string;
    telegramLinkedAt?: Date;
    telegramLinkToken?: string;
    telegramLinkTokenExpires?: Date;
    telegramAlerts: boolean;   // push price/RSI/%-change alerts to Telegram
    telegramDigest: boolean;   // push the daily brief to Telegram
    createdAt: Date;
    updatedAt: Date;
}

const PreferenceSchema = new Schema<IPreference>(
    {
        userId: { type: String, required: true, unique: true, index: true },
        email: { type: String, required: true },
        name: { type: String },
        dailyDigest: { type: Boolean, default: false },
        telegramChatId: { type: String, index: true },
        telegramUsername: { type: String },
        telegramLinkedAt: { type: Date },
        telegramLinkToken: { type: String, index: true },
        telegramLinkTokenExpires: { type: Date },
        telegramAlerts: { type: Boolean, default: true },
        telegramDigest: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const Preference: Model<IPreference> =
    (models?.Preference as Model<IPreference>) || model<IPreference>('Preference', PreferenceSchema);
