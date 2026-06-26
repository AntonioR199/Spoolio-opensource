import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Spoolio — Il tuo magazzino filamenti 3D",
  description: "Spoolio: inventario filamenti per stampa 3D — colori, quantità, tipologia e costi.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="it" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script
          // Applica il tema salvato prima del paint per evitare il flash.
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('fs-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        <Toaster />
      </body>
    </html>
  );
}
