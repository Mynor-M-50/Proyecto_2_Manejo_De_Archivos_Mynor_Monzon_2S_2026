import { Routes } from '@angular/router';
import { Shell } from './layout/shell';
import { adminGuard, authGuard, guestGuard } from './core/guards';
import { viewerCanDeactivate } from './features/files/viewer.guard';

const placeholder = () => import('./features/placeholder/placeholder').then((m) => m.Placeholder);
const explorer = () => import('./features/files/explorer').then((m) => m.Explorer);
const viewer = () => import('./features/files/viewer').then((m) => m.Viewer);

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'files' },
      { path: 'files', loadComponent: explorer },
      { path: 'files/:folderId', loadComponent: explorer },
      { path: 'view/:fileId', loadComponent: viewer, canDeactivate: [viewerCanDeactivate] },
      { path: 'shared', loadComponent: () => import('./features/sharing/shared').then((m) => m.Shared) },
      { path: 'trash', loadComponent: () => import('./features/trash/trash').then((m) => m.Trash) },
      { path: 'reports', loadComponent: placeholder, data: { title: 'Reportes' } },
      { path: 'users', canActivate: [adminGuard], loadComponent: placeholder, data: { title: 'Usuarios' } },
    ],
  },
  { path: '**', redirectTo: '' },
];
