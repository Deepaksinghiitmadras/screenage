import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getPortfolio } from '@/lib/actions/portfolio.actions';
import PortfolioManager from '@/components/portfolio/PortfolioManager';

export const dynamic = 'force-dynamic';

export default async function PortfolioPage() {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session) redirect('/sign-in');

    const data = await getPortfolio(session.user.id);

    return <PortfolioManager userId={session.user.id} data={data} />;
}
