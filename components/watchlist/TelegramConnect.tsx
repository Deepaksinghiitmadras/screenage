"use client";

import { useState, useTransition } from "react";
import { Send, Loader2, Check, Link2, X, ExternalLink } from "lucide-react";
import InfoTooltip from "@/components/InfoTooltip";
import {
    generateTelegramLink,
    unlinkTelegram,
    setTelegramPref,
    sendTelegramTest,
    type TelegramStatus,
} from "@/lib/actions/telegram.actions";

function Toggle({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={on}
            disabled={disabled}
            onClick={onClick}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? "bg-teal-500" : "bg-gray-600"}`}
        >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
    );
}

export default function TelegramConnect({
    userId,
    email,
    name,
    status,
}: {
    userId: string;
    email: string;
    name: string;
    status: TelegramStatus;
}) {
    const [linked, setLinked] = useState(status.linked);
    const [username, setUsername] = useState(status.username ?? null);
    const [alerts, setAlerts] = useState(status.alerts);
    const [digest, setDigest] = useState(status.digest);
    const [linkUrl, setLinkUrl] = useState<string | null>(null);
    const [testState, setTestState] = useState<"idle" | "ok" | "err">("idle");
    const [isPending, startTransition] = useTransition();

    if (!status.configured) {
        return (
            <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-100">
                    <Send className="h-4 w-4 text-teal-400" /> Telegram alerts
                    <InfoTooltip text="Get price/RSI/%-change alerts and your daily brief pushed to Telegram. The server admin needs to configure a Telegram bot to enable this." />
                </div>
                <p className="mt-1 text-xs text-gray-500">Not available — no Telegram bot is configured on this server.</p>
            </div>
        );
    }

    const connect = () => {
        setLinkUrl(null);
        startTransition(async () => {
            const res = await generateTelegramLink(userId, email, name);
            if (res.success && res.url) {
                setLinkUrl(res.url);
                window.open(res.url, "_blank", "noopener,noreferrer");
            }
        });
    };

    const disconnect = () => {
        startTransition(async () => {
            const res = await unlinkTelegram(userId);
            if (res.success) {
                setLinked(false);
                setUsername(null);
                setLinkUrl(null);
            }
        });
    };

    const toggle = (key: "telegramAlerts" | "telegramDigest", val: boolean, setter: (v: boolean) => void) => {
        setter(val);
        startTransition(async () => {
            const res = await setTelegramPref(userId, key, val);
            if (!res.success) setter(!val);
        });
    };

    const test = () => {
        setTestState("idle");
        startTransition(async () => {
            const res = await sendTelegramTest(userId);
            setTestState(res.success ? "ok" : "err");
            setTimeout(() => setTestState("idle"), 3000);
        });
    };

    return (
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-100">
                    <Send className="h-4 w-4 text-teal-400" /> Telegram alerts
                    <InfoTooltip text="Connect Telegram to receive your stock alerts and daily brief as instant messages. Linking uses a one-time code — Screenage never sees your Telegram password." />
                    {isPending && <Loader2 className="h-3 w-3 animate-spin text-gray-500" />}
                </div>
                {linked && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-teal-400/10 px-2 py-0.5 text-xs text-teal-300 ring-1 ring-teal-400/20">
                        <Check className="h-3 w-3" /> Connected
                    </span>
                )}
            </div>

            {!linked ? (
                <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500">
                        Push alerts and your daily brief to Telegram. Tap connect, then press <b>Start</b> in the chat that opens.
                    </p>
                    <button
                        type="button"
                        onClick={connect}
                        disabled={isPending}
                        className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-3 py-2 text-sm font-medium text-black transition-colors hover:bg-teal-400 disabled:opacity-50"
                    >
                        <Link2 className="h-4 w-4" /> Connect Telegram
                    </button>
                    {linkUrl && (
                        <p className="text-xs text-gray-500">
                            Didn&apos;t open?{" "}
                            <a href={linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-teal-400 hover:underline">
                                Open the bot <ExternalLink className="h-3 w-3" />
                            </a>{" "}
                            (link valid 15 min).
                        </p>
                    )}
                </div>
            ) : (
                <div className="mt-3 space-y-3">
                    <p className="text-xs text-gray-500">
                        Linked{username ? <> as <span className="text-gray-300">@{username}</span></> : null}. Choose what to receive:
                    </p>

                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm text-gray-200">
                            Price &amp; technical alerts
                            <InfoTooltip text="Your triggered watchlist alerts (price crossings, % moves, RSI levels) are pushed here the moment they fire." />
                        </span>
                        <Toggle on={alerts} disabled={isPending} onClick={() => toggle("telegramAlerts", !alerts, setAlerts)} />
                    </div>

                    <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-sm text-gray-200">
                            Daily brief
                            <InfoTooltip text="A weekday-morning summary — market regime, Fear & Greed, your watchlist moves and top headlines — delivered to Telegram." />
                        </span>
                        <Toggle on={digest} disabled={isPending} onClick={() => toggle("telegramDigest", !digest, setDigest)} />
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={test}
                            disabled={isPending}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-600 px-3 py-1.5 text-xs text-gray-200 transition-colors hover:border-teal-500 disabled:opacity-50"
                        >
                            <Send className="h-3 w-3" /> Send test
                        </button>
                        {testState === "ok" && <span className="text-xs text-teal-400">Sent ✓</span>}
                        {testState === "err" && <span className="text-xs text-red-400">Failed</span>}
                        <button
                            type="button"
                            onClick={disconnect}
                            disabled={isPending}
                            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-gray-700 px-3 py-1.5 text-xs text-gray-400 transition-colors hover:border-red-500 hover:text-red-300 disabled:opacity-50"
                        >
                            <X className="h-3 w-3" /> Disconnect
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
