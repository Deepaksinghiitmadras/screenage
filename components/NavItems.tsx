'use client'


import React from 'react'
import {NAV_ITEMS} from "@/lib/constants";
import Link from "next/link";
import {usePathname} from "next/navigation";
import SearchCommand from "@/components/SearchCommand";

const NavItems = ({initialStocks, showSearch = true}: { initialStocks: StockWithWatchlistStatus[]; showSearch?: boolean }) => {
    const pathname = usePathname()

    const isActive = (path: string) => {
        if (path ==='/') return pathname === '/'

        return  pathname.startsWith(path);
    }

    return (
        <ul className="flex flex-col sm:flex-row sm:items-center p-2 gap-3 sm:gap-4 xl:gap-6 text-sm font-medium">
            {NAV_ITEMS.map(({href, label}) => {
                if (href === '/search') {
                    if (!showSearch) return null;
                    return (
                        <li key="search-trigger" className="flex items-center">
                            <SearchCommand
                                renderAs="box"
                                label="Search stocks..."
                                initialStocks={initialStocks}
                            />
                        </li>
                    )
                }
                return <li key={href}>
                    <Link href={href} className={`whitespace-nowrap hover:text-teal-500 transition-colors ${isActive(href) ? 'text-gray-100' : ''}`}>
                        {label}
                    </Link>
                </li>
            })}
        </ul>
    )
}
export default NavItems
