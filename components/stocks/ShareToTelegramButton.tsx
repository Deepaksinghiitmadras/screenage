"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shareStockToTelegram } from "@/lib/actions/telegram.actions";

export default function ShareToTelegramButton({ symbol }: { symbol: string }) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    const share = () => {
        startTransition(async () => {
            const res = await shareStockToTelegram(symbol);
            if (res.success) {
                toast.success(`${symbol.toUpperCase()} snapshot sent to Telegram`);
            } else if (res.notLinked) {
                toast.error("Telegram not connected", {
                    description: "Connect Telegram on your Watchlist page to use this.",
                    action: { label: "Connect", onClick: () => router.push("/watchlist") },
                });
            } else {
                toast.error(res.error || "Could not send to Telegram");
            }
        });
    };

    return (
        <button
            type="button"
            onClick={share}
            disabled={isPending}
            title="Send a snapshot of this stock to your Telegram"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
        >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            <span className="hidden sm:inline">Send to Telegram</span>
        </button>
    );
}
