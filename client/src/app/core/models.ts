export type Role = 'admin' | 'user';
export type Access = 'owner' | 'edit' | 'comment' | 'read';
export type FileExt = 'txt' | 'md';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  storageUsed: number;
  createdAt: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Folder {
  id: string;
  ownerId: string;
  parentId: string | null;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface FileItem {
  id: string;
  ownerId: string;
  folderId: string | null;
  name: string;
  ext: FileExt;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
}
