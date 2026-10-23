import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';
import { Access, BreadcrumbItem, Folder } from './models';

// Llamadas al servidor para carpetas
@Injectable({ providedIn: 'root' })
export class FoldersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/folders`;

  // Subcarpetas de una carpeta; sin parentId devuelve las de la raiz
  list(parentId?: string) {
    const params: Record<string, string> = {};
    if (parentId) {
      params['parentId'] = parentId;
    }
    return this.http.get<{ folders: Folder[]; access: Access }>(this.url, { params });
  }

  // Una carpeta con su ruta de navegacion y el nivel de acceso del usuario
  get(id: string) {
    return this.http.get<{ folder: Folder; breadcrumb: BreadcrumbItem[]; access: Access }>(
      `${this.url}/${id}`
    );
  }

  create(name: string, parentId?: string) {
    return this.http.post<{ folder: Folder }>(this.url, parentId ? { name, parentId } : { name });
  }

  rename(id: string, name: string) {
    return this.http.patch<{ folder: Folder }>(`${this.url}/${id}/rename`, { name });
  }

  // parentId null mueve la carpeta a la raiz
  move(id: string, parentId: string | null) {
    return this.http.patch<{ folder: Folder }>(`${this.url}/${id}/move`, { parentId });
  }

  // Envia la carpeta (y todo su contenido) a la papelera
  trash(id: string) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}
