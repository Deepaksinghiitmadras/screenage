import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import {Toaster} from "@/components/ui/sonner";
import ThemeProvider from "@/components/ThemeProvider";
import InstallPWA from "@/components/pwa/InstallPWA";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Screenage",
  description: "Screenage is a stock market platform. Track real-time prices, set personalized alerts, and explore detailed company insights.",
  applicationName: "Screenage",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Screenage" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0f14",
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased`}
                suppressHydrationWarning
            >
                <ThemeProvider>
                    {children}
                    <Toaster/>
                    <InstallPWA />
                </ThemeProvider>
            </body>
        </html>
    );
}
