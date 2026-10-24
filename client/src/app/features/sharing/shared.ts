import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { errorMessage } from '../../core/errors';
import {
  PERMISSIONS,
  Permission,
  ShareItem,
  SharesService,
  permissionLabel,
} from '../../core/shares.service';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';

type Tab = 'with' | 'by';

// Compartidos: lo que otros compartieron conmigo y lo que yo comparti con otros
@Component({
  selector: 'app-shared',
  imports: [DatePipe, FormsModule, RouterLink, Icon],
  templateUrl: './shared.html',
  styleUrl: './shared.css',
})
export class Shared {
  private readonly api = inject(SharesService);
  private readonly toast = inject(ToastService);

  protected readonly permissions = PERMISSIONS;
  protected readonly permissionLabel = permissionLabel;

  protected readonly tab = signal<Tab>('with');
  protected readonly withMe = signal<ShareItem[]>([]);
  protected readonly byMe = signal<ShareItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly filter = signal('');
  protected readonly confirmingId = signal<string | null>(null);

  protected readonly visibleWith = computed(() =>
    this.matching(this.withMe(), (s) => [s.resource.name, s.owner.name])
  );
  protected readonly visibleBy = computed(() =>
    this.matching(this.byMe(), (s) => [s.resource.name, s.sharedWith.name, s.sharedWith.email])
  );

  constructor() {
    this.load();
  }

  // Un archivo se abre en el visor; una carpeta, en el explorador
  protected linkFor(share: ShareItem): string[] {
    return share.resourceType === 'folder' ? ['/files', share.resourceId] : ['/view', share.resourceId];
  }

  protected changePermission(share: ShareItem, value: Permission): void {
    if (value === share.permission) {
      return;
    }
    this.api.update(share.id, value).subscribe({
      next: () => {
        this.byMe.update((list) => list.map((s) => (s.id === share.id ? { ...s, permission: value } : s)));
        this.toast.success('Permiso actualizado');
      },
      error: (err) => {
        this.toast.error(errorMessage(err));
        // Se recarga para que la lista desplegable vuelva al permiso real
        this.byMe.set([]);
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
        this.byMe.update((list) => list.filter((s) => s.id !== share.id));
        this.confirmingId.set(null);
        this.toast.success('Acceso retirado a ' + share.sharedWith.name);
      },
      error: (err) => {
        this.confirmingId.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  private matching(list: ShareItem[], fields: (s: ShareItem) => string[]): ShareItem[] {
    const term = this.filter().trim().toLowerCase();
    if (!term) {
      return list;
    }
    return list.filter((s) => fields(s).some((text) => text.toLowerCase().includes(term)));
  }

  private load(): void {
    this.loading.set(true);
    this.error.set('');
    this.confirmingId.set(null);
    forkJoin({ withMe: this.api.withMe(), byMe: this.api.byMe() }).subscribe({
      next: (res) => {
        this.withMe.set(res.withMe.shares);
        this.byMe.set(res.byMe.shares);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
