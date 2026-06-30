/**
 * Telegram Bot API helpers.
 *
 * Idea/reference: OpenAlgo's Telegram notification bot. We only use the public
 * Bot API (https://core.telegram.org/bots/api) — no third-party SDK — so it
 * stays dependency-free and works in the Next.js/Inngest runtime.
 *
 * Configuration (env):
 *   TELEGRAM_BOT_TOKEN      — token from @BotFather (required)
 *   TELEGRAM_BOT_USERNAME   — the bot's @username, without the @ (required for deep links)
 *   TELEGRAM_WEBHOOK_SECRET — random string verified on incoming webhook calls (recommended)
 */

const API_TIMEOUT_MS = 10_000;

export function getBotToken(): string | null {
    return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

export function getBotUsername(): string | null {
    return process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, '') || null;
}

export function getWebhookSecret(): string | null {
    return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || null;
}

/** Whether Telegram is configured well enough to link accounts + send messages. */
export function isTelegramConfigured(): boolean {
    return Boolean(getBotToken() && getBotUsername());
}

/** Escape text for Telegram HTML parse mode. */
export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/** Build the t.me deep link that starts the bot with a one-time link token. */
export function buildDeepLink(token: string): string | null {
    const username = getBotUsername();
    if (!username) return null;
    return `https://t.me/${username}?start=${encodeURIComponent(token)}`;
}

async function callBotApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
    const token = getBotToken();
    if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');

    const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(API_TIMEOUT_MS),
    });

    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; description?: string; result?: T };
    if (!res.ok || !json.ok) {
        throw new Error(`Telegram ${method} failed: ${json.description || res.statusText}`);
    }
    return json.result as T;
}

/**
 * Send an HTML message to a chat. Returns true on success, false on failure
 * (callers generally shouldn't fail their whole flow if a Telegram push fails).
 */
export async function sendTelegramMessage(
    chatId: string | number,
    html: string,
    opts: { disablePreview?: boolean; silent?: boolean } = {},
): Promise<boolean> {
    try {
        await callBotApi('sendMessage', {
            chat_id: chatId,
            text: html,
            parse_mode: 'HTML',
            disable_web_page_preview: opts.disablePreview ?? true,
            disable_notification: opts.silent ?? false,
        });
        return true;
    } catch (e) {
        console.error('sendTelegramMessage failed:', e);
        return false;
    }
}

/** Register the webhook URL with Telegram (used by the setup script). */
export async function setWebhook(url: string): Promise<unknown> {
    const secret = getWebhookSecret();
    return callBotApi('setWebhook', {
        url,
        allowed_updates: ['message'],
        ...(secret ? { secret_token: secret } : {}),
    });
}
