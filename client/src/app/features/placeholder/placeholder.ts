import { Component, input } from '@angular/core';

// Pantalla temporal para las secciones que se construyen mas adelante
@Component({
  selector: 'app-placeholder',
  template: `
    <section class="page">
      <h1>{{ title() }}</h1>
      <p class="muted" style="margin-top: 8px">Esta seccion se construye en uno de los siguientes pasos.</p>
    </section>
  `,
})
export class Placeholder {
  // El titulo llega desde la configuracion de la ruta (data)
  readonly title = input('Seccion');
}
