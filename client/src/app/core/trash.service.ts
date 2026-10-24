import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';
import { FileExt, FileItem, Folder } from './models';

// Un elemento de la papelera: solo aparece lo que se elimino directamente.
// Lo que cayo junto con una carpeta se cuenta dentro de ella (contains).
export interface TrashItem {
  type: 'file' | 'folder';
  id: string;
  name: string;
  deletedAt: string;
  ext?: FileExt;
  size?: number;
  folderId?: string | null;
  parentId?: string | null;
  contains?: { folders: number; files: number };
}

export interface RestoreFileResult {
  file: FileItem;
  movedToRoot: boolean;
  renamed: boolean;
}

export interface RestoreFolderResult {
  folder: Folder;
  movedToRoot: boolean;
  renamed: boolean;
  folders: number;
  files: number;
}

export interface PurgeResult {
  message: string;
  folders?: number;
  files?: number;
}

// Llamadas al servidor para la papelera
@Injectable({ providedIn: 'root' })
export class TrashService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/trash`;

  list() {
    return this.http.get<{ items: TrashItem[] }>(this.url);
  }

  restoreFile(id: string) {
    return this.http.post<RestoreFileResult>(`${this.url}/files/${id}/restore`, {});
  }

  restoreFolder(id: string) {
    return this.http.post<RestoreFolderResult>(`${this.url}/folders/${id}/restore`, {});
  }

  deleteFile(id: string) {
    return this.http.delete<PurgeResult>(`${this.url}/files/${id}`);
  }

  deleteFolder(id: string) {
    return this.http.delete<PurgeResult>(`${this.url}/folders/${id}`);
  }

  // Elimina de forma definitiva todo lo que hay en la papelera del usuario
  empty() {
    return this.http.delete<PurgeResult>(this.url);
  }
}
