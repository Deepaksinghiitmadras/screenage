import Link from "next/link";
import React from "react";
import {headers} from "next/headers";
import {redirect} from "next/navigation";
import {auth} from "@/lib/better-auth/auth";

const Layout = async ({ children }: { children : React.ReactNode }) => {

    const session = await auth.api.getSession({headers: await headers()});

    if (session?.user) redirect('/')
    return (
        <main className="auth-layout">
            <section className="auth-left-section scrollbar-hide-default">
                <Link href="/" className="auth-logo flex items-center gap-2">
                    <span className="text-3xl font-bold text-white">Screenage</span>
                </Link>

                <div className="pb-6 lg:pb-8 flex-1">
                    {children}
                </div>
            </section>
        </main>
    )
}
export default Layout
