"use client";

import { useState, useTransition } from "react";
import { Mail, Loader2 } from "lucide-react";
import { setDigestPreference } from "@/lib/actions/preference.actions";
import InfoTooltip from "@/components/InfoTooltip";

export default function DigestToggle({
    userId,
    email,
    name,
    initial,
}: {
    userId: string;
    email: string;
    name: string;
    initial: boolean;
}) {
    const [on, setOn] = useState(initial);
    const [isPending, startTransition] = useTransition();

    const toggle = () => {
        const next = !on;
        setOn(next);
        startTransition(async () => {
            const res = await setDigestPreference(userId, email, name, next);
            if (!res.success) setOn(!next); // revert on failure
        });
    };

    return (
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-100">
                        <Mail className="h-4 w-4 text-teal-400" /> Daily Brief
                        <InfoTooltip text="A weekday-morning email with the market regime, Fear & Greed, your watchlist's overnight moves, top headlines and an AI summary." />
                        {isPending && <Loader2 className="h-3 w-3 animate-spin text-gray-500" />}
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">Morning market digest, emailed to {email}.</p>
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    onClick={toggle}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-teal-500" : "bg-gray-600"}`}
                >
                    <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${on ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
            </div>
        </div>
    );
}
