'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Alert, type IAlert } from '@/database/models/alert.model';
import { revalidatePath } from 'next/cache';

// Create a new alert
export async function createAlert(params: {
    userId: string;
    symbol: string;
    kind?: 'PRICE' | 'PCT_CHANGE' | 'RSI';
    targetPrice?: number;
    threshold?: number;
    condition: 'ABOVE' | 'BELOW';
}) {
    try {
        await connectToDatabase();
        const kind = params.kind ?? 'PRICE';
        const newAlert = await Alert.create({
            userId: params.userId,
            symbol: params.symbol,
            kind,
            condition: params.condition,
            targetPrice: kind === 'PRICE' ? (params.targetPrice ?? 0) : 0,
            threshold: kind === 'PRICE' ? 0 : (params.threshold ?? 0),
            active: true,
            // expiresAt handled by default value in schema
        });
        revalidatePath('/watchlist');
        return JSON.parse(JSON.stringify(newAlert));
    } catch (error) {
        console.error('Error creating alert:', error);
        throw new Error('Failed to create alert');
    }
}

// Get all alerts for a user
export async function getUserAlerts(userId: string) {
    try {
        await connectToDatabase();
        const alerts = await Alert.find({ userId }).sort({ createdAt: -1 });
        return JSON.parse(JSON.stringify(alerts));
    } catch (error) {
        console.error('Error fetching alerts:', error);
        return [];
    }
}

// Delete an alert
export async function deleteAlert(alertId: string) {
    try {
        await connectToDatabase();
        await Alert.findByIdAndDelete(alertId);
        revalidatePath('/watchlist');
        return { success: true };
    } catch (error) {
        console.error('Error deleting alert:', error);
        throw new Error('Failed to delete alert');
    }
}

// Toggle alert active status (optional utility)
export async function toggleAlert(alertId: string, active: boolean) {
    try {
        await connectToDatabase();
        await Alert.findByIdAndUpdate(alertId, { active });
        revalidatePath('/watchlist');
        return { success: true };
    } catch (error) {
        console.error('Error toggling alert:', error);
        throw new Error('Failed to update alert');
    }
}
