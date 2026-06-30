'use server';

import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { connectToDatabase } from '@/database/mongoose';
import { Preference } from '@/database/models/preference.model';
import { auth } from '@/lib/better-auth/auth';
import { getFundamentals } from '@/lib/actions/market.actions';
import { buildDeepLink, escapeHtml, isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram';

const LINK_TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface TelegramStatus {
    configured: boolean;     // admin has set up a bot
    linked: boolean;         // this user has connected a chat
    username?: string | null;
    alerts: boolean;
    digest: boolean;
}

export async function getTelegramStatus(userId: string): Promise<TelegramStatus> {
    const configured = isTelegramConfigured();
    try {
        await connectToDatabase();
        const pref = await Preference.findOne({ userId }).lean();
        return {
            configured,
            linked: Boolean(pref?.telegramChatId),
            username: pref?.telegramUsername ?? null,
            alerts: pref?.telegramAlerts ?? true,
            digest: pref?.telegramDigest ?? false,
        };
    } catch (error) {
        console.error('getTelegramStatus error:', error);
        return { configured, linked: false, alerts: true, digest: false };
    }
}

/**
 * Create a one-time link token and return the t.me deep link. The user taps it,
 * presses Start, and the webhook (/api/telegram/webhook) attaches their chat.
 */
export async function generateTelegramLink(
    userId: string,
    email: string,
    name: string,
): Promise<{ success: boolean; url?: string; error?: string }> {
    if (!isTelegramConfigured()) {
        return { success: false, error: 'Telegram is not configured on this server.' };
    }
    try {
        await connectToDatabase();
        const token = randomBytes(24).toString('base64url'); // url-safe, ~32 chars
        await Preference.findOneAndUpdate(
            { userId },
            {
                userId,
                email,
                name,
                telegramLinkToken: token,
                telegramLinkTokenExpires: new Date(Date.now() + LINK_TOKEN_TTL_MS),
            },
            { upsert: true, new: true },
        );
        const url = buildDeepLink(token);
        if (!url) return { success: false, error: 'Bot username missing.' };
        return { success: true, url };
    } catch (error) {
        console.error('generateTelegramLink error:', error);
        return { success: false, error: 'Could not start linking. Try again.' };
    }
}

export async function unlinkTelegram(userId: string): Promise<{ success: boolean }> {
    try {
        await connectToDatabase();
        await Preference.findOneAndUpdate(
            { userId },
            {
                $unset: {
                    telegramChatId: '',
                    telegramUsername: '',
                    telegramLinkedAt: '',
                    telegramLinkToken: '',
                    telegramLinkTokenExpires: '',
                },
            },
        );
        revalidatePath('/watchlist');
        return { success: true };
    } catch (error) {
        console.error('unlinkTelegram error:', error);
        return { success: false };
    }
}

export async function setTelegramPref(
    userId: string,
    key: 'telegramAlerts' | 'telegramDigest',
    value: boolean,
): Promise<{ success: boolean }> {
    try {
        await connectToDatabase();
        await Preference.findOneAndUpdate({ userId }, { [key]: value });
        revalidatePath('/watchlist');
        return { success: true };
    } catch (error) {
        console.error('setTelegramPref error:', error);
        return { success: false };
    }
}

export async function sendTelegramTest(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        await connectToDatabase();
        const pref = await Preference.findOne({ userId }).lean();
        if (!pref?.telegramChatId) return { success: false, error: 'Telegram not linked.' };
        const ok = await sendTelegramMessage(
            pref.telegramChatId,
            `✅ <b>Screenage</b> is connected.\nYou'll receive your selected alerts here.`,
        );
        return ok ? { success: true } : { success: false, error: 'Failed to send test message.' };
    } catch (error) {
        console.error('sendTelegramTest error:', error);
        return { success: false, error: 'Failed to send test message.' };
    }
}

const fmtNum = (n: number | null | undefined): string =>
    n == null || Number.isNaN(n) ? '—' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

const fmtCr = (n: number | null | undefined): string => {
    if (n == null || Number.isNaN(n)) return '—';
    if (n >= 1e7) return `₹${(n / 1e7).toFixed(0)} Cr`;
    return `₹${fmtNum(n)}`;
};

/**
 * Share a snapshot of a stock to the signed-in user's linked Telegram chat.
 * Derives the user from the session (not a client-supplied id) for safety.
 */
export async function shareStockToTelegram(
    symbol: string,
): Promise<{ success: boolean; notLinked?: boolean; configured?: boolean; error?: string }> {
    const configured = isTelegramConfigured();
    try {
        const session = await auth.api.getSession({ headers: await headers() });
        const userId = session?.user?.id;
        if (!userId) return { success: false, configured, error: 'Please sign in.' };
        if (!configured) return { success: false, configured, error: 'Telegram is not configured on this server.' };

        await connectToDatabase();
        const pref = await Preference.findOne({ userId }).lean();
        if (!pref?.telegramChatId) return { success: false, configured, notLinked: true, error: 'Telegram not connected.' };

        const f = await getFundamentals(symbol);
        const sym = symbol.toUpperCase();
        const name = f?.name ?? sym;
        const up = (f?.changePercent ?? 0) >= 0;
        const m = f?.metrics;

        const header =
            f?.price != null
                ? `📈 <b>${escapeHtml(name)}</b> (${escapeHtml(sym)})\n₹${fmtNum(f.price)} ${up ? '🟢' : '🔴'} ${f.change != null ? `${up ? '+' : ''}${fmtNum(f.change)} ` : ''}${f.changePercent != null ? `(${up ? '+' : ''}${f.changePercent.toFixed(2)}%)` : ''}`
                : `📈 <b>${escapeHtml(name)}</b> (${escapeHtml(sym)})`;

        const facts: string[] = [];
        if (f?.sector) facts.push(`Sector: ${escapeHtml(f.sector)}`);
        if (m?.marketCap != null) facts.push(`Mkt Cap: ${fmtCr(m.marketCap)}`);
        if (m?.trailingPE != null) facts.push(`P/E: ${fmtNum(m.trailingPE)}`);
        if (m?.priceToBook != null) facts.push(`P/B: ${fmtNum(m.priceToBook)}`);
        if (m?.dividendYield != null) facts.push(`Div Yield: ${fmtNum(m.dividendYield)}%`);
        if (m?.roe != null) facts.push(`RoE: ${fmtNum(m.roe)}%`);
        if (f?.fiftyTwoWeekLow != null || f?.fiftyTwoWeekHigh != null)
            facts.push(`52W: ₹${fmtNum(f?.fiftyTwoWeekLow)} – ₹${fmtNum(f?.fiftyTwoWeekHigh)}`);

        const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || '';
        const link = base ? `\n\n🔗 <a href="${base}/stocks/${encodeURIComponent(sym)}">Open in Screenage</a>` : '';

        const text = [header, '', facts.join('\n'), '', '<i>Research, not investment advice.</i>'].join('\n') + link;

        const ok = await sendTelegramMessage(pref.telegramChatId, text);
        return ok ? { success: true, configured } : { success: false, configured, error: 'Failed to send.' };
    } catch (error) {
        console.error('shareStockToTelegram error:', error);
        return { success: false, configured, error: 'Failed to send.' };
    }
}
