import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/lib/better-auth/auth";
import { listScreenerHistory } from "@/lib/actions/screener.actions";
import { listConversations } from "@/lib/actions/assistant.actions";
import { getScanSectors } from "@/lib/actions/technical.actions";
import ScreenerWorkspace from "@/components/screener/ScreenerWorkspace";

export default async function ScreenerPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    const userId = session?.user?.id;
    if (!userId) redirect("/sign-in");

    const [history, conversations, sectors] = await Promise.all([
        listScreenerHistory(userId),
        listConversations(userId),
        getScanSectors(),
    ]);

    return (
        <ScreenerWorkspace
            userId={userId}
            sectors={sectors}
            initialHistory={history}
            initialConversations={conversations.map((c) => ({
                _id: c._id,
                title: c.title,
                updatedAt: c.updatedAt,
            }))}
        />
    );
}
