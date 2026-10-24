import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { API_URL } from './config';
import { LoginResponse, User } from './models';

const TOKEN_KEY = 'gd_token';
const USER_KEY = 'gd_user';

// Sesion del usuario: guarda el token JWT y los datos del usuario en el navegador
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly token = signal<string | null>(localStorage.getItem(TOKEN_KEY));
  readonly user = signal<User | null>(this.readStoredUser());
  readonly isLoggedIn = computed(() => !!this.token() && !!this.user());
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  // Inicia sesion y guarda el token y el usuario
  login(email: string, password: string): Observable<User> {
    return this.http.post<LoginResponse>(`${API_URL}/auth/login`, { email, password }).pipe(
      tap((res) => {
        localStorage.setItem(TOKEN_KEY, res.token);
        this.token.set(res.token);
        this.storeUser(res.user);
      }),
      map((res) => res.user)
    );
  }

  // Al abrir la aplicacion se confirma con el servidor que el token siga siendo valido
  restoreSession(): Observable<unknown> {
    if (!this.token()) {
      return of(null);
    }
    return this.http.get<{ user: User }>(`${API_URL}/auth/me`).pipe(
      tap((res) => this.storeUser(res.user)),
      catchError(() => of(null))
    );
  }

  // Vuelve a pedir los datos del usuario para actualizar el espacio usado
  refreshUser(): void {
    this.restoreSession().subscribe();
  }

  // Cierra la sesion y, por defecto, vuelve a la pantalla de login
  logout(redirect = true): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.token.set(null);
    this.user.set(null);
    if (redirect) {
      this.router.navigateByUrl('/login');
    }
  }

  // Guarda el usuario en memoria y en el navegador
  private storeUser(user: User): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  // Lee el usuario guardado; si el dato esta danado devuelve null
  private readStoredUser(): User | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
