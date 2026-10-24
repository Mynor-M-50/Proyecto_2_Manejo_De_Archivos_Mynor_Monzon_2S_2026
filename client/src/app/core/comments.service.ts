import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './config';

export interface CommentItem {
  id: string;
  fileId: string;
  author: { id: string; name: string };
  text: string;
  createdAt: string;
}

// Llamadas al servidor para los comentarios de un archivo
@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly http = inject(HttpClient);

  // Comentarios de un archivo
  list(fileId: string) {
    return this.http.get<{ comments: CommentItem[] }>(`${API_URL}/files/${fileId}/comments`);
  }

  // Agrega un comentario al archivo
  create(fileId: string, text: string) {
    return this.http.post<{ comment: CommentItem }>(`${API_URL}/files/${fileId}/comments`, { text });
  }

  // Borra un comentario (autor o propietario)
  remove(fileId: string, commentId: string) {
    return this.http.delete<{ message: string }>(`${API_URL}/files/${fileId}/comments/${commentId}`);
  }
}
