import { getScreenerUniverse } from "@/lib/actions/screener.actions";
import CollectionsWorkspace from "@/components/collections/CollectionsWorkspace";

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
    const universe = await getScreenerUniverse();
    return <CollectionsWorkspace universe={universe} />;
}
