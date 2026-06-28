import Link from "next/link";
import NavItems from "@/components/NavItems";
import UserDropdown from "@/components/UserDropdown";
import ThemeToggle from "@/components/ThemeToggle";
import {searchStocks} from "@/lib/actions/finnhub.actions";

const Header = async ({ user }: { user: User }) => {
    const initialStocks = await searchStocks();

    return (
        <header className="sticky top-0 header">
            <div className="container header-wrapper">
                <Link href="/" className="flex items-center justify-center gap-2">
                    <span className="text-2xl font-bold text-gray-100">Screenage</span>
                </Link>
                <nav className="hidden sm:block">
                    <NavItems initialStocks={initialStocks}/>
                </nav>

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <UserDropdown user={user} initialStocks={initialStocks} />
                </div>
            </div>
        </header>
    )
}
export default Header