-- Integrazione stampanti in lettura (LAN): dati di connessione per stampante.
-- NULL = stampante non collegata. L'access code è un segreto di rete locale,
-- protetto dalle policy RLS per-utente già attive sulla tabella printer.

alter table printer
  add column if not exists conn_type        text,  -- es. 'bambu-lan'
  add column if not exists conn_host         text,  -- IP della stampante in LAN
  add column if not exists conn_serial       text,  -- seriale (topic device/{serial}/report|request)
  add column if not exists conn_access_code  text;  -- access code LAN
