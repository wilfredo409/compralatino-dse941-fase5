-- Endurecimiento de la capa de datos (Fase 3, tras la revisión de calidad):
-- productos.stock es INT NOT NULL sin restricción de rango en schema.sql
-- (Fase 2), así que dos compras simultáneas del mismo producto podían dejarlo
-- en negativo. El backend ahora bloquea la fila y descuenta de forma
-- condicional; esta restricción es la última línea de defensa en la propia
-- base de datos. Es aditiva y repetible: no cambia datos existentes.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_productos_stock_no_negativo'
  ) THEN
    ALTER TABLE productos ADD CONSTRAINT chk_productos_stock_no_negativo CHECK (stock >= 0);
  END IF;
END
$$;
