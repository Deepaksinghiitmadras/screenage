/**
 * Registers the Telegram webhook so the bot forwards messages to your app.
 *
 * Usage:
 *   TELEGRAM_BOT_TOKEN=... TELEGRAM_WEBHOOK_SECRET=... \
 *   node scripts/setup-telegram-webhook.mjs https://your-app.vercel.app
 *
 * The webhook path is always <base>/api/telegram/webhook.
 * Reads from .env automatically if present.
 */

import { readFileSync } from 'node:fs';

// Minimal .env loader (no dependency).
try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    for (const line of env.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
} catch { /* no .env, rely on shell env */ }

const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim();
const base = process.argv[2]?.replace(/\/$/, '');

if (!token) {
    console.error('❌ TELEGRAM_BOT_TOKEN is required (set it in .env or the shell).');
    process.exit(1);
}
if (!base) {
    console.error('❌ Provide your public base URL, e.g. node scripts/setup-telegram-webhook.mjs https://your-app.vercel.app');
    process.exit(1);
}

const url = `${base}/api/telegram/webhook`;

const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        url,
        allowed_updates: ['message'],
        ...(secret ? { secret_token: secret } : {}),
    }),
});

const json = await res.json();
if (json.ok) {
    console.log(`✅ Webhook set to ${url}`);
    if (!secret) console.warn('⚠️  No TELEGRAM_WEBHOOK_SECRET set — anyone who knows the URL could POST to it. Add one for security.');
} else {
    console.error('❌ setWebhook failed:', json.description || json);
    process.exit(1);
}

// Show the bot's identity for sanity.
const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
if (me.ok) console.log(`🤖 Bot: @${me.result.username} (${me.result.first_name})`);
