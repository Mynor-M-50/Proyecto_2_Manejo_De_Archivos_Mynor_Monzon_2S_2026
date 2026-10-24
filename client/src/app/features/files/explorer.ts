import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concatMap,
  debounceTime,
  finalize,
  forkJoin,
  from,
  map,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { FilesService } from '../../core/files.service';
import { FoldersService } from '../../core/folders.service';
import { Access, BreadcrumbItem, FileItem, Folder } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Autofocus } from '../../shared/autofocus';
import { saveBlob } from '../../shared/download';
import { formatSize } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';
import { ShareDialog } from '../sharing/share-dialog';
import { FolderPicker } from './folder-picker';

// Lo que se muestra en pantalla despues de consultar al servidor
interface View {
  folders: Folder[];
  files: FileItem[];
  current: Folder | null;
  breadcrumb: BreadcrumbItem[];
  access: Access;
}

type Entry = { kind: 'folder'; folder: Folder } | { kind: 'file'; file: FileItem };
type DialogType = 'newFolder' | 'rename' | 'delete' | 'move';

const ALLOWED_EXTENSIONS = ['txt', 'md'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const ACCESS_LABELS: Record<Access, string> = {
  owner: 'Propietario',
  edit: 'Puede editar',
  comment: 'Puede comentar',
  read: 'Solo lectura',
};

// Explorador: navega por carpetas, sube, descarga, renombra, mueve y elimina
@Component({
  selector: 'app-explorer',
  imports: [DatePipe, FormsModule, RouterLink, Icon, Modal, Autofocus, FolderPicker, ShareDialog],
  templateUrl: './explorer.html',
  styleUrl: './explorer.css',
})
export class Explorer {
  private readonly foldersApi = inject(FoldersService);
  private readonly filesApi = inject(FilesService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  // Llega desde la ruta /files/:folderId (sin valor = raiz)
  readonly folderId = input<string>();

  protected readonly formatSize = formatSize;

  protected readonly folders = signal<Folder[]>([]);
  protected readonly files = signal<FileItem[]>([]);
  protected readonly current = signal<Folder | null>(null);
  protected readonly breadcrumb = signal<BreadcrumbItem[]>([]);
  protected readonly access = signal<Access>('owner');
  protected readonly loading = signal(false);

  // Busqueda y filtros
  protected readonly searchTerm = signal('');
  protected readonly extFilter = signal('');
  protected readonly sortField = signal('name');
  protected readonly sortOrder = signal<'asc' | 'desc'>('asc');

  // Ventanas emergentes
  protected readonly dialogType = signal<DialogType | null>(null);
  protected readonly target = signal<Entry | null>(null);
  protected readonly dialogName = signal('');
  protected readonly dialogError = signal('');
  protected readonly busy = signal(false);

  // Subida de archivos
  protected readonly dragging = signal(false);
  protected readonly upload = signal<{ total: number; done: number } | null>(null);
  private dragDepth = 0;

  protected readonly searching = computed(() => this.searchTerm().trim().length > 0);
  protected readonly isOwner = computed(() => this.access() === 'owner');
  protected readonly canEdit = computed(() => this.access() === 'owner' || this.access() === 'edit');
  protected readonly canUpload = computed(() => this.canEdit() && !this.searching() && !this.upload());
  protected readonly accessLabel = computed(() => ACCESS_LABELS[this.access()]);
  protected readonly targetName = computed(() => {
    const entry = this.target();
    if (!entry) {
      return '';
    }
    return entry.kind === 'folder' ? entry.folder.name : entry.file.name;
  });
  // Archivo o carpeta que se esta compartiendo (abre la ventana de compartir)
  protected readonly shareTarget = signal<Entry | null>(null);
  protected readonly shareResource = computed(() => {
    const entry = this.shareTarget();
    if (!entry) {
      return null;
    }
    return entry.kind === 'folder'
      ? { type: 'folder' as const, id: entry.folder.id, name: entry.folder.name }
      : { type: 'file' as const, id: entry.file.id, name: entry.file.name };
  });
  protected readonly targetFolderId = computed(() => {
    const entry = this.target();
    return entry && entry.kind === 'folder' ? entry.folder.id : undefined;
  });

  private readonly reload$ = new Subject<void>();
  private readonly search$ = new Subject<void>();

  constructor() {
    // Cada vez que se pide recargar, se cancela la consulta anterior que siga en curso
    this.reload$
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() => this.fetch().pipe(catchError((err) => this.onLoadError(err)))),
        takeUntilDestroyed()
      )
      .subscribe((view) => this.apply(view));

    // La busqueda espera a que el usuario deje de escribir
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload$.next());

    // Al cambiar de carpeta se limpia la busqueda y se carga la nueva
    effect(() => {
      this.folderId();
      untracked(() => {
        this.searchTerm.set('');
        this.reload$.next();
      });
    });
  }

  // ---------- Carga de datos ----------

  // Pide al servidor las carpetas y archivos de la vista actual
  private fetch(): Observable<View> {
    const filters = {
      ext: this.extFilter(),
      sort: this.sortField(),
      order: this.sortOrder(),
    };
    const term = this.searchTerm().trim();

    // Con texto de busqueda se consultan todos mis archivos
    if (term) {
      return this.filesApi.list({ q: term, ...filters }).pipe(
        map((res) => ({ folders: [], files: res.files, current: null, breadcrumb: [], access: 'owner' as Access }))
      );
    }

    const id = this.folderId();
    if (id) {
      return forkJoin({
        info: this.foldersApi.get(id),
        subs: this.foldersApi.list(id),
        files: this.filesApi.list({ folderId: id, ...filters }),
      }).pipe(
        map((r) => ({
          folders: r.subs.folders,
          files: r.files.files,
          current: r.info.folder,
          breadcrumb: r.info.breadcrumb,
          access: r.info.access,
        }))
      );
    }

    return forkJoin({
      subs: this.foldersApi.list(),
      files: this.filesApi.list({ folderId: 'root', ...filters }),
    }).pipe(
      map((r) => ({
        folders: r.subs.folders,
        files: r.files.files,
        current: null,
        breadcrumb: [],
        access: 'owner' as Access,
      }))
    );
  }

  // Guarda en pantalla el resultado de la consulta
  private apply(view: View): void {
    this.folders.set(view.folders);
    this.files.set(view.files);
    this.current.set(view.current);
    this.breadcrumb.set(view.breadcrumb);
    this.access.set(view.access);
    this.loading.set(false);
  }

  // Avisa del error y vuelve a la raiz si la carpeta no se pudo abrir
  private onLoadError(err: unknown): Observable<never> {
    this.loading.set(false);
    this.toast.error(errorMessage(err));
    // Si la carpeta no existe o no hay acceso, se vuelve a la raiz
    if (this.folderId()) {
      this.router.navigate(['/files']);
    }
    return EMPTY;
  }

  // ---------- Busqueda y filtros ----------

  // Actualiza el texto de busqueda y recarga
  protected onSearch(value: string): void {
    this.searchTerm.set(value);
    this.search$.next();
  }

  // Quita la busqueda
  protected clearSearch(): void {
    this.searchTerm.set('');
    this.reload$.next();
  }

  // Filtra por tipo de archivo
  protected onExt(value: string): void {
    this.extFilter.set(value);
    this.reload$.next();
  }

  // Cambia el campo de orden
  protected onSort(value: string): void {
    this.sortField.set(value);
    this.reload$.next();
  }

  // Alterna entre orden ascendente y descendente
  protected toggleOrder(): void {
    this.sortOrder.update((order) => (order === 'asc' ? 'desc' : 'asc'));
    this.reload$.next();
  }

  // ---------- Ventanas emergentes ----------

  // Convierte una carpeta en fila de la tabla
  protected folderEntry(folder: Folder): Entry {
    return { kind: 'folder', folder };
  }

  // Convierte un archivo en fila de la tabla
  protected fileEntry(file: FileItem): Entry {
    return { kind: 'file', file };
  }

  // Abre el dialogo para crear carpeta
  protected openNewFolder(): void {
    this.resetDialog();
    this.dialogName.set('');
    this.dialogType.set('newFolder');
  }

  // Abre el dialogo para renombrar
  protected askRename(entry: Entry): void {
    this.resetDialog();
    this.target.set(entry);
    this.dialogName.set(entry.kind === 'folder' ? entry.folder.name : entry.file.name);
    this.dialogType.set('rename');
  }

  // Pide confirmacion para enviar a la papelera
  protected askDelete(entry: Entry): void {
    this.resetDialog();
    this.target.set(entry);
    this.dialogType.set('delete');
  }

  // Abre el selector de carpeta destino
  protected askMove(entry: Entry): void {
    this.resetDialog();
    this.target.set(entry);
    this.dialogType.set('move');
  }

  // Abre el dialogo de compartir
  protected openShare(entry: Entry): void {
    this.shareTarget.set(entry);
  }

  // Cierra cualquier dialogo abierto
  protected closeDialog(): void {
    this.dialogType.set(null);
    this.target.set(null);
    this.dialogError.set('');
    this.busy.set(false);
  }

  // Limpia el estado de los dialogos
  private resetDialog(): void {
    this.dialogError.set('');
    this.busy.set(false);
  }

  // Crea la carpeta con el nombre escrito
  protected confirmNewFolder(): void {
    const name = this.dialogName().trim();
    if (!name) {
      this.dialogError.set('El nombre es obligatorio');
      return;
    }
    this.runAction(this.foldersApi.create(name, this.folderId()), 'Carpeta creada');
  }

  // Guarda el nuevo nombre
  protected confirmRename(): void {
    const entry = this.target();
    const name = this.dialogName().trim();
    if (!entry) {
      return;
    }
    if (!name) {
      this.dialogError.set('El nombre es obligatorio');
      return;
    }
    const request =
      entry.kind === 'folder'
        ? this.foldersApi.rename(entry.folder.id, name)
        : this.filesApi.rename(entry.file.id, name);
    this.runAction(request, 'Nombre actualizado');
  }

  // Envia el elemento a la papelera
  protected confirmDelete(): void {
    const entry = this.target();
    if (!entry) {
      return;
    }
    const request =
      entry.kind === 'folder'
        ? this.foldersApi.trash(entry.folder.id)
        : this.filesApi.trash(entry.file.id);
    this.runAction(request, 'Enviado a la papelera');
  }

  // Mueve el elemento a la carpeta elegida (null = raiz)
  protected confirmMove(destinationId: string | null): void {
    const entry = this.target();
    if (!entry) {
      return;
    }
    const request =
      entry.kind === 'folder'
        ? this.foldersApi.move(entry.folder.id, destinationId)
        : this.filesApi.move(entry.file.id, destinationId);
    this.runAction(request, 'Movido correctamente');
  }

  // Ejecuta la accion de la ventana; si falla, el mensaje del servidor se muestra dentro de ella
  private runAction(request: Observable<unknown>, okMessage: string): void {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.dialogError.set('');
    request.subscribe({
      next: () => {
        this.toast.success(okMessage);
        this.closeDialog();
        this.reload$.next();
      },
      error: (err) => {
        this.busy.set(false);
        this.dialogError.set(errorMessage(err));
      },
    });
  }

  // ---------- Descarga ----------

  // Descarga el archivo en el equipo
  protected download(file: FileItem): void {
    this.filesApi.download(file.id).subscribe({
      next: (blob) => saveBlob(blob, file.name),
      error: () => this.toast.error('No se pudo descargar el archivo'),
    });
  }

  // ---------- Subida ----------

  // Sube los archivos elegidos con el selector
  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const list = input.files ? Array.from(input.files) : [];
    input.value = '';
    this.uploadFiles(list);
  }

  // Muestra la zona de soltar archivos
  protected onDragEnter(event: DragEvent): void {
    if (!this.canUpload() || !event.dataTransfer?.types.includes('Files')) {
      return;
    }
    event.preventDefault();
    this.dragDepth++;
    this.dragging.set(true);
  }

  // Permite soltar archivos sobre la pantalla
  protected onDragOver(event: DragEvent): void {
    if (this.canUpload()) {
      event.preventDefault();
    }
  }

  // Oculta la zona de soltar al salir
  protected onDragLeave(): void {
    if (this.dragDepth > 0) {
      this.dragDepth--;
    }
    if (this.dragDepth === 0) {
      this.dragging.set(false);
    }
  }

  // Sube los archivos soltados
  protected onDrop(event: DragEvent): void {
    // Siempre se evita que el navegador abra el archivo soltado
    event.preventDefault();
    this.dragDepth = 0;
    this.dragging.set(false);
    if (this.canUpload()) {
      this.uploadFiles(Array.from(event.dataTransfer?.files ?? []));
    }
  }

  // Sube los archivos uno por uno (el servidor recibe uno por peticion)
  private uploadFiles(list: File[]): void {
    const valid: File[] = [];
    const rejected: string[] = [];

    for (const file of list) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        rejected.push(file.name + ': solo se permiten .txt y .md');
      } else if (file.size > MAX_FILE_SIZE) {
        rejected.push(file.name + ': supera los 5 MB');
      } else {
        valid.push(file);
      }
    }

    if (rejected.length > 0) {
      this.toast.error(rejected.join(' | '));
    }
    if (valid.length === 0) {
      return;
    }

    let processed = 0;
    let uploaded = 0;
    this.upload.set({ total: valid.length, done: 0 });

    from(valid)
      .pipe(
        concatMap((file) =>
          this.filesApi.upload(file, this.folderId()).pipe(
            map(() => true),
            catchError((err) => {
              this.toast.error(file.name + ': ' + errorMessage(err));
              return of(false);
            })
          )
        ),
        finalize(() => {
          this.upload.set(null);
          if (uploaded > 0) {
            this.toast.success(uploaded === 1 ? 'Archivo subido' : uploaded + ' archivos subidos');
          }
          this.auth.refreshUser();
          this.reload$.next();
        })
      )
      .subscribe((success) => {
        processed++;
        if (success) {
          uploaded++;
        }
        this.upload.set({ total: valid.length, done: processed });
      });
  }
}
