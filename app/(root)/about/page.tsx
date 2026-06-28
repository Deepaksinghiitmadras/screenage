
import React from 'react';
import {
    Globe,
    Heart,
    Code
} from 'lucide-react';

export const metadata = {
    title: 'About Us | Screenage',
    description: 'The story behind Screenage.',
};

export default function AboutPage() {
    return (
        <div className="max-w-5xl mx-auto pb-20 px-4">
            {/* Hero Section */}
            <section className="text-center space-y-8 pt-16 mb-20">
                <div className="flex justify-center mb-6">
                    <div className="p-4 rounded-2xl border border-teal-500/20 backdrop-blur-sm">
                        <span className="text-3xl font-bold text-white">Screenage</span>
                    </div>
                </div>

                <h1 className="text-5xl md:text-7xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white via-gray-200 to-gray-500 tracking-tight">
                    Tools for Everyone.
                </h1>
                <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto leading-relaxed font-light">
                    We believe financial intelligence shouldn't be locked behind paywalls.
                    Screenage is built for investors who want clarity and control.
                </p>
            </section>

            {/* Mission Grid */}
            <section className="grid md:grid-cols-3 gap-6 mb-24">
                <FeatureCard
                    icon={<Globe className="text-blue-400" />}
                    title="Open Access"
                    desc="No premium tiers for core features. Real-time data and insights available to all, forever."
                    color="blue"
                />
                <FeatureCard
                    icon={<Code className="text-purple-400" />}
                    title="Open Source"
                    desc="Fully transparent codebase. Audit our algorithms, contribute features, and build with us."
                    color="purple"
                />
                <FeatureCard
                    icon={<Heart className="text-red-400" />}
                    title="Community Driven"
                    desc="Powered by donations and volunteers. We answer to our users, not shareholders."
                    color="red"
                />
            </section>

            {/* Story Section */}
            <section className="grid md:grid-cols-2 gap-12 items-center mb-24 bg-gray-900/30 p-8 md:p-12 rounded-3xl border border-gray-800">
                <div className="space-y-6">
                    <h2 className="text-3xl font-bold text-white">The Team Behind Screenage</h2>
                    <p className="text-gray-400 leading-relaxed text-lg">
                        Screenage was born from a simple frustration: why are powerful financial tools so expensive?
                    </p>
                    <p className="text-gray-400 leading-relaxed text-lg">
                        We are a team of developers, designers, and financial enthusiasts on a mission to make high-quality market tools accessible to everyone.
                    </p>
                </div>
                <div className="relative h-[400px] w-full bg-gradient-to-br from-gray-800 to-black rounded-2xl overflow-hidden border border-gray-700 shadow-2xl flex items-center justify-center">
                    <span className="text-5xl font-bold text-white">Screenage</span>
                </div>
            </section>

        </div>
    );
}

function FeatureCard({ icon, title, desc, color }: any) {
    const borders: any = {
        blue: 'hover:border-blue-500/50',
        purple: 'hover:border-purple-500/50',
        red: 'hover:border-red-500/50',
    };

    return (
        <div className={`bg-gray-900/50 border border-gray-800 p-8 rounded-2xl transition-all duration-300 hover:-translate-y-1 ${borders[color]}`}>
            <div className="mb-6 p-3 bg-gray-800 w-fit rounded-xl">{icon}</div>
            <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
            <p className="text-gray-400 leading-relaxed font-light">{desc}</p>
        </div>
    );
}

function SocialButton({ href, icon, label }: any) {
    return (
        <a
            href={href}
            target="_blank"
            className="flex items-center gap-3 px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-all duration-200 border border-gray-700 hover:border-gray-600 font-medium"
        >
            {icon}
            <span>{label}</span>
        </a>
    );
}
