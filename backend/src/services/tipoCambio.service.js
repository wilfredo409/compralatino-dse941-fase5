import { query } from '../config/db.js';

/**
 * Conversión JPY→USD (M2 · Catálogo). Usa la tasa vigente más reciente de
 * `tipo_cambio` y aplica el margen de intermediación de CompraLatino.
 * Fórmula documentada en supuestos_fase3.md #8: usd = (jpy / tasa) * (1 + margen).
 */
export async function obtenerTasaVigente(monedaOrigen = 'JPY', monedaDestino = 'USD') {
  const { rows } = await query(
    `SELECT tasa, margen, vigencia_desde FROM tipo_cambio
     WHERE moneda_origen = $1 AND moneda_destino = $2
     ORDER BY vigencia_desde DESC LIMIT 1`,
    [monedaOrigen, monedaDestino]
  );
  return rows[0] || null;
}

export function convertirJpyAUsd(precioJpy, tasaRow) {
  if (!tasaRow) return null;
  const usd = (Number(precioJpy) / Number(tasaRow.tasa)) * (1 + Number(tasaRow.margen));
  return Math.round(usd * 100) / 100;
}
