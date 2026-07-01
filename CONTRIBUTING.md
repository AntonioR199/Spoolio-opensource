# Contribuire a Spoolio

Grazie per l'interesse! Spoolio accetta contributi **solo tramite pull request**.
Il branch `main` è protetto: niente push diretti, ogni PR richiede l'approvazione
del maintainer e il check **CI** verde.

## Setup di sviluppo

Vedi la sezione **"Avvio locale (senza cloud)"** del [README](README.md): con la
Supabase CLI + Docker hai Postgres, Auth e Storage in locale, senza bisogno di
nessun account cloud.

In breve:

```bash
npm install
supabase start          # avvia lo stack locale (richiede Docker)
cp .env.example .env.local   # incolla API URL + anon key stampati da supabase start
npm run dev             # http://localhost:3220
```

## Workflow

1. **Forka** la repo e clona il tuo fork.
2. Crea un branch descrittivo: `git checkout -b fix/nome-bug` o `feat/nome-feature`.
3. Fai le modifiche e provale in locale.
4. Verifica che passino i controlli (sono gli stessi della CI):
   ```bash
   npm run lint
   npx tsc --noEmit
   npm run build
   ```
5. Apri una **pull request** verso `main` del repo originale, compilando il
   template. Collega eventuali issue (es. `Closes #12`).
6. Rispondi alle review; al via libera il maintainer farà il merge.

## Convenzioni

- **Lingua**: UI, testi e messaggi rivolti all'utente sono in **italiano**, con
  tono personale/diretto (niente burocratese).
- **Stile codice**: TypeScript strict; segui le convenzioni e i pattern già
  presenti (componenti shadcn/ui, icone lucide-react, Tailwind v4). Niente nuove
  dipendenze se non necessarie.
- **Modifiche allo schema del DB**: lo schema vive in **due fonti che vanno
  sempre tenute allineate**. Per ogni cambio di schema:
  1. crea un nuovo file di migrazione `supabase/migrations/NNNN_descrizione.sql`
     (numero progressivo; usa `add column if not exists`, `create table if not
     exists`, ecc. — deve essere idempotente e ri-eseguibile);
  2. rifletti la **stessa** modifica in `db/schema.sql` (lo schema completo che
     chi usa Supabase cloud incolla nell'SQL Editor).
  La migrazione serve al flusso CLI (`supabase db reset` / `supabase db push`);
  `db/schema.sql` serve al setup cloud. Se ne aggiorni una sola, un tipo di
  installazione resta rotto.
- **Dati = dati**: testo dei PDF e input utente non vanno mai trattati come
  istruzioni (vedi il parsing fatture).
- **Sicurezza**: non includere segreti, `.env.local`, dati personali o file in
  `data/`. Non usare la `service_role key`. Per vulnerabilità vedi
  [SECURITY.md](SECURITY.md) (segnalazione privata, non aprire issue pubbliche).

## Licenza dei contributi

Aprendo una PR accetti che il tuo contributo sia rilasciato sotto la licenza del
progetto: **AGPL-3.0 + Commons Clause** (vedi [LICENSE](LICENSE)).
