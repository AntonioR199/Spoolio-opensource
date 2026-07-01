import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Informativa privacy e cookie — Spoolio",
  description:
    "Come Spoolio tratta i dati personali e quali cookie utilizza. Solo cookie tecnici, nessuna profilazione.",
};

// Pagina pubblica (vedi src/middleware.ts e AppShell): raggiungibile senza login.
// Ultimo aggiornamento: 26 giugno 2026.
export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo className="h-8 w-8 shadow-sm" />
            <span className="text-sm font-semibold">Spoolio</span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Torna al login
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Informativa privacy e cookie</h1>
        <p className="mt-2 text-sm text-muted-foreground">Ultimo aggiornamento: 26 giugno 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-foreground/90">
          <section className="space-y-2">
            <p>
              La presente informativa descrive come vengono trattati i dati personali degli utenti
              dell&apos;istanza ufficiale di <strong>Spoolio</strong>, l&apos;applicazione per la
              gestione dell&apos;inventario di filamenti per stampa 3D, ai sensi del Regolamento (UE)
              2016/679 (&quot;GDPR&quot;).
            </p>
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-[13px] text-muted-foreground">
              Spoolio è un progetto open-source e auto-ospitabile: se installi una tua istanza, sei
              tu a diventare titolare del trattamento per i tuoi utenti. Questa informativa si
              riferisce all&apos;istanza gestita dal Titolare indicato di seguito.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">1. Titolare del trattamento</h2>
            <p>
              Titolare del trattamento è <strong>DomoticLab</strong>. Per qualsiasi questione relativa ai dati
              personali puoi scrivere a{" "}
              <a className="underline" href="mailto:info@domotic-lab.it">
                info@domotic-lab.it
              </a>
              .
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">2. Quali dati trattiamo</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Dati dell&apos;account</strong>: indirizzo email e password (gestiti tramite
                Supabase Auth; la password è conservata in forma cifrata e non è a noi visibile).
                Se attivi l&apos;autenticazione a due fattori, il relativo fattore TOTP.
              </li>
              <li>
                <strong>Contenuti che inserisci</strong>: il tuo inventario di filamenti, marchi e
                negozi, stampanti, impostazioni e gli eventuali <strong>file PDF delle fatture</strong>{" "}
                che carichi.
              </li>
              <li>
                <strong>Dati tecnici</strong>: cookie di sessione necessari all&apos;autenticazione e
                log tecnici di errore lato server, per il funzionamento e la sicurezza del servizio.
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">3. Finalità e basi giuridiche</h2>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                Erogazione del servizio richiesto (creazione account, gestione dell&apos;inventario,
                import delle fatture): base giuridica <em>esecuzione del contratto/servizio</em> (art.
                6.1.b GDPR).
              </li>
              <li>
                Sicurezza, autenticazione e prevenzione degli abusi: <em>legittimo interesse</em> e
                necessità tecnica (art. 6.1.f GDPR).
              </li>
            </ul>
            <p>Non effettuiamo profilazione né processi decisionali automatizzati.</p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">4. Cookie e tecnologie simili</h2>
            <p>
              Spoolio utilizza <strong>esclusivamente cookie tecnici</strong>, indispensabili al
              funzionamento, e una preferenza salvata localmente nel tuo browser. Non usiamo cookie di
              profilazione, analitici o di terze parti: per questo <strong>non è richiesto alcun
              banner di consenso</strong>.
            </p>
            <div className="overflow-x-auto">
              <table className="mt-2 w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Nome</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 font-medium">Finalità</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b">
                    <td className="py-2 pr-4 align-top">Cookie di sessione (Supabase Auth)</td>
                    <td className="py-2 pr-4 align-top">Tecnico, necessario</td>
                    <td className="py-2 align-top">Mantiene attiva la sessione di login.</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-4 align-top">
                      <code>fs-theme</code> (memoria locale)
                    </td>
                    <td className="py-2 pr-4 align-top">Funzionale</td>
                    <td className="py-2 align-top">
                      Ricorda la preferenza di tema (chiaro/scuro), su tua scelta.
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">5. Estrazione AI delle fatture (opzionale)</h2>
            <p>
              La funzione di estrazione assistita dall&apos;AI è <strong>facoltativa e configurata
              dall&apos;utente</strong>: per usarla devi inserire una <strong>tua chiave</strong> di un
              provider AI di tua scelta. Quando la attivi, il testo della fattura e le relative
              richieste vengono inviati <strong>direttamente al provider che hai scelto, con la tua
              chiave e sotto la tua responsabilità</strong>, secondo la privacy policy di quel
              provider. Il Titolare <strong>non invia dati a provider AI di propria iniziativa</strong>{" "}
              e non condivide i tuoi dati con terzi per finalità di marketing.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">6. Fornitori e responsabili del trattamento</h2>
            <p>Per erogare il servizio ci avvaliamo di fornitori che agiscono come responsabili:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <strong>Supabase</strong> — database, autenticazione e archiviazione dei file
                (fatture). Conserva i dati dell&apos;applicazione.
              </li>
              <li>
                <strong>Google Firebase / Google Cloud</strong> — hosting dell&apos;applicazione.
              </li>
            </ul>
            <p>
              Alcuni fornitori possono trattare dati al di fuori dell&apos;Unione Europea; in tal caso
              il trasferimento avviene con adeguate garanzie (es. clausole contrattuali standard).
              [Indicare la region dei dati Supabase se vuoi specificarla.]
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">7. Conservazione dei dati</h2>
            <p>
              Conserviamo i tuoi dati per il tempo in cui l&apos;account resta attivo. Puoi chiedere in
              ogni momento la cancellazione dell&apos;account e dei dati associati; alla cancellazione i
              dati vengono rimossi, salvo eventuali obblighi di legge.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">8. I tuoi diritti</h2>
            <p>
              In qualità di interessato puoi esercitare i diritti previsti dagli artt. 15–22 GDPR:
              accesso, rettifica, cancellazione, limitazione, portabilità e opposizione. Per
              esercitarli scrivi a{" "}
              <a className="underline" href="mailto:info@domotic-lab.it">
                info@domotic-lab.it
              </a>
              . Hai inoltre il diritto di proporre reclamo all&apos;autorità di controllo (in Italia,
              il <strong>Garante per la protezione dei dati personali</strong>).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold">9. Modifiche</h2>
            <p>
              Potremmo aggiornare questa informativa nel tempo. La versione vigente è sempre
              pubblicata su questa pagina, con la data di ultimo aggiornamento in alto.
            </p>
          </section>
        </div>

        <footer className="mt-12 border-t pt-6 text-center text-[11px] text-muted-foreground">
          ™ DomoticLab 2025-2026 — Spoolio
        </footer>
      </main>
    </div>
  );
}
