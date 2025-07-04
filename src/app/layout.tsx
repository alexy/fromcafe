import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from '@/components/SessionProvider'
import { initializeServer } from '@/lib/init'

// Initialize server-side services
initializeServer()

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Evernote Blog",
  description: "Create beautiful blogs from your Evernote notes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
