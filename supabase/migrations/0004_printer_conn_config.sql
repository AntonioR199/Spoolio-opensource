-- Parametri di connessione specifici del protocollo (multi-marca).
-- conn_config raccoglie i campi non segreti che variano per protocollo
-- (es. seriale Bambu, porta Moonraker). L'unico segreto resta in
-- conn_access_code (access code Bambu / API key Prusa / eventuale token),
-- così SafePrinter continua a non esporlo al browser.

alter table printer
  add column if not exists conn_config jsonb;
