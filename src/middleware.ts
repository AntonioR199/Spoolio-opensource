import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Rinfresca la sessione Supabase e protegge tutte le rotte: senza login si viene
// reindirizzati a /login (eccetto /login, /auth/* e /privacy).
export async function middleware(request: NextRequest) {
  const { response, user, currentLevel, nextLevel } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/privacy");

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  // 2FA: utente con un fattore TOTP verificato ma sessione ancora ad aal1 →
  // deve passare dalla pagina di verifica prima di entrare nell'app.
  // /auth/mfa, /auth/signout e /auth/callback restano raggiungibili da aal1.
  const needsMfa = !!user && nextLevel === "aal2" && currentLevel !== "aal2";
  const mfaExempt =
    pathname.startsWith("/auth/mfa") ||
    pathname.startsWith("/auth/signout") ||
    pathname.startsWith("/auth/callback");
  if (needsMfa && !mfaExempt) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/mfa";
    url.search = "";
    if (pathname !== "/" && !pathname.startsWith("/login")) {
      url.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(url);
  }

  // Se già loggato (e con MFA a posto) e vai su /login, torna alla dashboard.
  if (user && !needsMfa && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: [
    // tutto tranne asset statici e immagini
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
