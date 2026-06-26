# Security Policy — Spoolio

## Segnalazione di vulnerabilità

Se trovi una vulnerabilità di sicurezza in Spoolio, **non aprire una issue pubblica**.
Segnalala in privato a **DomoticLab** via email: **info@domotic-lab.it**
(oggetto: `Spoolio security`).

Includi, se possibile:

- una descrizione del problema e dell'impatto,
- i passi per riprodurlo (PoC),
- la versione/commit interessati.

Cercheremo di rispondere entro qualche giorno e di concordare una divulgazione
responsabile dopo il rilascio della correzione.

## Modello di sicurezza (sintesi)

Spoolio è pensato come app **multi-utente cloud** su Supabase:

- **Autenticazione**: Supabase Auth (email+password, magic link, Google) + 2FA TOTP
  opzionale. Il middleware (`src/middleware.ts`) protegge tutte le rotte tranne
  `/login` e `/auth/*`, e impone l'AAL2 quando l'utente ha un fattore TOTP attivo.
- **Isolamento dati**: ogni tabella ha `user_id = auth.uid()` e una **policy RLS**
  (vedi `db/schema.sql`). Il bucket Storage `invoices` è privato e con policy per
  cartella utente (`<uid>/...`). L'app usa **solo** la `anon key` + i cookie di
  sessione: la `service_role key` (che bypassa la RLS) **non è usata**.
- **Input non fidato**: il testo estratto dai PDF e i contenuti forniti dall'utente
  sono trattati come **dati, mai come istruzioni** (vedi i prompt in
  `src/lib/parseInvoice.ts` e `src/lib/chat.ts`). Gli upload hanno limiti di
  dimensione e verifica della firma del file.
- **Header HTTP**: CSP, HSTS, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy`, `Permissions-Policy` impostati in `next.config.ts`.

## Note e limiti noti (per chi fa self-host)

- **Chiave API AI a riposo**: la chiave del provider AI configurata
  dall'utente è salvata **in chiaro** nella tabella `setting` (protetta da RLS,
  ma non cifrata). Accettabile per self-host/single-user; se esponi Spoolio come
  servizio multi-tenant, valuta la cifratura della chiave o l'uso esclusivo di
  `ANTHROPIC_API_KEY` lato server.
- **Provider AI con base URL personalizzato**: l'opzione "custom" permette
  all'utente autenticato di far chiamare al server un URL arbitrario (potenziale
  SSRF auto-inflitto). Rischio basso perché richiede login ed è per-utente; se
  apri a molti utenti non fidati, considera una allowlist di domini.
- **Rate limiting**: le chiamate all'LLM (`/api/chat`, fallback fatture) non sono
  limitate a livello applicativo. In self-host pubblico, metti un limite a monte
  (reverse proxy / WAF) per contenere i costi.
- **Segreti**: non committare mai `.env.local`. Tutti i `.env*` sono gitignorati
  (eccetto `.env.example`).
