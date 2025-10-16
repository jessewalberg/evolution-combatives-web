import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "../src/providers/QueryProvider";
import { ThemeProvider } from "../src/providers/ThemeProvider";
import { Toaster } from "sonner";

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
        <html lang="en" suppressHydrationWarning>
            <body className={`${inter.variable} font-sans`} suppressHydrationWarning>
                <ThemeProvider defaultTheme="dark">
                    <QueryProvider>
                        {children}
                        <Toaster
                            position="top-right"
                            expand={true}
                            richColors
                            closeButton
                            theme="system"
                        />
                    </QueryProvider>
                </ThemeProvider>
            </body>
        </html>
    );
} 