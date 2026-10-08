import 'dotenv/config';

/**
 * YAuctionsAdapter — patrón Adapter (Fase 1/2, ADR de integración externa).
 *
 * No existe acceso real a la API de YAuctions de Japón: este módulo simula
 * la interfaz externa (latencia variable + fallos aleatorios configurables)
 * y es el único punto del backend que "conoce" esa integración. El resto
 * del código solo llama a `yAuctionsAdapter.enviarOferta(...)` o
 * `.sincronizarCatalogo(...)` sin saber que es un mock (ver supuestos_fase3.md #7).
 *
 * Incluye, tal como se diseñó desde Fase 1 para mitigar RSK-01
 * (latencia/fallos de la interfaz externa):
 *   - Circuit Breaker (Nygard, 2018): CERRADO → ABIERTO → SEMI-ABIERTO.
 *   - Reintentos con backoff exponencial mientras el circuito está cerrado.
 *   - Caché local de corta duración para lecturas (sincronización de catálogo).
 */

const LATENCY_MIN = Number(process.env.YAUCTIONS_LATENCY_MS_MIN || 150);
const LATENCY_MAX = Number(process.env.YAUCTIONS_LATENCY_MS_MAX || 900);
const FAILURE_RATE = Number(process.env.YAUCTIONS_FAILURE_RATE || 0);
const BREAKER_THRESHOLD = Number(process.env.YAUCTIONS_BREAKER_THRESHOLD || 5);
const BREAKER_COOLDOWN_MS = Number(process.env.YAUCTIONS_BREAKER_COOLDOWN_MS || 30000);

const ESTADOS = { CERRADO: 'CERRADO', ABIERTO: 'ABIERTO', SEMI_ABIERTO: 'SEMI_ABIERTO' };

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function latenciaSimulada() {
  return LATENCY_MIN + Math.random() * (LATENCY_MAX - LATENCY_MIN);
}

class CircuitBreaker {
  constructor({ umbral, enfriamientoMs }) {
    this.umbral = umbral;
    this.enfriamientoMs = enfriamientoMs;
    this.estado = ESTADOS.CERRADO;
    this.fallosConsecutivos = 0;
    this.abiertoDesde = null;
    this.metricas = { llamadas: 0, exitos: 0, fallos: 0, ultimaLatenciaMs: null };
  }

  /** ¿Se permite intentar la llamada ahora mismo? */
  puedeIntentar() {
    if (this.estado === ESTADOS.CERRADO) return true;
    if (this.estado === ESTADOS.ABIERTO) {
      if (Date.now() - this.abiertoDesde >= this.enfriamientoMs) {
        this.estado = ESTADOS.SEMI_ABIERTO;
        return true; // una llamada de prueba
      }
      return false;
    }
    return true; // SEMI_ABIERTO: deja pasar la llamada de prueba
  }

  registrarExito(latenciaMs) {
    this.metricas.llamadas++;
    this.metricas.exitos++;
    this.metricas.ultimaLatenciaMs = latenciaMs;
    this.fallosConsecutivos = 0;
    this.estado = ESTADOS.CERRADO;
  }

  registrarFallo(latenciaMs) {
    this.metricas.llamadas++;
    this.metricas.fallos++;
    this.metricas.ultimaLatenciaMs = latenciaMs;
    this.fallosConsecutivos++;
    if (this.estado === ESTADOS.SEMI_ABIERTO || this.fallosConsecutivos >= this.umbral) {
      this.estado = ESTADOS.ABIERTO;
      this.abiertoDesde = Date.now();
    }
  }

  snapshot() {
    const tasaErrores = this.metricas.llamadas
      ? this.metricas.fallos / this.metricas.llamadas
      : 0;
    return {
      circuito: this.estado,
      llamadas: this.metricas.llamadas,
      fallos: this.metricas.fallos,
      tasaErrores: Number((tasaErrores * 100).toFixed(1)),
      latenciaMediaMs: this.metricas.ultimaLatenciaMs,
    };
  }
}

class YAuctionsAdapter {
  constructor() {
    this.breaker = new CircuitBreaker({
      umbral: BREAKER_THRESHOLD,
      enfriamientoMs: BREAKER_COOLDOWN_MS,
    });
    this._cacheCatalogo = { datos: null, expiraEn: 0 };
  }

  /**
   * Llama a la "API externa" simulada con reintentos + backoff exponencial,
   * respetando el estado del circuito. `simularFallo` permite forzar un
   * error desde la capa de negocio (útil para demostrar el breaker en la
   * defensa, ver README del backend).
   */
  async _llamarExterna(nombreOperacion, { intentos = 3, simularFallo = false } = {}) {
    if (!this.breaker.puedeIntentar()) {
      const err = new Error(`YAuctions no disponible: circuito ${this.breaker.estado} tras ${this.breaker.metricas.fallos} fallos`);
      err.circuitoAbierto = true;
      throw err;
    }

    let ultimoError;
    for (let intento = 1; intento <= intentos; intento++) {
      const inicio = Date.now();
      try {
        const latencia = latenciaSimulada();
        await esperar(latencia);

        const falla = simularFallo || Math.random() < FAILURE_RATE;
        if (falla) throw new Error(`Fallo simulado de YAuctions en "${nombreOperacion}"`);

        this.breaker.registrarExito(Math.round(Date.now() - inicio));
        return { ok: true, latenciaMs: Math.round(Date.now() - inicio) };
      } catch (err) {
        ultimoError = err;
        this.breaker.registrarFallo(Math.round(Date.now() - inicio));
        if (this.breaker.estado === ESTADOS.ABIERTO) break; // no seguir reintentando si ya se abrió
        if (intento < intentos) await esperar(2 ** intento * 100); // backoff exponencial: 200ms, 400ms...
      }
    }
    const err = new Error(ultimoError?.message || `Fallo en YAuctions ("${nombreOperacion}")`);
    err.circuitoAbierto = this.breaker.estado === ESTADOS.ABIERTO;
    throw err;
  }

  /** Simula el envío de una puja/oferta a YAuctions (POST /pedidos/{id}/ofertas). */
  async enviarOferta({ idProducto, montoJpy, simularFallo = false } = {}) {
    const resultado = await this._llamarExterna('enviarOferta', { simularFallo });
    return {
      aceptada: true,
      idExternoSubasta: `YA-${idProducto.slice(0, 8)}-${Date.now()}`,
      montoJpy,
      latenciaMs: resultado.latenciaMs,
      timestamp: new Date().toISOString(),
    };
  }

  /** Simula releer el catálogo de YAuctions, con caché de corta duración. */
  async sincronizarCatalogo({ forzar = false } = {}) {
    if (!forzar && this._cacheCatalogo.datos && Date.now() < this._cacheCatalogo.expiraEn) {
      return { ...this._cacheCatalogo.datos, deCache: true };
    }
    const resultado = await this._llamarExterna('sincronizarCatalogo');
    const datos = { sincronizadoEn: new Date().toISOString(), latenciaMs: resultado.latenciaMs };
    this._cacheCatalogo = { datos, expiraEn: Date.now() + 60_000 }; // 60 s de caché
    return { ...datos, deCache: false };
  }

  /** Estado de salud para el panel administrativo (GET /admin/metricas). */
  salud() {
    return this.breaker.snapshot();
  }
}

// Instancia única compartida por toda la app (estado del breaker es global al proceso).
export const yAuctionsAdapter = new YAuctionsAdapter();
