import { CanDeactivateFn } from '@angular/router';
import type { Viewer } from './viewer';

// Al salir del visor con cambios sin guardar se pide confirmacion.
// Solo se importa el tipo de Viewer, asi el visor sigue cargandose bajo demanda.
export const viewerCanDeactivate: CanDeactivateFn<Viewer> = (viewer) =>
  !viewer.dirty() || window.confirm('Tienes cambios sin guardar. Salir sin guardar?');
