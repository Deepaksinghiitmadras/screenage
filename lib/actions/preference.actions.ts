'use server';

import { connectToDatabase } from '@/database/mongoose';
import { Preference } from '@/database/models/preference.model';
import { revalidatePath } from 'next/cache';

export async function getDigestPreference(userId: string): Promise<boolean> {
    try {
        await connectToDatabase();
        const pref = await Preference.findOne({ userId }).lean();
        return !!pref?.dailyDigest;
    } catch (error) {
        console.error('Error reading digest preference:', error);
        return false;
    }
}

export async function setDigestPreference(userId: string, email: string, name: string, dailyDigest: boolean) {
    try {
        await connectToDatabase();
        await Preference.findOneAndUpdate(
            { userId },
            { userId, email, name, dailyDigest },
            { upsert: true, new: true },
        );
        revalidatePath('/watchlist');
        return { success: true };
    } catch (error) {
        console.error('Error saving digest preference:', error);
        return { success: false, error: 'Failed to save preference.' };
    }
}
