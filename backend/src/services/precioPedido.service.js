export function calcularPrecioPedido(subtotalUsd) {
  const fleteUsd = 12;
  const comisionUsd = Math.round(subtotalUsd * 0.05 * 100) / 100;
  const totalUsd = Math.round((subtotalUsd + fleteUsd + comisionUsd) * 100) / 100;
  return { subtotalUsd, fleteUsd, comisionUsd, totalUsd };
}
