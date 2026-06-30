'use server';

/**
 * Portfolio tracker actions — holdings CRUD plus a live, enriched portfolio
 * view (valuation, P&L, sector/stock allocation, diversification score and
 * automatic red flags). Delayed quotes; research/education only, not advice.
 */

import { connectToDatabase } from '@/database/mongoose';
import { Holding } from '@/database/models/holding.model';
import { getQuotes } from '@/lib/actions/market.actions';
import { getPeerGroup } from '@/lib/sector-peers';
import { revalidatePath } from 'next/cache';

function round(v: number, d = 2): number {
    const f = 10 ** d;
    return Math.round(v * f) / f;
}

// -- CRUD ---------------------------------------------------------------------

export async function addHolding(userId: string, input: PortfolioHoldingInput) {
    try {
        await connectToDatabase();
        const symbol = input.symbol.trim().toUpperCase();
        if (!symbol || input.quantity <= 0 || input.avgPrice <= 0) {
            return { success: false, error: 'Quantity and average price must be greater than zero.' };
        }
        await Holding.findOneAndUpdate(
            { userId, symbol },
            {
                userId,
                symbol,
                company: input.company?.trim() || symbol,
                quantity: input.quantity,
                avgPrice: input.avgPrice,
                buyDate: input.buyDate ? new Date(input.buyDate) : undefined,
            },
            { upsert: true, new: true },
        );
        revalidatePath('/portfolio');
        return { success: true };
    } catch (error) {
        console.error('Error adding holding:', error);
        return { success: false, error: 'Failed to save holding.' };
    }
}

export async function removeHolding(userId: string, symbol: string) {
    try {
        await connectToDatabase();
        await Holding.findOneAndDelete({ userId, symbol: symbol.toUpperCase() });
        revalidatePath('/portfolio');
        return { success: true };
    } catch (error) {
        console.error('Error removing holding:', error);
        return { success: false, error: 'Failed to remove holding.' };
    }
}

// -- Enriched portfolio view --------------------------------------------------

export async function getPortfolio(userId: string): Promise<PortfolioResult> {
    const empty: PortfolioResult = {
        available: true,
        summary: {
            invested: 0, currentValue: 0, totalPnl: 0, totalPnlPct: 0,
            dayPnl: 0, dayPnlPct: 0, annualizedPct: null, diversificationScore: 0, holdings: 0,
        },
        holdings: [], bySector: [], byStock: [], redFlags: [],
    };

    try {
        await connectToDatabase();
        const docs = await Holding.find({ userId }).sort({ createdAt: 1 }).lean();
        if (docs.length === 0) return empty;

        const symbols = docs.map((d) => d.symbol);
        const quotes = await getQuotes(symbols);
        const quoteBy = new Map(quotes.map((q) => [q.requested.toUpperCase(), q]));

        let invested = 0;
        let currentValue = 0;
        let dayPnl = 0;
        let weightedYears = 0; // invested-weighted holding period for annualized est.
        let yearsWeight = 0;

        const holdings: PortfolioHolding[] = docs.map((d) => {
            const q = quoteBy.get(d.symbol.toUpperCase());
            const price = q?.available && q.price != null ? q.price : null;
            const changePct = q?.changePercent ?? null;
            const investedAmt = d.quantity * d.avgPrice;
            const curVal = price != null ? d.quantity * price : investedAmt;
            const pnl = curVal - investedAmt;
            const prevClose = q?.previousClose ?? (price != null && changePct != null ? price / (1 + changePct / 100) : null);
            const dayChange = price != null && prevClose != null ? d.quantity * (price - prevClose) : 0;

            invested += investedAmt;
            currentValue += curVal;
            dayPnl += dayChange;

            if (d.buyDate) {
                const years = Math.max((Date.now() - new Date(d.buyDate).getTime()) / (365.25 * 864e5), 0.01);
                weightedYears += years * investedAmt;
                yearsWeight += investedAmt;
            }

            return {
                symbol: d.symbol,
                company: d.company,
                sector: getPeerGroup(d.symbol)?.name ?? 'Other',
                quantity: d.quantity,
                avgPrice: round(d.avgPrice),
                buyDate: d.buyDate ? new Date(d.buyDate).toISOString().slice(0, 10) : null,
                price: price != null ? round(price) : null,
                changePercent: changePct != null ? round(changePct) : null,
                invested: round(investedAmt),
                currentValue: round(curVal),
                pnl: round(pnl),
                pnlPct: investedAmt > 0 ? round((pnl / investedAmt) * 100) : 0,
                dayPnl: round(dayChange),
                weightPct: 0, // filled after totals
                available: price != null,
            };
        });

        // Weights now that we know total current value.
        for (const h of holdings) {
            h.weightPct = currentValue > 0 ? round((h.currentValue / currentValue) * 100) : 0;
        }

        const totalPnl = currentValue - invested;
        const totalPnlPct = invested > 0 ? (totalPnl / invested) * 100 : 0;
        const prevValue = currentValue - dayPnl;
        const dayPnlPct = prevValue > 0 ? (dayPnl / prevValue) * 100 : 0;

        // Annualized (CAGR) estimate from invested-weighted holding period.
        let annualizedPct: number | null = null;
        if (yearsWeight > 0 && invested > 0 && currentValue > 0) {
            const avgYears = weightedYears / yearsWeight;
            if (avgYears >= 0.05) {
                annualizedPct = round((Math.pow(currentValue / invested, 1 / avgYears) - 1) * 100);
            }
        }

        // Allocation by stock + sector.
        const byStock: PortfolioAllocationSlice[] = holdings
            .map((h) => ({ label: h.symbol, value: h.currentValue, pct: h.weightPct }))
            .sort((a, b) => b.value - a.value);

        const sectorMap = new Map<string, number>();
        for (const h of holdings) sectorMap.set(h.sector, (sectorMap.get(h.sector) ?? 0) + h.currentValue);
        const bySector: PortfolioAllocationSlice[] = Array.from(sectorMap.entries())
            .map(([label, value]) => ({ label, value: round(value), pct: currentValue > 0 ? round((value / currentValue) * 100) : 0 }))
            .sort((a, b) => b.value - a.value);

        // Diversification score: spread across holdings (1 - HHI) + sector breadth.
        const hhi = holdings.reduce((acc, h) => acc + (h.weightPct / 100) ** 2, 0);
        const sectorCount = bySector.length;
        const diversificationScore = Math.max(
            0,
            Math.min(100, Math.round((1 - hhi) * 70 + (Math.min(sectorCount, 8) / 8) * 30)),
        );

        // Red flags.
        const redFlags: PortfolioRedFlag[] = [];
        const topStock = byStock[0];
        if (topStock && topStock.pct > 35) {
            redFlags.push({ severity: topStock.pct > 50 ? 'high' : 'medium', label: 'Concentration risk', detail: `${topStock.label} is ${topStock.pct}% of the portfolio.` });
        }
        const topSector = bySector[0];
        if (topSector && topSector.pct > 50) {
            redFlags.push({ severity: 'medium', label: 'Sector over-exposure', detail: `${topSector.label} makes up ${topSector.pct}% of holdings.` });
        }
        for (const h of holdings) {
            if (h.available && h.pnlPct <= -25) {
                redFlags.push({ severity: h.pnlPct <= -40 ? 'high' : 'medium', label: 'Deep drawdown', detail: `${h.symbol} is down ${h.pnlPct}% from your average price.` });
            }
        }
        if (holdings.length < 5) {
            redFlags.push({ severity: 'low', label: 'Low diversification', detail: `Only ${holdings.length} holding${holdings.length === 1 ? '' : 's'} — consider spreading risk.` });
        }
        if (holdings.some((h) => !h.available)) {
            redFlags.push({ severity: 'low', label: 'Stale prices', detail: 'Live prices for some holdings are temporarily unavailable.' });
        }

        return {
            available: true,
            summary: {
                invested: round(invested),
                currentValue: round(currentValue),
                totalPnl: round(totalPnl),
                totalPnlPct: round(totalPnlPct),
                dayPnl: round(dayPnl),
                dayPnlPct: round(dayPnlPct),
                annualizedPct,
                diversificationScore,
                holdings: holdings.length,
            },
            holdings,
            bySector,
            byStock,
            redFlags,
        };
    } catch (error) {
        console.error('Error building portfolio:', error);
        return { ...empty, error: 'Failed to load portfolio.' };
    }
}
