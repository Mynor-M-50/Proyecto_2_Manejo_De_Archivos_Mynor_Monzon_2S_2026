import { Component, computed, inject, input, output, signal } from '@angular/core';
import { errorMessage } from '../../core/errors';
import { FoldersService } from '../../core/folders.service';
import { BreadcrumbItem, Folder } from '../../core/models';
import { Icon } from '../../shared/icon';

// Selector de carpeta destino: se navega nivel por nivel y se confirma la carpeta actual
@Component({
  selector: 'app-folder-picker',
  imports: [Icon],
  templateUrl: './folder-picker.html',
  styleUrl: './folder-picker.css',
})
export class FolderPicker {
  private readonly foldersApi = inject(FoldersService);

  // Carpeta que se esta moviendo: no se muestra, asi nunca se entra a sus subcarpetas
  readonly excludeId = input<string>();
  readonly busy = input(false);

  readonly confirmed = output<string | null>();
  readonly cancelled = output<void>();

  protected readonly path = signal<BreadcrumbItem[]>([]);
  protected readonly folders = signal<Folder[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly currentId = computed(() => {
    const path = this.path();
    return path.length > 0 ? path[path.length - 1].id : null;
  });
  protected readonly visible = computed(() =>
    this.folders().filter((folder) => folder.id !== this.excludeId())
  );

  constructor() {
    this.load();
  }

  protected enter(folder: Folder): void {
    this.path.update((path) => [...path, { id: folder.id, name: folder.name }]);
    this.load();
  }

  // index -1 vuelve a la raiz
  protected goTo(index: number): void {
    this.path.update((path) => path.slice(0, index + 1));
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.foldersApi.list(this.currentId() ?? undefined).subscribe({
      next: (res) => {
        this.folders.set(res.folders);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
