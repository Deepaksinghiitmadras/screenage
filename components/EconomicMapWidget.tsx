'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';

const SCRIPT_SRC = 'https://widgets.tradingview-widget.com/w/en/tv-economic-map.js';

/**
 * TradingView "Economic Map" widget. Unlike the legacy embed widgets, this one
 * ships as a Web Component (<tv-economic-map>), so we instantiate the custom
 * element directly and load its module script once.
 */
export default function EconomicMapWidget({
    title = 'Economic Map',
    height = 600,
    className = '',
}: {
    title?: string;
    height?: number;
    className?: string;
}) {
    const hostRef = useRef<HTMLDivElement | null>(null);
    const [mounted, setMounted] = useState(false);
    const { resolvedTheme } = useTheme();

    useEffect(() => setMounted(true), []);
    const isLight = mounted && resolvedTheme === 'light';

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        host.innerHTML = '';
        const el = document.createElement('tv-economic-map');
        el.setAttribute('color-theme', isLight ? 'light' : 'dark');
        el.setAttribute('is-transparent', 'true');
        el.setAttribute('locale', 'en');
        el.setAttribute('width', '100%');
        el.setAttribute('height', String(height));
        host.appendChild(el);

        // The module script defines the custom element. It only needs to run once,
        // but re-appending after the first load is a harmless no-op.
        const script = document.createElement('script');
        script.type = 'module';
        script.src = SCRIPT_SRC;
        host.appendChild(script);

        return () => {
            host.innerHTML = '';
        };
    }, [isLight, height]);

    return (
        <div className={className}>
            {title && (
                <h2 className="mb-3 text-xl font-semibold text-gray-100">{title}</h2>
            )}
            <div ref={hostRef} className="w-full overflow-hidden rounded-lg" style={{ height }} />
        </div>
    );
}
