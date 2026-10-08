-- Corrección de un defecto real encontrado al construir Fase 3:
-- usuarios.estado es VARCHAR(20) en schema.sql (Fase 2), pero uno de los
-- valores permitidos por su propio CHECK, 'pendiente_verificacion', mide
-- 22 caracteres — cualquier registro con ese estado (el DEFAULT de la
-- columna) fallaba al insertarse. Se amplía la columna sin tocar el CHECK
-- ni ningún otro dato. Ver supuestos_fase3.md #10.
ALTER TABLE usuarios ALTER COLUMN estado TYPE VARCHAR(30);
