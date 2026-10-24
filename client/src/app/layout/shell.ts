import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { formatSize } from '../shared/format';
import { Icon } from '../shared/icon';

// Estructura de toda la aplicacion: menu lateral y zona de contenido
@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell {
  protected readonly auth = inject(AuthService);

  protected readonly formatSize = formatSize;

  // Porcentaje del espacio asignado que ya se usa (0 a 100)
  protected usedPercent(): number {
    const user = this.auth.user();
    if (!user || !user.storageQuota) {
      return 0;
    }
    return Math.min(100, Math.round((user.storageUsed / user.storageQuota) * 100));
  }

  // Cierra la sesion
  protected logout(): void {
    this.auth.logout();
  }
}
