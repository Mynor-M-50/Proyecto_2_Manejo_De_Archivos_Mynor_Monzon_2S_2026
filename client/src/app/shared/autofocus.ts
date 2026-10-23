import { Directive, ElementRef, afterNextRender, inject } from '@angular/core';

// Pone el cursor en el campo apenas aparece en pantalla
@Directive({ selector: '[appAutofocus]' })
export class Autofocus {
  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    afterNextRender(() => element.focus());
  }
}
