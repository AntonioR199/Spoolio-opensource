"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import {
  LayoutDashboard,
  Boxes,
  Plus,
  FileUp,
  FileText,
  Printer,
  Droplet,
  Settings,
  Menu,
  PackageX,
  Store,
  LogOut,
  Coffee,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";

type Item = {
  href?: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  soon?: boolean;
};

const NAV: Array<{ section: string; items: Item[] }> = [
  {
    section: "Magazzino",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inventario", label: "Inventario", icon: Boxes },
      { href: "/esauriti", label: "Esauriti", icon: PackageX },
    ],
  },
  {
    section: "Gestione",
    items: [
      { href: "/add", label: "Aggiungi a mano", icon: Plus },
      { href: "/upload", label: "Carica fattura", icon: FileUp },
      { href: "/fatture", label: "Fatture", icon: FileText },
      { href: "/stampanti", label: "Le mie stampanti", icon: Printer },
      { href: "/marchi", label: "Marchi e store", icon: Store },
      { href: "/impostazioni", label: "Impostazioni", icon: Settings },
    ],
  },
  {
    section: "Presto disponibile",
    items: [{ label: "Asciugatura", icon: Droplet, soon: true }],
  },
];

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2 py-1">
      <Logo className="h-9 w-9 shadow-sm" />
      <span className="flex flex-col leading-tight">
        <Image
          src="/spoolio-logo-scritta.png"
          alt="Spoolio"
          width={80}
          height={20}
          className="h-5 w-auto object-contain"
        />
        <span className="text-[11px] text-muted-foreground">Il tuo magazzino 3D</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-5 px-3 py-4">
      {NAV.map((group) => (
        <div key={group.section}>
          <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {group.section}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((it) => {
              const Icon = it.icon;
              if (it.soon) {
                return (
                  <div
                    key={it.label}
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-muted-foreground/60"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{it.label}</span>
                    <Badge variant="secondary" className="ml-auto text-[9px] uppercase">
                      soon
                    </Badge>
                  </div>
                );
              }
              const active = pathname === it.href;
              return (
                <Button
                  key={it.label}
                  variant={active ? "secondary" : "ghost"}
                  size="lg"
                  nativeButton={false}
                  className="w-full justify-start gap-3"
                  render={<Link href={it.href!} onClick={onNavigate} />}
                >
                  <Icon className="h-4 w-4" />
                  {it.label}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

function AccountBox() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => setEmail(data.user?.email ?? null))
      .catch(() => {});
  }, []);
  return (
    <div className="mt-auto border-t p-3">
      <div className="mb-2 truncate text-xs text-muted-foreground" title={email ?? ""}>
        {email ?? "—"}
      </div>
      <form action="/auth/signout" method="post">
        <Button type="submit" variant="outline" size="sm" className="w-full justify-start gap-2">
          <LogOut className="h-4 w-4" /> Esci
        </Button>
      </form>
    </div>
  );
}

function Footer() {
  return (
    <div className="border-t p-3">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        className="mb-3 w-full justify-start gap-2"
        render={
          <a href="https://ko-fi.com/domoticlab" target="_blank" rel="noopener noreferrer" />
        }
      >
        <Coffee className="h-4 w-4" /> Offrimi un caffè
      </Button>
      <a
        href="https://www.domotic-lab.it/"
        target="_blank"
        rel="noopener noreferrer"
        className="block opacity-80 transition-opacity hover:opacity-100"
        title="Un progetto DomoticLab"
      >
        <Image
          src="/domoticlab-logo-on-light.png"
          alt="DomoticLab"
          width={140}
          height={45}
          className="h-7 w-auto dark:hidden"
        />
        <Image
          src="/domoticlab-logo-on-dark.png"
          alt="DomoticLab"
          width={140}
          height={45}
          className="hidden h-7 w-auto dark:block"
        />
      </a>
      <p className="mt-2 text-[10px] leading-tight text-muted-foreground">
        © 2026 DomoticLab · Tutti i diritti riservati
      </p>
    </div>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);
  return (
    <>
      {/* Top bar mobile */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/80 px-3 backdrop-blur md:hidden">
        <Brand />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Apri menu" />}>
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-72 bg-sidebar p-0 text-sidebar-foreground">
            <SheetTitle className="sr-only">Menu</SheetTitle>
            <div className="flex h-14 items-center border-b px-3">
              <Brand />
            </div>
            <div className="flex h-[calc(100%-3.5rem)] flex-col">
              <NavLinks onNavigate={() => setOpen(false)} />
              <AccountBox />
              <Footer />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Sidebar desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-14 items-center border-b px-3">
          <Brand />
        </div>
        <NavLinks />
        <AccountBox />
        <Footer />
      </aside>
    </>
  );
}
