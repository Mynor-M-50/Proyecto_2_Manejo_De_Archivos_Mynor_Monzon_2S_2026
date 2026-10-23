import { HttpErrorResponse } from '@angular/common/http';

// Convierte un error de HTTP en un texto para mostrar al usuario
export function errorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    if (err.status === 0) {
      return 'No se pudo conectar con el servidor';
    }
    const body = err.error;
    if (body && typeof body === 'object' && typeof body.message === 'string') {
      return body.message;
    }
    return 'Error ' + err.status;
  }
  return 'Ocurrio un error inesperado';
}
