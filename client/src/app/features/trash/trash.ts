import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { errorMessage } from '../../core/errors';
import { ToastService } from '../../core/toast.service';
import { RestoreFileResult, RestoreFolderResult, TrashItem, TrashService } from '../../core/trash.service';
import { formatSize } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

type DialogType = 'delete' | 'empty';

function plural(n: number, one: string, many: string): string {
  return n + ' ' + (n === 1 ? one : many);
}

function restoredFileMessage(res: RestoreFileResult): string {
  let message = 'Archivo restaurado';
  if (res.movedToRoot) {
    message += ' en Mi unidad, porque su carpeta original sigue en la papelera';
  }
  if (res.renamed) {
    message += '. Quedo con el nombre ' + res.file.name + ' porque ya existia uno igual';
  }
  return message;
}

function restoredFolderMessage(res: RestoreFolderResult): string {
  const inside = res.folders - 1 + res.files;
  let message = 'Carpeta restaurada';
  if (inside > 0) {
    message += ' con ' + plural(inside, 'elemento', 'elementos');
  }
  if (res.movedToRoot) {
    message += ' en Mi unidad, porque su carpeta original sigue en la papelera';
  }
  if (res.renamed) {
    message += '. Quedo con el nombre ' + res.folder.name + ' porque ya existia una igual';
  }
  return message;
}

// Papelera: restaurar, eliminar de forma definitiva o vaciarla
@Component({
  selector: 'app-trash',
  imports: [DatePipe, Icon, Modal],
  templateUrl: './trash.html',
  styleUrl: './trash.css',
})
export class Trash {
  private readonly api = inject(TrashService);
  private readonly toast = inject(ToastService);

  protected readonly formatSize = formatSize;

  protected readonly items = signal<TrashItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly restoringId = signal<string | null>(null);

  protected readonly dialog = signal<DialogType | null>(null);
  protected readonly target = signal<TrashItem | null>(null);
  protected readonly busy = signal(false);
  protected readonly dialogError = signal('');

  protected readonly isEmpty = computed(() => this.items().length === 0);

  constructor() {
    this.load();
  }

  // Resumen de lo que hay dentro de una carpeta eliminada
  protected contents(item: TrashItem): string {
    const c = item.contains;
    if (!c) {
      return '';
    }
    const parts: string[] = [];
    if (c.folders > 0) {
      parts.push(plural(c.folders, 'carpeta', 'carpetas'));
    }
    if (c.files > 0) {
      parts.push(plural(c.files, 'archivo', 'archivos'));
    }
    return parts.length > 0 ? parts.join(' y ') : 'Carpeta vacia';
  }

  protected emptyMessage(): string {
    return 'Se eliminaran de forma definitiva ' + plural(this.items().length, 'elemento', 'elementos') + ' de la papelera, con todo lo que contienen.';
  }

  // ---------- Restaurar ----------

  protected restore(item: TrashItem): void {
    if (this.restoringId()) {
      return;
    }
    this.restoringId.set(item.id);

    if (item.type === 'folder') {
      this.api.restoreFolder(item.id).subscribe({
        next: (res) => this.afterRestore(restoredFolderMessage(res)),
        error: (err) => this.restoreFailed(err),
      });
    } else {
      this.api.restoreFile(item.id).subscribe({
        next: (res) => this.afterRestore(restoredFileMessage(res)),
        error: (err) => this.restoreFailed(err),
      });
    }
  }

  private afterRestore(message: string): void {
    this.toast.success(message);
    this.restoringId.set(null);
    this.load();
  }

  private restoreFailed(err: unknown): void {
    this.toast.error(errorMessage(err));
    this.restoringId.set(null);
    this.load();
  }

  // ---------- Eliminar de forma definitiva ----------

  protected askDelete(item: TrashItem): void {
    this.target.set(item);
    this.dialogError.set('');
    this.busy.set(false);
    this.dialog.set('delete');
  }

  protected askEmpty(): void {
    this.target.set(null);
    this.dialogError.set('');
    this.busy.set(false);
    this.dialog.set('empty');
  }

  protected closeDialog(): void {
    this.dialog.set(null);
    this.target.set(null);
    this.dialogError.set('');
    this.busy.set(false);
  }

  protected confirmDelete(): void {
    const item = this.target();
    if (!item || this.busy()) {
      return;
    }
    const request = item.type === 'folder' ? this.api.deleteFolder(item.id) : this.api.deleteFile(item.id);
    this.run(request, 'Eliminado de forma definitiva');
  }

  protected confirmEmpty(): void {
    if (this.busy()) {
      return;
    }
    this.run(this.api.empty(), 'Papelera vaciada');
  }

  private run(request: ReturnType<TrashService['empty']>, okMessage: string): void {
    this.busy.set(true);
    this.dialogError.set('');
    request.subscribe({
      next: () => {
        this.toast.success(okMessage);
        this.closeDialog();
        this.load();
      },
      error: (err) => {
        this.busy.set(false);
        this.dialogError.set(errorMessage(err));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.list().subscribe({
      next: (res) => {
        this.items.set(res.items);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
