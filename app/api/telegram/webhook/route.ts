import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import { Preference } from '@/database/models/preference.model';
import { getWebhookSecret, sendTelegramMessage, escapeHtml } from '@/lib/telegram';

export const dynamic = 'force-dynamic';

interface TgChat { id: number; username?: string; first_name?: string }
interface TgMessage { chat: TgChat; text?: string; from?: { username?: string; first_name?: string } }
interface TgUpdate { message?: TgMessage }

const HELP = [
    '<b>Screenage bot</b>',
    '',
    'Commands:',
    '/start &lt;code&gt; — link your Screenage account',
    '/status — show link status',
    '/stop — disconnect this chat',
    '/help — show this help',
].join('\n');

async function reply(chatId: number, html: string) {
    await sendTelegramMessage(chatId, html);
}

export async function POST(req: NextRequest) {
    // Verify the shared secret so only Telegram can call this endpoint.
    const secret = getWebhookSecret();
    if (secret) {
        const header = req.headers.get('x-telegram-bot-api-secret-token');
        if (header !== secret) {
            return NextResponse.json({ ok: false }, { status: 401 });
        }
    }

    let update: TgUpdate;
    try {
        update = (await req.json()) as TgUpdate;
    } catch {
        return NextResponse.json({ ok: true }); // ignore malformed bodies
    }

    const msg = update.message;
    if (!msg?.chat?.id) return NextResponse.json({ ok: true });

    const chatId = msg.chat.id;
    const text = (msg.text || '').trim();
    const username = msg.from?.username || msg.chat.username || msg.from?.first_name || 'there';

    try {
        await connectToDatabase();

        if (text.startsWith('/start')) {
            const token = text.split(/\s+/)[1];
            if (!token) {
                await reply(
                    chatId,
                    'Welcome to <b>Screenage</b>! To connect, open Screenage → Watchlist → <i>Connect Telegram</i> and tap the link there.',
                );
                return NextResponse.json({ ok: true });
            }

            const pref = await Preference.findOne({
                telegramLinkToken: token,
                telegramLinkTokenExpires: { $gt: new Date() },
            });

            if (!pref) {
                await reply(chatId, '⚠️ This link is invalid or expired. Please generate a new one in Screenage.');
                return NextResponse.json({ ok: true });
            }

            pref.telegramChatId = String(chatId);
            pref.telegramUsername = username;
            pref.telegramLinkedAt = new Date();
            pref.telegramLinkToken = undefined;
            pref.telegramLinkTokenExpires = undefined;
            await pref.save();

            await reply(
                chatId,
                `✅ Connected! Hi <b>${escapeHtml(username)}</b>, your Screenage alerts and daily brief can now be delivered here. Manage what you receive in the app.`,
            );
            return NextResponse.json({ ok: true });
        }

        if (text.startsWith('/status')) {
            const pref = await Preference.findOne({ telegramChatId: String(chatId) }).lean();
            if (!pref) {
                await reply(chatId, 'This chat is not linked to a Screenage account. Use /start &lt;code&gt; from the app.');
            } else {
                await reply(
                    chatId,
                    `Linked as <b>${escapeHtml(pref.email)}</b>.\nAlerts: ${pref.telegramAlerts ? 'on' : 'off'} · Daily brief: ${pref.telegramDigest ? 'on' : 'off'}`,
                );
            }
            return NextResponse.json({ ok: true });
        }

        if (text.startsWith('/stop') || text.startsWith('/unlink')) {
            await Preference.findOneAndUpdate(
                { telegramChatId: String(chatId) },
                { $unset: { telegramChatId: '', telegramUsername: '', telegramLinkedAt: '' } },
            );
            await reply(chatId, '🔕 Disconnected. You will no longer receive Screenage messages here.');
            return NextResponse.json({ ok: true });
        }

        // /help and anything else
        await reply(chatId, HELP);
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('telegram webhook error:', error);
        // Always 200 so Telegram doesn't retry-storm us.
        return NextResponse.json({ ok: true });
    }
}
