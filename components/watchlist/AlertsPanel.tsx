"use client";

import React from "react";
import { Trash2, TrendingUp, Bell } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { deleteAlert } from "@/lib/actions/alert.actions";

interface AlertsPanelProps {
    alerts: any[];
    onRefresh?: () => void;
}

export default function AlertsPanel({ alerts, onRefresh }: AlertsPanelProps) {
    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this alert?")) {
            await deleteAlert(id);
            if (onRefresh) onRefresh();
        }
    };

    return (
        <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4">
            <div className="mb-4 flex items-center justify-between">
                <h2 className="flex items-center text-sm font-semibold uppercase tracking-wider text-gray-300">
                    <span className="mr-2 flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-400/10 text-yellow-400 ring-1 ring-yellow-400/20">
                        <Bell className="h-4 w-4" />
                    </span>
                    Price Alerts
                </h2>
                <span className="rounded-full bg-gray-700 px-2 py-0.5 text-xs text-gray-400">{alerts.length}</span>
            </div>

            <div className="space-y-3">
                {alerts.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/40 px-3 py-8 text-center">
                        <Bell className="mx-auto mb-2 h-6 w-6 text-gray-600" />
                        <p className="text-sm text-gray-500">No active alerts.</p>
                        <p className="mt-1 text-xs text-gray-600">Tap the bell on any watchlist row to set one.</p>
                    </div>
                ) : (
                    alerts.map((alert) => {
                        const isAbove = String(alert.condition).toLowerCase().includes("above");
                        const kind = alert.kind ?? "PRICE";
                        const subtitle =
                            kind === "PRICE" ? `Target ${formatCurrency(alert.targetPrice)}`
                            : kind === "PCT_CHANGE" ? `Daily move ${isAbove ? "+" : "-"}${alert.threshold}%`
                            : `RSI ${isAbove ? "above" : "below"} ${alert.threshold}`;
                        const badge =
                            kind === "PRICE" ? `Price ${String(alert.condition).toLowerCase()} ${formatCurrency(alert.targetPrice)}`
                            : kind === "PCT_CHANGE" ? `${isAbove ? "Gains" : "Falls"} more than ${alert.threshold}%`
                            : `RSI ${isAbove ? "crosses above" : "crosses below"} ${alert.threshold}`;
                        return (
                            <div key={alert._id} className="group relative rounded-xl border border-gray-700 bg-gray-900/40 p-3 transition-colors hover:border-gray-600">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-700 text-xs font-bold text-gray-100">
                                                {alert.symbol[0]}
                                            </div>
                                            <div>
                                                <div className="text-sm font-bold text-gray-100">{alert.symbol}</div>
                                                <div className="text-xs text-gray-500">{subtitle}</div>
                                            </div>
                                        </div>
                                        <div className={`mt-2 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ${isAbove ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
                                            <TrendingUp className={`h-3 w-3 ${isAbove ? "" : "rotate-180"}`} />
                                            {badge}
                                        </div>
                                        <div className="mt-1 text-[10px] text-gray-600">
                                            Active until {new Date(new Date(alert.createdAt).getTime() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(alert._id)}
                                        className="rounded p-1 text-gray-500 transition-colors hover:bg-red-500/10 hover:text-red-400"
                                        title="Delete alert"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
