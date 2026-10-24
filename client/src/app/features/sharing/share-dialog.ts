import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { errorMessage } from '../../core/errors';
import { PERMISSIONS, Permission, ResourceType, ShareItem, SharesService } from '../../core/shares.service';
import { ToastService } from '../../core/toast.service';
import { Autofocus } from '../../shared/autofocus';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

// Ventana para compartir un archivo o una carpeta: agregar personas, cambiar permisos y quitar acceso
@Component({
  selector: 'app-share-dialog',
  imports: [FormsModule, Icon, Modal, Autofocus],
  templateUrl: './share-dialog.html',
  styleUrl: './share-dialog.css',
})
export class ShareDialog {
  private readonly api = inject(SharesService);
  private readonly toast = inject(ToastService);

  readonly resourceType = input.required<ResourceType>();
  readonly resourceId = input.required<string>();
  readonly resourceName = input.required<string>();
  readonly closed = output<void>();

  protected readonly permissions = PERMISSIONS;

  protected readonly shares = signal<ShareItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  protected readonly email = signal('');
  protected readonly permission = signal<Permission>('read');
  protected readonly adding = signal(false);
  protected readonly formError = signal('');
  protected readonly confirmingId = signal<string | null>(null);

  protected readonly permissionHint = computed(
    () => PERMISSIONS.find((p) => p.value === this.permission())?.hint ?? ''
  );

  constructor() {
    effect(() => {
      this.resourceId();
      untracked(() => this.load());
    });
  }

  protected add(): void {
    if (this.adding()) {
      return;
    }
    const email = this.email().trim();
    if (!email) {
      this.formError.set('Escribe el correo del usuario');
      return;
    }
    if (!email.includes('@')) {
      this.formError.set('El correo no es valido');
      return;
    }

    this.adding.set(true);
    this.formError.set('');
    this.api
      .create({
        resourceType: this.resourceType(),
        resourceId: this.resourceId(),
        email,
        permission: this.permission(),
      })
      .subscribe({
        next: (res) => {
          this.shares.update((list) => [...list, res.share]);
          this.email.set('');
          this.adding.set(false);
          this.toast.success('Compartido con ' + res.share.sharedWith.name);
        },
        error: (err) => {
          this.adding.set(false);
          this.formError.set(errorMessage(err));
        },
      });
  }

  protected changePermission(share: ShareItem, value: Permission): void {
    if (value === share.permission) {
      return;
    }
    this.api.update(share.id, value).subscribe({
      next: () => {
        this.shares.update((list) => list.map((s) => (s.id === share.id ? { ...s, permission: value } : s)));
        this.toast.success('Permiso actualizado');
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        // La lista se vacia y se vuelve a cargar para que la lista desplegable recupere el permiso real
        this.shares.set([]);
        this.load();
      },
    });
  }

  protected askRemove(share: ShareItem): void {
    this.confirmingId.set(share.id);
  }

  protected remove(share: ShareItem): void {
    this.api.remove(share.id).subscribe({
      next: () => {
        this.shares.update((list) => list.filter((s) => s.id !== share.id));
        this.confirmingId.set(null);
        this.toast.success('Acceso retirado a ' + share.sharedWith.name);
      },
      error: (err) => {
        this.confirmingId.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.confirmingId.set(null);
    this.api.forResource(this.resourceType(), this.resourceId()).subscribe({
      next: (res) => {
        this.shares.set(res.shares);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
