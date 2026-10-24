import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error';
  message: string;
}

// Avisos que aparecen unos segundos en la esquina de la pantalla
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 1;

  // Muestra un aviso de exito
  success(message: string): void {
    this.push('success', message, 3500);
  }

  // Muestra un aviso de error
  error(message: string): void {
    this.push('error', message, 6000);
  }

  // Quita un aviso de la pantalla
  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  // Agrega el aviso y lo quita solo despues de ms milisegundos
  private push(kind: Toast['kind'], message: string, ms: number): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list, { id, kind, message }]);
    setTimeout(() => this.dismiss(id), ms);
  }
}
