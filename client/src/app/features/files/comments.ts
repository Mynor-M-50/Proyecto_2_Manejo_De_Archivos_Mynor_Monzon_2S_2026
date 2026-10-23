import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { CommentItem, CommentsService } from '../../core/comments.service';
import { errorMessage } from '../../core/errors';
import { Access } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { Icon } from '../../shared/icon';

const MAX_LENGTH = 1000;

// Comentarios de un archivo: ver, escribir (con permiso de comentar o mas) y borrar
@Component({
  selector: 'app-comments',
  imports: [DatePipe, FormsModule, Icon],
  templateUrl: './comments.html',
  styleUrl: './comments.css',
})
export class Comments {
  private readonly api = inject(CommentsService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly fileId = input.required<string>();
  readonly access = input.required<Access>();

  protected readonly maxLength = MAX_LENGTH;
  protected readonly comments = signal<CommentItem[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly text = signal('');
  protected readonly sending = signal(false);
  protected readonly confirmingId = signal<string | null>(null);

  // Comentar necesita permiso de comentar, editar o ser el propietario
  protected readonly canComment = computed(() => this.access() !== 'read');

  constructor() {
    effect(() => {
      const id = this.fileId();
      untracked(() => this.load(id));
    });
  }

  // Un comentario lo borra su autor o el propietario del archivo
  protected canDelete(comment: CommentItem): boolean {
    return comment.author.id === this.auth.user()?.id || this.access() === 'owner';
  }

  protected send(): void {
    const text = this.text().trim();
    if (!text || this.sending()) {
      return;
    }
    this.sending.set(true);
    this.api.create(this.fileId(), text).subscribe({
      next: (res) => {
        this.comments.update((list) => [...list, res.comment]);
        this.text.set('');
        this.sending.set(false);
      },
      error: (err) => {
        this.sending.set(false);
        this.toast.error(errorMessage(err));
      },
    });
  }

  protected askRemove(comment: CommentItem): void {
    this.confirmingId.set(comment.id);
  }

  protected remove(comment: CommentItem): void {
    this.api.remove(this.fileId(), comment.id).subscribe({
      next: () => {
        this.comments.update((list) => list.filter((c) => c.id !== comment.id));
        this.confirmingId.set(null);
      },
      error: (err) => {
        this.confirmingId.set(null);
        this.toast.error(errorMessage(err));
      },
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.error.set('');
    this.confirmingId.set(null);
    this.api.list(id).subscribe({
      next: (res) => {
        this.comments.set(res.comments);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(errorMessage(err));
        this.loading.set(false);
      },
    });
  }
}
