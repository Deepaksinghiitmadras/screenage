import { Schema, model, models, type Document, type Model } from 'mongoose';

export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    createdAt: Date;
}

export interface Conversation extends Document {
    userId: string;
    title: string;
    messages: ConversationMessage[];
    createdAt: Date;
    updatedAt: Date;
}

const MessageSchema = new Schema<ConversationMessage>(
    {
        role: { type: String, enum: ['user', 'assistant'], required: true },
        content: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
    },
    { _id: false },
);

const ConversationSchema = new Schema<Conversation>(
    {
        userId: { type: String, required: true, index: true },
        title: { type: String, required: true, default: 'New chat' },
        messages: { type: [MessageSchema], default: [] },
    },
    { timestamps: true },
);

ConversationSchema.index({ userId: 1, updatedAt: -1 });

export const ConversationModel: Model<Conversation> =
    (models?.Conversation as Model<Conversation>) || model<Conversation>('Conversation', ConversationSchema);
