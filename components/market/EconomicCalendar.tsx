import { getEconomicCalendar } from "@/lib/actions/market.actions";
import EconomicCalendarClient from "@/components/market/EconomicCalendarClient";

export default async function EconomicCalendar({
    height = 520,
    title = "Economic Calendar",
}: {
    height?: number;
    title?: string;
}) {
    const events = await getEconomicCalendar(7);
    return <EconomicCalendarClient events={events} height={height} title={title} />;
}
