const dolares = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const yenes = new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' });
const fechaCorta = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium' });
const fechaHora = new Intl.DateTimeFormat('es-SV', { dateStyle: 'medium', timeStyle: 'short' });

export const usd = (importe) => importe == null ? '—' : dolares.format(importe);
export const jpy = (importe) => importe == null ? '—' : yenes.format(importe);
export const fecha = (valor) => valor ? fechaCorta.format(new Date(valor)) : '—';
export const fechaConHora = (valor) => valor ? fechaHora.format(new Date(valor)) : '—';
export const estadoPedido = (estado) => ({
  creado: 'Creado', pagado: 'Pagado', en_proceso: 'En proceso',
  enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado',
})[estado] || estado;
