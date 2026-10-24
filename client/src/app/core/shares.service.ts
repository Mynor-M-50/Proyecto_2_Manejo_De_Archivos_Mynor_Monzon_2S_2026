import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';

export type Permission = 'read' | 'comment' | 'edit';
export type ResourceType = 'file' | 'folder';

// Un permiso otorgado sobre un archivo o una carpeta
export interface ShareItem {
  id: string;
  resourceType: ResourceType;
  resourceId: string;
  resource: { name: string; ext?: string; size?: number };
  owner: { id: string; name: string };
  sharedWith: { id: string; name: string; email: string };
  permission: Permission;
  createdAt: string;
}

export interface PermissionOption {
  value: Permission;
  label: string;
  hint: string;
}

export const PERMISSIONS: PermissionOption[] = [
  { value: 'read', label: 'Lectura', hint: 'Puede ver y descargar.' },
  { value: 'comment', label: 'Comentar', hint: 'Puede ver, descargar y comentar.' },
  {
    value: 'edit',
    label: 'Edicion',
    hint: 'Puede ver, comentar y editar (renombrar, modificar el contenido y agregar archivos). No puede mover, eliminar ni compartir.',
  },
];

// Texto en espanol de cada permiso
export function permissionLabel(permission: Permission): string {
  return PERMISSIONS.find((p) => p.value === permission)?.label ?? permission;
}

// Llamadas al servidor para compartir
@Injectable({ providedIn: 'root' })
export class SharesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/shares`;

  // Con quien esta compartido un recurso (solo su propietario puede verlo)
  forResource(resourceType: ResourceType, resourceId: string) {
    return this.http.get<{ shares: ShareItem[] }>(this.url, { params: { resourceType, resourceId } });
  }

  // Lo que yo comparti
  byMe() {
    return this.http.get<{ shares: ShareItem[] }>(`${this.url}/by-me`);
  }

  // Lo que otros compartieron conmigo
  withMe() {
    return this.http.get<{ shares: ShareItem[] }>(`${this.url}/with-me`);
  }

  // Comparte un recurso con otro usuario por su correo
  create(body: { resourceType: ResourceType; resourceId: string; email: string; permission: Permission }) {
    return this.http.post<{ share: ShareItem }>(this.url, body);
  }

  // Cambia el permiso otorgado
  update(id: string, permission: Permission) {
    return this.http.patch<{ share: ShareItem | null }>(`${this.url}/${id}`, { permission });
  }

  // Retira el permiso
  remove(id: string) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}
