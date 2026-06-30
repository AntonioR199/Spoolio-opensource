-- Aggiunge il tracciamento "bobina in uso" per il countdown asciugatura.
-- Una bobina è considerata chiusa (sigillata) di default: solo quando viene messa
-- in uso (status='open', con opened_at valorizzato) parte il countdown "da asciugare".

alter table spool
  add column if not exists opened_at timestamptz;
