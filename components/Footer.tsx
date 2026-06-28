import Link from "next/link";

const Footer = () => {
    return (
        <footer className="bg-gray-950 text-white border-t-2 border-teal-500/30 shadow-[0_-8px_24px_rgba(0,0,0,0.4)]">
            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Brand Section */}
                    <div className="col-span-1 md:col-span-2">
                        <Link href="/" className="flex items-center gap-2 mb-4">
                            <span className="text-2xl font-bold text-white">Screenage</span>
                        </Link>
                        <p className="text-gray-400 mb-6 max-w-md">
                            Screenage helps you track real-time prices, set personalized alerts, and explore detailed company insights — all in one place.
                        </p>
                    </div>

                    {/* Resources */}
                    <div>
                        <h3 className="text-lg font-semibold mb-4">Resources</h3>
                        <ul className="space-y-2">
                            <li>
                                <Link href="/help" className="text-gray-400 hover:text-white transition-colors duration-200 relative group">
                                    <span className="relative">
                                        Help Center
                                        <span className="absolute left-0 bottom-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full"></span>
                                    </span>
                                </Link>
                            </li>
                            <li>
                                <Link href="/terms" className="text-gray-400 hover:text-white transition-colors duration-200 relative group">
                                    <span className="relative">
                                        Terms of Service
                                        <span className="absolute left-0 bottom-0 w-0 h-0.5 bg-white transition-all duration-300 group-hover:w-full"></span>
                                    </span>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-800 mt-8 pt-8">
                    <div className="text-gray-400 text-sm">
                        © {new Date().getFullYear()} Screenage. All rights reserved.
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
