import { DatePipe, Location } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EMPTY, Subject, catchError, forkJoin, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FilesService } from '../../core/files.service';
import { Access, FileItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Autofocus } from '../../shared/autofocus';
import { saveBlob } from '../../shared/download';
import { formatSize } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { MarkdownView } from '../../shared/markdown-view';
import { Modal } from '../../shared/modal';
import { ShareDialog } from '../sharing/share-dialog';
import { Comments } from './comments';

const MAX_CONTENT_BYTES = 5 * 1024 * 1024;

const ACCESS_LABELS: Record<Access, string> = {
  owner: 'Propietario',
  edit: 'Puede editar',
  comment: 'Puede comentar',
  read: 'Solo lectura',
};

// Visor de un archivo: muestra el texto (los .md ya formateados), permite editarlo y tiene comentarios
@Component({
  selector: 'app-viewer',
  imports: [DatePipe, FormsModule, Icon, Modal, Autofocus, MarkdownView, Comments, ShareDialog],
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
  templateUrl: './viewer.html',
  styleUrl: './viewer.css',
})
export class Viewer {
  private readonly filesApi = inject(FilesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly location = inject(Location);

  // Llega desde la ruta /view/:fileId
  readonly fileId = input.required<string>();

  protected readonly formatSize = formatSize;

  protected readonly file = signal<FileItem | null>(null);
  protected readonly content = signal('');
  protected readonly access = signal<Access>('read');
  protected readonly loading = signal(false);
  protected readonly loadError = signal('');

  protected readonly mode = signal<'view' | 'edit'>('view');
  protected readonly viewMode = signal<'preview' | 'source'>('preview');
  protected readonly draft = signal('');
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  protected readonly shareOpen = signal(false);
  protected readonly confirmDiscard = signal(false);
  protected readonly confirmDelete = signal(false);
  protected readonly deleting = signal(false);
  protected readonly deleteError = signal('');

  protected readonly isMarkdown = computed(() => this.file()?.ext === 'md');
  protected readonly isOwner = computed(() => this.access() === 'owner');
  protected readonly canEdit = computed(() => this.access() === 'owner' || this.access() === 'edit');
  protected readonly accessLabel = computed(() => ACCESS_LABELS[this.access()]);
  protected readonly draftBytes = computed(() => new TextEncoder().encode(this.draft()).length);
  protected readonly tooBig = computed(() => this.draftBytes() > MAX_CONTENT_BYTES);

  // Cambios en el editor que todavia no se guardaron
  readonly dirty = computed(() => this.mode() === 'edit' && this.draft() !== this.content());

  private readonly load$ = new Subject<string>();

  constructor() {
    this.load$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.loadError.set('');
        }),
        switchMap((id) =>
          forkJoin({ meta: this.filesApi.get(id), body: this.filesApi.content(id) }).pipe(
            catchError((err) => {
              this.loading.set(false);
              this.file.set(null);
              this.loadError.set(errorMessage(err));
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ meta, body }) => {
        this.file.set(body.file);
        this.access.set(meta.access);
        this.content.set(body.content);
        this.mode.set('view');
        this.viewMode.set('preview');
        this.loading.set(false);
      });

    effect(() => {
      const id = this.fileId();
      untracked(() => this.load$.next(id));
    });
  }

  // Regresa a la pantalla anterior
  protected back(): void {
    this.location.back();
  }

  // ---------- Edicion ----------

  // Pasa a modo edicion con el contenido actual
  protected startEdit(): void {
    this.draft.set(this.content());
    this.saveError.set('');
    this.mode.set('edit');
  }

  // Sale de la edicion (pide confirmar si hay cambios sin guardar)
  protected cancelEdit(): void {
    if (this.dirty()) {
      this.confirmDiscard.set(true);
      return;
    }
    this.mode.set('view');
  }

  // Descarta los cambios y vuelve a ver el archivo
  protected discard(): void {
    this.confirmDiscard.set(false);
    this.mode.set('view');
  }

  // Guarda el contenido editado
  protected save(): void {
    const file = this.file();
    if (!file || this.saving()) {
      return;
    }
    if (this.tooBig()) {
      this.saveError.set('El contenido supera el tamano maximo de 5 MB');
      return;
    }

    const text = this.draft();
    this.saving.set(true);
    this.saveError.set('');
    this.filesApi.saveContent(file.id, text).subscribe({
      next: (res) => {
        this.file.set(res.file);
        this.content.set(text);
        this.mode.set('view');
        this.saving.set(false);
        this.toast.success('Cambios guardados');
        this.auth.refreshUser();
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(errorMessage(err));
      },
    });
  }

  // Ctrl+S (o Cmd+S) guarda sin salir del editor
  protected onEditorKey(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      this.save();
    }
  }

  // Avisa al cerrar o recargar la pestana con cambios sin guardar
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.dirty()) {
      event.preventDefault();
    }
  }

  // ---------- Descargar y eliminar ----------

  // Descarga el archivo en el equipo
  protected download(): void {
    const file = this.file();
    if (!file) {
      return;
    }
    this.filesApi.download(file.id).subscribe({
      next: (blob) => saveBlob(blob, file.name),
      error: () => this.toast.error('No se pudo descargar el archivo'),
    });
  }

  // Pide confirmacion para enviar a la papelera
  protected askDelete(): void {
    this.deleteError.set('');
    this.confirmDelete.set(true);
  }

  // Envia el archivo a la papelera
  protected confirmTrash(): void {
    const file = this.file();
    if (!file || this.deleting()) {
      return;
    }
    this.deleting.set(true);
    this.deleteError.set('');
    this.filesApi.trash(file.id).subscribe({
      next: () => {
        this.toast.success('Archivo enviado a la papelera');
        this.confirmDelete.set(false);
        this.router.navigate(file.folderId ? ['/files', file.folderId] : ['/files']);
      },
      error: (err) => {
        this.deleting.set(false);
        this.deleteError.set(errorMessage(err));
      },
    });
  }
}
