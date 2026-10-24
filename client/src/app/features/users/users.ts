import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, Subject, catchError, debounceTime, switchMap, tap } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { Role, User } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { UsersService } from '../../core/users.service';
import { Autofocus } from '../../shared/autofocus';
import { formatSize } from '../../shared/format';
import { Icon } from '../../shared/icon';
import { Modal } from '../../shared/modal';

type DialogType = 'form' | 'deactivate';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 6;

// Administracion de usuarios: crear, editar, activar y desactivar (solo administrador)
@Component({
  selector: 'app-users',
  imports: [DatePipe, FormsModule, Icon, Modal, Autofocus],
  templateUrl: './users.html',
  styleUrl: './users.css',
})
export class Users {
  private readonly api = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected readonly formatSize = formatSize;

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  // Filtros (se consultan en el servidor)
  protected readonly search = signal('');
  protected readonly role = signal('');
  protected readonly status = signal('');

  protected readonly dialog = signal<DialogType | null>(null);
  protected readonly editing = signal<User | null>(null); // null = se esta creando uno nuevo
  protected readonly target = signal<User | null>(null); // usuario que se va a desactivar
  protected readonly formName = signal('');
  protected readonly formEmail = signal('');
  protected readonly formPassword = signal('');
  protected readonly formRole = signal<Role>('user');
  protected readonly showPassword = signal(false);
  protected readonly formError = signal('');
  protected readonly busy = signal(false);

  protected readonly isCreate = computed(() => this.editing() === null);
  protected readonly editingSelf = computed(() => {
    const user = this.editing();
    return !!user && this.isSelf(user);
  });

  private readonly reload$ = new Subject<void>();
  private readonly search$ = new Subject<void>();

  constructor() {
    // Cada recarga cancela la consulta anterior que siga en curso
    this.reload$
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.error.set('');
        }),
        switchMap(() =>
          this.fetch().pipe(
            catchError((err) => {
              this.loading.set(false);
              this.error.set(errorMessage(err));
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((res) => {
        this.users.set(res.users);
        this.loading.set(false);
      });

    // La busqueda espera a que se deje de escribir
    this.search$.pipe(debounceTime(300), takeUntilDestroyed()).subscribe(() => this.reload$.next());

    this.reload$.next();
  }

  private fetch(): Observable<{ users: User[] }> {
    const status = this.status();
    return this.api.list({
      search: this.search().trim(),
      role: this.role(),
      active: status === 'active' ? 'true' : status === 'inactive' ? 'false' : '',
    });
  }

  protected isSelf(user: User): boolean {
    return user.id === this.auth.user()?.id;
  }

  // ---------- Filtros ----------

  protected onSearch(value: string): void {
    this.search.set(value);
    this.search$.next();
  }

  protected onRole(value: string): void {
    this.role.set(value);
    this.reload$.next();
  }

  protected onStatus(value: string): void {
    this.status.set(value);
    this.reload$.next();
  }

  // ---------- Crear y editar ----------

  protected openCreate(): void {
    this.editing.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPassword.set('');
    this.formRole.set('user');
    this.openForm();
  }

  protected openEdit(user: User): void {
    this.editing.set(user);
    this.formName.set(user.name);
    this.formEmail.set(user.email);
    this.formPassword.set('');
    this.formRole.set(user.role);
    this.openForm();
  }

  private openForm(): void {
    this.showPassword.set(false);
    this.formError.set('');
    this.busy.set(false);
    this.dialog.set('form');
  }

  protected closeDialog(): void {
    this.dialog.set(null);
    this.editing.set(null);
    this.target.set(null);
    this.formError.set('');
    this.busy.set(false);
  }

  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  protected submitForm(): void {
    if (this.busy()) {
      return;
    }
    const name = this.formName().trim();
    const email = this.formEmail().trim();
    const password = this.formPassword();
    const role = this.formRole();
    const user = this.editing();

    if (!name) {
      this.formError.set('El nombre es obligatorio');
      return;
    }

    if (!user) {
      if (!EMAIL_REGEX.test(email)) {
        this.formError.set('El correo no es valido');
        return;
      }
      if (password.length < MIN_PASSWORD) {
        this.formError.set('La contrasena debe tener al menos ' + MIN_PASSWORD + ' caracteres');
        return;
      }
      this.runForm(this.api.create({ name, email, password, role }), 'Usuario creado', false);
      return;
    }

    if (password && password.length < MIN_PASSWORD) {
      this.formError.set('La contrasena debe tener al menos ' + MIN_PASSWORD + ' caracteres');
      return;
    }
    // Solo se envia lo que cambio
    const body: { name?: string; role?: Role; password?: string } = {};
    if (name !== user.name) {
      body.name = name;
    }
    if (role !== user.role) {
      body.role = role;
    }
    if (password) {
      body.password = password;
    }
    if (Object.keys(body).length === 0) {
      this.formError.set('No hiciste ningun cambio');
      return;
    }
    this.runForm(this.api.update(user.id, body), 'Usuario actualizado', this.isSelf(user));
  }

  private runForm(request: Observable<unknown>, okMessage: string, refreshSession: boolean): void {
    this.busy.set(true);
    this.formError.set('');
    request.subscribe({
      next: () => {
        this.toast.success(okMessage);
        this.closeDialog();
        this.reload$.next();
        // Si el administrador se edito a si mismo, el menu debe mostrar sus datos nuevos
        if (refreshSession) {
          this.auth.restoreSession().subscribe();
        }
      },
      error: (err) => {
        this.busy.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  // ---------- Activar y desactivar ----------

  protected askDeactivate(user: User): void {
    this.target.set(user);
    this.formError.set('');
    this.busy.set(false);
    this.dialog.set('deactivate');
  }

  protected confirmDeactivate(): void {
    const user = this.target();
    if (!user || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.formError.set('');
    this.api.setActive(user.id, false).subscribe({
      next: () => {
        this.toast.success('Usuario desactivado');
        this.closeDialog();
        this.reload$.next();
      },
      error: (err) => {
        this.busy.set(false);
        this.formError.set(errorMessage(err));
      },
    });
  }

  protected activate(user: User): void {
    this.api.setActive(user.id, true).subscribe({
      next: () => {
        this.toast.success('Usuario activado');
        this.reload$.next();
      },
      error: (err) => this.toast.error(errorMessage(err)),
    });
  }
}
