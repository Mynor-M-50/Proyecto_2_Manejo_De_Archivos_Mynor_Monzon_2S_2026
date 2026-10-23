import { Component, ViewEncapsulation, computed, input } from '@angular/core';
import { renderMarkdown } from './markdown';

// Muestra texto Markdown ya formateado. Sin encapsulacion porque el HTML se inserta con innerHTML
@Component({
  selector: 'app-markdown',
  encapsulation: ViewEncapsulation.None,
  template: `<div class="markdown" [innerHTML]="html()"></div>`,
  styleUrl: './markdown-view.css',
})
export class MarkdownView {
  readonly source = input.required<string>();
  protected readonly html = computed(() => renderMarkdown(this.source()));
}
