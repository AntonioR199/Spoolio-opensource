// Helper per il refresh della sessione Supabase nel middleware Next.
// NB: NON ancora attivo. Quando colleghiamo Supabase, creeremo
// `src/middleware.ts` che chiama updateSession() e protegge le rotte.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Livello di garanzia (MFA): se l'utente ha un fattore TOTP verificato ma la
  // sessione è ancora ad aal1, currentLevel='aal1' e nextLevel='aal2'.
  let currentLevel: string | null = null;
  let nextLevel: string | null = null;
  if (user) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    currentLevel = aal?.currentLevel ?? null;
    nextLevel = aal?.nextLevel ?? null;
  }

  return { response, user, currentLevel, nextLevel };
}
