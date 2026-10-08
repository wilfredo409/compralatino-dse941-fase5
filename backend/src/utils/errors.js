// Cuerpo de error uniforme según el Anexo B de openapi.yaml:
// { codigo, mensaje, detalle }

export class ApiError extends Error {
  constructor(status, codigo, mensaje, detalle = null) {
    super(mensaje);
    this.status = status;
    this.codigo = codigo;
    this.detalle = detalle;
  }

  toJSON() {
    return { codigo: this.codigo, mensaje: this.message, detalle: this.detalle };
  }
}

export const ErrorValidacion = (mensaje, detalle) =>
  new ApiError(400, 'ERROR_VALIDACION', mensaje, detalle);
export const ErrorAutenticacion = (mensaje = 'Credenciales inválidas o token ausente/expirado') =>
  new ApiError(401, 'ERROR_AUTENTICACION', mensaje);
export const ErrorAutorizacion = (mensaje = 'No tiene permisos para esta operación') =>
  new ApiError(403, 'ERROR_AUTORIZACION', mensaje);
export const ErrorNoEncontrado = (mensaje = 'Recurso no encontrado') =>
  new ApiError(404, 'ERROR_NO_ENCONTRADO', mensaje);
export const ErrorConflicto = (mensaje, detalle) =>
  new ApiError(409, 'ERROR_CONFLICTO', mensaje, detalle);
export const ErrorDependenciaExterna = (mensaje = 'YAuctions no disponible (circuito abierto)', detalle) =>
  new ApiError(503, 'ERROR_DEPENDENCIA_EXTERNA', mensaje, detalle);
