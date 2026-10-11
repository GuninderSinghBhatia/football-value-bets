import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter } from "next/font/google";
import { BottomTabs, IconRail } from "@/components/shell/nav";
import { FavouritesProvider } from "@/components/shell/favourites";
import { TopBar } from "@/components/shell/top-bar";
import { PicksProvider } from "@/components/tracker/picks-context";
import { ToastProvider } from "@/components/ui/toast";
import { getLeagues, getTeams } from "@/lib/api";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BetMind",
  description: "Upcoming matches, bookmaker odds and model predictions to spot value bets. No real-money betting.",
};

// Mock dates are relative to today, so render on each request.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [leagues, teams] = await Promise.all([getLeagues(), getTeams()]);

  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`}>
        <ToastProvider>
        <PicksProvider>
        <FavouritesProvider leagues={leagues} teams={teams}>
          <div className="flex min-h-dvh">
            <Suspense>
              <IconRail />
            </Suspense>
            <div className="min-w-0 flex-1 pb-20 md:pb-0">
              <Suspense>
                <TopBar />
              </Suspense>
              <main className="px-4 py-5 lg:px-6">{children}</main>
            </div>
          </div>
          <Suspense>
            <BottomTabs />
          </Suspense>
        </FavouritesProvider>
        </PicksProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
