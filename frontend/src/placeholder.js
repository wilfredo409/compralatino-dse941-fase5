// Genera una imagen de reemplazo local (SVG data-URI) cuando un producto no
// trae imágenes — evita depender de un servicio externo solo para mostrar
// un marcador de posición.
export function imagenPlaceholder(texto = '?') {
  const letra = encodeURIComponent((texto || '?').trim()[0]?.toUpperCase() || '?');
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='480' height='360'><rect width='100%' height='100%' fill='#e8e8e8'/><text x='50%' y='50%' font-size='120' text-anchor='middle' dominant-baseline='middle' fill='#999' font-family='sans-serif'>${letra}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
