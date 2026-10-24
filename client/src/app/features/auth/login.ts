import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/errors';
import { Icon } from '../../shared/icon';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Icon],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly email = signal('');
  protected readonly password = signal('');
  protected readonly showPassword = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  // Muestra u oculta la contrasena
  protected togglePassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  // Valida los campos e inicia sesion
  protected submit(): void {
    if (this.loading()) {
      return;
    }
    const email = this.email().trim();
    const password = this.password();
    if (!email || !password) {
      this.error.set('Ingresa tu correo y tu contrasena');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.auth.login(email, password).subscribe({
      next: () => this.router.navigateByUrl('/files'),
      error: (err) => {
        this.loading.set(false);
        this.error.set(errorMessage(err));
      },
    });
  }
}
