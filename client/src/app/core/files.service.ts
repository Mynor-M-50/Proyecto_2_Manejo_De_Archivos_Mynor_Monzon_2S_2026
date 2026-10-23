import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';
import { Access, FileItem } from './models';

export interface FileQuery {
  folderId?: string; // id de carpeta o 'root'; si falta, busca en todos mis archivos
  q?: string;
  ext?: string;
  sort?: string;
  order?: string;
}

// Llamadas al servidor para archivos
@Injectable({ providedIn: 'root' })
export class FilesService {
  private readonly http = inject(HttpClient);
  private readonly url = `${API_URL}/files`;

  list(query: FileQuery) {
    const params: Record<string, string> = {};
    for (const [key, value] of Object.entries(query)) {
      if (value) {
        params[key] = value;
      }
    }
    return this.http.get<{ files: FileItem[]; access: Access }>(this.url, { params });
  }

  // Datos de un archivo y el nivel de acceso del usuario sobre el
  get(id: string) {
    return this.http.get<{ file: FileItem; access: Access }>(`${this.url}/${id}`);
  }

  // Texto del archivo, para mostrarlo o editarlo en pantalla
  content(id: string) {
    return this.http.get<{ file: FileItem; content: string }>(`${this.url}/${id}/content`);
  }

  // Reemplaza el contenido del archivo
  saveContent(id: string, content: string) {
    return this.http.put<{ file: FileItem }>(`${this.url}/${id}/content`, { content });
  }

  // El servidor recibe un archivo por peticion
  upload(file: File, folderId?: string) {
    const form = new FormData();
    form.append('file', file, file.name);
    if (folderId) {
      form.append('folderId', folderId);
    }
    return this.http.post<{ file: FileItem }>(this.url, form);
  }

  download(id: string) {
    return this.http.get(`${this.url}/${id}/download`, { responseType: 'blob' });
  }

  rename(id: string, name: string) {
    return this.http.patch<{ file: FileItem }>(`${this.url}/${id}/rename`, { name });
  }

  // folderId null mueve el archivo a la raiz
  move(id: string, folderId: string | null) {
    return this.http.patch<{ file: FileItem }>(`${this.url}/${id}/move`, { folderId });
  }

  trash(id: string) {
    return this.http.delete<{ message: string }>(`${this.url}/${id}`);
  }
}
