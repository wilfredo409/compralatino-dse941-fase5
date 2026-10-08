-- Fase 3 — pequeña extensión aditiva sobre el schema.sql de Fase 2:
-- una secuencia para generar el código legible de pedido (CL-<año>-<n>),
-- que no se puede resolver dentro del CHECK/DEFAULT original sin tocar la
-- tabla ya validada en Fase 2. No modifica ninguna tabla existente.
CREATE SEQUENCE IF NOT EXISTS pedido_codigo_seq START 1;
