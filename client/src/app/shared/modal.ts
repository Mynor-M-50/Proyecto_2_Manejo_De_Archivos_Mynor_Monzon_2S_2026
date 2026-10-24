import { Component, input, output } from '@angular/core';
import { Icon } from './icon';

// Ventana emergente con titulo. Se cierra con la X, haciendo clic fuera o con Escape
@Component({
  selector: 'app-modal',
  imports: [Icon],
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="modal-backdrop" (click)="closed.emit()">
      <div class="modal" [class.modal-wide]="wide()" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
        <header class="modal-header">
          <h2>{{ title() }}</h2>
          <button class="btn-icon" type="button" aria-label="Cerrar" (click)="closed.emit()">
            <app-icon name="x" />
          </button>
        </header>
        <div class="modal-body">
          <ng-content />
        </div>
      </div>
    </div>
  `,
  styles: ['.modal.modal-wide { max-width: 640px; }'],
})
export class Modal {
  readonly title = input.required<string>();
  // Ventana mas ancha, para contenido con listas
  readonly wide = input(false);
  readonly closed = output<void>();
}
