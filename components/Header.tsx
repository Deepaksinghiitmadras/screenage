import Link from "next/link";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import ThemeToggle from "@/components/ThemeToggle";
import SearchCommand from "@/components/SearchCommand";
import {searchStocks} from "@/lib/actions/finnhub.actions";

const Header = async ({ user }: { user: User }) => {
    const initialStocks = await searchStocks();

    return (
        <header className="sticky top-0 header">
            <div className="container header-wrapper">
                {/* Brand + primary navigation */}
                <div className="flex min-w-0 items-center gap-6">
                    <Link
                        href="/"
                        aria-label="Screenage — go to dashboard"
                        className="flex shrink-0 items-center gap-2 cursor-pointer rounded-lg transition-opacity hover:opacity-80"
                    >
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-teal-400/20 to-teal-500/5 ring-1 ring-teal-500/30">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <path d="M3 17 L9 11 L13 14 L21 5" stroke="#0FEDBE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                <path d="M15 5 H21 V11" stroke="#0FEDBE" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                        <span className="text-xl font-bold tracking-tight whitespace-nowrap">
                            <span className="text-gray-100">Screen</span>
                            <span className="text-teal-400">age</span>
                        </span>
                    </Link>

                    <nav className="hidden lg:block min-w-0">
                        <NavItems initialStocks={initialStocks} showSearch={false} />
                    </nav>
                </div>

                {/* Search + utilities */}
                <div className="flex shrink-0 items-center gap-3">
                    <div className="hidden lg:block [&_.search-box]:w-44 xl:[&_.search-box]:w-72">
                        <SearchCommand renderAs="box" label="Search stocks..." initialStocks={initialStocks} />
                    </div>
                    <ThemeToggle />
                    <UserDropdown user={user} initialStocks={initialStocks} />
                </div>
            </div>
        </header>
    )
}
export default Header