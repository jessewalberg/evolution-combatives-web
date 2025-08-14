import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "../src/providers/QueryProvider";

const inter = Inter({
    subsets: ["latin"],
    variable: "--font-inter",
});

export const metadata: Metadata = {
    title: "Evolution Combatives Admin",
    description: "Admin dashboard for the Evolution Combatives tactical training platform.",
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className={`${inter.variable} font-sans`}>
                <QueryProvider>
                    {children}
                </QueryProvider>
            </body>
        </html>
    );
} 