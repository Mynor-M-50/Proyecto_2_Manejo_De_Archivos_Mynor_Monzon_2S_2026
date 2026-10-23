import { Component, input } from '@angular/core';

export type IconName =
  | 'folder' | 'folder-plus' | 'file' | 'trash' | 'share' | 'chart' | 'users' | 'logout'
  | 'upload' | 'download' | 'search' | 'pencil' | 'move' | 'x' | 'chevron' | 'home'
  | 'arrow-up' | 'arrow-down' | 'eye' | 'message' | 'restore' | 'check';

// Iconos simples dibujados con SVG
@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @switch (name()) {
        @case ('folder') { <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" /> }
        @case ('folder-plus') {
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          <path d="M12 10.5v5" /><path d="M9.5 13h5" />
        }
        @case ('file') { <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5z" /><path d="M14 3v5h5" /> }
        @case ('trash') {
          <path d="M4 7h16" /><path d="M10 11v6" /><path d="M14 11v6" />
          <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M9 7V4h6v3" />
        }
        @case ('share') {
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.6 13.5l6.8 4" /><path d="M15.4 6.5l-6.8 4" />
        }
        @case ('chart') { <path d="M5 20V11" /><path d="M12 20V4" /><path d="M19 20v-6" /><path d="M3 20h18" /> }
        @case ('users') {
          <circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
          <path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M18 14.5c2.2.7 3.5 2.6 3.5 5.5" />
        }
        @case ('logout') { <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /> }
        @case ('upload') { <path d="M12 16V4" /><path d="M7 9l5-5 5 5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /> }
        @case ('download') { <path d="M12 4v12" /><path d="M7 11l5 5 5-5" /><path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" /> }
        @case ('search') { <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /> }
        @case ('pencil') { <path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="M13.5 6.5l4 4" /> }
        @case ('move') { <path d="M5 12h14" /><path d="M13 6l6 6-6 6" /> }
        @case ('x') { <path d="M6 6l12 12" /><path d="M18 6L6 18" /> }
        @case ('chevron') { <path d="M9 6l6 6-6 6" /> }
        @case ('home') { <path d="M3 11l9-8 9 8" /><path d="M5 10v10h5v-6h4v6h5V10" /> }
        @case ('arrow-up') { <path d="M12 19V5" /><path d="M6 11l6-6 6 6" /> }
        @case ('arrow-down') { <path d="M12 5v14" /><path d="M6 13l6 6 6-6" /> }
        @case ('eye') { <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /> }
        @case ('message') { <path d="M21 12a8 8 0 0 1-8 8H4l2.5-3A8 8 0 1 1 21 12z" /> }
        @case ('restore') { <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /> }
        @case ('check') { <path d="M5 12l5 5 9-10" /> }
      }
    </svg>
  `,
  styles: [':host { display: inline-flex; vertical-align: middle; }'],
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
}
