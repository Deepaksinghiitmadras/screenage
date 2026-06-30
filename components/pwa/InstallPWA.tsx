"use client";

/**
 * PWA glue — registers the service worker and shows an "Install app" prompt.
 * Handles Chromium (beforeinstallprompt) and iOS Safari (manual A2HS hint).
 * Dismissals persist in localStorage. Hidden once the app runs standalone.
 */

import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import InfoTooltip from "@/components/InfoTooltip";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "screenage-pwa-dismissed";

export default function InstallPWA() {
    const [deferred, setDeferred] = useState<BIPEvent | null>(null);
    const [showIos, setShowIos] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        // Register the service worker.
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW register failed", e));
        }

        const dismissed = typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "1";
        const standalone =
            window.matchMedia?.("(display-mode: standalone)").matches ||
            // @ts-expect-error iOS Safari
            window.navigator.standalone === true;
        if (dismissed || standalone) return;

        const onPrompt = (e: Event) => {
            e.preventDefault();
            setDeferred(e as BIPEvent);
            setVisible(true);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);

        // iOS Safari never fires beforeinstallprompt — show a manual hint.
        const ua = window.navigator.userAgent;
        const isIos = /iphone|ipad|ipod/i.test(ua);
        const isSafari = /safari/i.test(ua) && !/crios|fxios|chrome/i.test(ua);
        if (isIos && isSafari) {
            setShowIos(true);
            setVisible(true);
        }

        return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    }, []);

    const dismiss = () => {
        setVisible(false);
        localStorage.setItem(DISMISS_KEY, "1");
    };

    const install = async () => {
        if (!deferred) return;
        await deferred.prompt();
        await deferred.userChoice;
        setVisible(false);
        setDeferred(null);
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-x-0 bottom-0 z-[100] flex justify-center p-3">
            <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-gray-700 bg-gray-900/95 px-4 py-3 shadow-2xl backdrop-blur">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-400/15 text-teal-300">
                    <Download className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 text-sm font-semibold text-gray-100">
                        Install Screenage
                        <InfoTooltip text="Installs the app to your home screen for a full-screen, faster experience that also opens previously-viewed pages offline." />
                    </div>
                    {showIos ? (
                        <p className="text-xs text-gray-400">
                            Tap <Share className="inline h-3.5 w-3.5 align-text-bottom" /> Share, then “Add to Home Screen”.
                        </p>
                    ) : (
                        <p className="text-xs text-gray-400">Add to your home screen for quick, app-like access.</p>
                    )}
                </div>
                {!showIos && (
                    <button onClick={install} className="shrink-0 rounded-lg bg-teal-500/90 px-3 py-1.5 text-sm font-medium text-gray-900 hover:bg-teal-400">
                        Install
                    </button>
                )}
                <button onClick={dismiss} className="shrink-0 rounded p-1 text-gray-500 hover:text-gray-300" aria-label="Dismiss">
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
