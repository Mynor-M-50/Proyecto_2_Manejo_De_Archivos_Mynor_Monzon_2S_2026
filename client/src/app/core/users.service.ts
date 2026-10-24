import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';
import { Role, User } from './models';

export interface UserFilters {
  search?: string;
  role?: string;
  active?: string; // 'true' o 'false'
}

// Llamadas al servidor para la administracion de usuarios (solo administrador)
@Injectable({ providedIn: 'root' })
export class UsersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/users`;

  list(filters: UserFilters = {}) {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params[key] = value;
      }
    }
    return this.http.get<{ users: User[] }>(this.url, { params });
  }

  create(body: { name: string; email: string; password: string; role: Role }) {
    return this.http.post<{ user: User }>(this.url, body);
  }

  // Solo se envian los campos que cambiaron
  update(id: string, body: { name?: string; role?: Role; password?: string }) {
    return this.http.put<{ user: User }>(`${this.url}/${id}`, body);
  }

  // Activar o desactivar: no se borra nada, solo se bloquea o permite el ingreso
  setActive(id: string, active: boolean) {
    return this.http.patch<{ user: User }>(`${this.url}/${id}/active`, { active });
  }
}
