"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import ChatWidget from "@/components/ChatWidget";

// Mostra la sidebar+layout app ovunque, tranne nelle pagine di autenticazione e
// nell'informativa privacy (pagine pubbliche, autoconsistenti).
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isStandalone =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/privacy");

  if (isStandalone) return <>{children}</>;

  return (
    <div className="md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
      <ChatWidget />
    </div>
  );
}
