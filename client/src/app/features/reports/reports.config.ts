import { ReportResponse } from '../../core/reports.service';
import { permissionLabel } from '../../core/shares.service';
import { formatSize } from '../../shared/format';

// ---------- Textos y formatos ----------

export const ACTION_LABELS: Record<string, string> = {
  'auth.login': 'Inicio de sesion',
  'folder.create': 'Crear carpeta',
  'folder.rename': 'Renombrar carpeta',
  'folder.move': 'Mover carpeta',
  'folder.trash': 'Carpeta a la papelera',
  'folder.restore': 'Restaurar carpeta',
  'folder.delete': 'Eliminar carpeta definitivamente',
  'file.upload': 'Subir archivo',
  'file.view': 'Ver archivo',
  'file.download': 'Descargar archivo',
  'file.edit': 'Editar archivo',
  'file.rename': 'Renombrar archivo',
  'file.move': 'Mover archivo',
  'file.trash': 'Archivo a la papelera',
  'file.restore': 'Restaurar archivo',
  'file.delete': 'Eliminar archivo definitivamente',
  'share.create': 'Compartir',
  'share.update': 'Cambiar permiso',
  'share.remove': 'Quitar acceso',
  'comment.create': 'Comentar',
  'comment.delete': 'Borrar comentario',
  'user.create': 'Crear usuario',
  'user.update': 'Editar usuario',
  'user.activate': 'Activar usuario',
  'user.deactivate': 'Desactivar usuario',
  'trash.empty': 'Vaciar papelera',
};

const RESOURCE_TYPE_LABELS: Record<string, string> = { file: 'Archivo', folder: 'Carpeta', user: 'Usuario' };
const STATUS_LABELS: Record<string, string> = { activo: 'Activo', 'en papelera': 'En papelera', eliminado: 'Eliminado' };

export const actionLabel = (code: string): string => ACTION_LABELS[code] ?? code;
const typeLabel = (type: string): string => RESOURCE_TYPE_LABELS[type] ?? type;
const statusLabel = (status: string): string => STATUS_LABELS[status] ?? status;

const pad = (n: number): string => String(n).padStart(2, '0');

// Fecha y hora como dd/mm/aaaa hh:mm
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    return '';
  }
  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}

// Los detalles de una operacion llegan como objeto: se muestran como "clave: valor"
function details(row: any): string {
  const data = row.details;
  if (!data || typeof data !== 'object') {
    return '';
  }
  return Object.entries(data)
    .map(([key, value]) => key + ': ' + String(value))
    .join(', ');
}

// ---------- Filtros de cada reporte ----------

export interface FieldOption {
  value: string;
  label: string;
}

export interface ParamField {
  label: string;
  kind: 'date' | 'number' | 'checkbox' | 'select' | 'user';
  options?: FieldOption[];
}

const ALL = (label: string): FieldOption => ({ value: '', label });

// Nombres de filtro que entiende el servidor
export const PARAM_FIELDS: Record<string, ParamField> = {
  from: { label: 'Desde', kind: 'date' },
  to: { label: 'Hasta', kind: 'date' },
  limit: { label: 'Cantidad maxima de filas', kind: 'number' },
  includeTrash: { label: 'Incluir archivos de la papelera', kind: 'checkbox' },
  ext: { label: 'Tipo de archivo', kind: 'select', options: [ALL('Todos'), { value: 'txt', label: '.txt' }, { value: 'md', label: '.md' }] },
  ownerId: { label: 'Propietario', kind: 'user' },
  userId: { label: 'Usuario', kind: 'user' },
  permission: {
    label: 'Permiso',
    kind: 'select',
    options: [ALL('Todos'), { value: 'read', label: 'Lectura' }, { value: 'comment', label: 'Comentar' }, { value: 'edit', label: 'Edicion' }],
  },
  resourceType: {
    label: 'Tipo de recurso',
    kind: 'select',
    options: [ALL('Todos'), { value: 'file', label: 'Archivos' }, { value: 'folder', label: 'Carpetas' }],
  },
  action: {
    label: 'Accion',
    kind: 'select',
    options: [ALL('Todas'), ...Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))],
  },
  period: {
    label: 'Agrupar por',
    kind: 'select',
    options: [{ value: 'day', label: 'Dia' }, { value: 'week', label: 'Semana' }, { value: 'month', label: 'Mes' }],
  },
};

// Filtros que solo tiene sentido mostrar al administrador (un usuario siempre ve lo suyo)
export const ADMIN_ONLY_PARAMS = ['userId', 'ownerId'];

// ---------- Columnas de cada reporte ----------

export interface ReportColumn {
  header: string;
  value: (row: any) => string | number;
  align?: 'right';
}

export interface ReportDef {
  filename: string;
  columns: ReportColumn[];
  // Reportes con un usuario "seleccionado": si no se elige, es el propio usuario.
  // Los 'optional' sin elegir significan "todos los usuarios" (solo para el administrador).
  userMode?: 'selected' | 'optional';
  limit?: { default: number; max: number };
  // Barra proporcional al valor, para ver la comparacion de un vistazo
  bar?: { header: string; value: (row: any) => number };
  summary?: (res: ReportResponse) => string;
}

const shownOf = (res: ReportResponse): string =>
  res.total !== undefined && res.items.length < res.total
    ? ' (se muestran ' + res.items.length + ')'
    : '';

const sharesColumns = (who: ReportColumn[]): ReportColumn[] => [
  { header: 'Recurso', value: (r) => r.resourceName ?? '(sin nombre)' },
  { header: 'Tipo', value: (r) => typeLabel(r.resourceType) },
  { header: 'Estado', value: (r) => statusLabel(r.resourceStatus) },
  ...who,
  { header: 'Permiso', value: (r) => permissionLabel(r.permission) },
  { header: 'Fecha', value: (r) => formatDateTime(r.createdAt) },
];

export const REPORTS: Record<string, ReportDef> = {
  'files-by-type': {
    filename: 'archivos-por-tipo',
    columns: [
      { header: 'Tipo', value: (r) => '.' + r.type },
      { header: 'Cantidad de archivos', value: (r) => r.count, align: 'right' },
      { header: 'Espacio ocupado', value: (r) => formatSize(r.totalSize), align: 'right' },
    ],
    bar: { header: 'Proporcion', value: (r) => r.count },
    summary: (res) => 'Total de archivos: ' + res.items.reduce((sum, r) => sum + r.count, 0),
  },

  'files-by-date': {
    filename: 'archivos-por-fecha',
    limit: { default: 200, max: 1000 },
    columns: [
      { header: 'Archivo', value: (r) => r.name },
      { header: 'Propietario', value: (r) => r.owner ?? '' },
      { header: 'Tamano', value: (r) => formatSize(r.size), align: 'right' },
      { header: 'Almacenado', value: (r) => formatDateTime(r.createdAt) },
      { header: 'Estado', value: (r) => (r.deletedAt ? 'En papelera' : 'Activo') },
    ],
    summary: (res) => 'Archivos encontrados: ' + (res.total ?? res.items.length) + shownOf(res),
  },

  'files-most-operations': {
    filename: 'archivos-con-mas-operaciones',
    limit: { default: 10, max: 100 },
    columns: [
      { header: 'Archivo', value: (r) => r.name },
      { header: 'Operaciones', value: (r) => r.operations, align: 'right' },
      { header: 'Ultima actividad', value: (r) => formatDateTime(r.lastActivity) },
      { header: 'Estado', value: (r) => statusLabel(r.status) },
    ],
    bar: { header: 'Comparacion', value: (r) => r.operations },
  },

  'top-users-by-files': {
    filename: 'usuarios-con-mas-archivos',
    limit: { default: 10, max: 100 },
    columns: [
      { header: 'Usuario', value: (r) => r.name },
      { header: 'Correo', value: (r) => r.email },
      { header: 'Archivos', value: (r) => r.files, align: 'right' },
      { header: 'Espacio ocupado', value: (r) => formatSize(r.totalSize), align: 'right' },
    ],
    bar: { header: 'Comparacion', value: (r) => r.files },
  },

  'top-users-by-shares': {
    filename: 'usuarios-con-mas-compartidos',
    limit: { default: 10, max: 100 },
    columns: [
      { header: 'Usuario', value: (r) => r.name },
      { header: 'Correo', value: (r) => r.email },
      { header: 'Recursos compartidos', value: (r) => r.resources, align: 'right' },
      { header: 'Permisos otorgados', value: (r) => r.permissionsGranted, align: 'right' },
    ],
    bar: { header: 'Comparacion', value: (r) => r.resources },
  },

  'most-shared-files': {
    filename: 'archivos-compartidos-con-mas-usuarios',
    limit: { default: 10, max: 100 },
    columns: [
      { header: 'Archivo', value: (r) => r.name },
      { header: 'Propietario', value: (r) => r.owner ?? '' },
      { header: 'Compartido con', value: (r) => r.users + (r.users === 1 ? ' usuario' : ' usuarios'), align: 'right' },
      { header: 'Estado', value: (r) => statusLabel(r.status) },
    ],
    bar: { header: 'Comparacion', value: (r) => r.users },
  },

  'never-shared-files': {
    filename: 'archivos-nunca-compartidos',
    userMode: 'optional',
    limit: { default: 100, max: 1000 },
    columns: [
      { header: 'Archivo', value: (r) => r.name },
      { header: 'Propietario', value: (r) => r.owner ?? '' },
      { header: 'Tamano', value: (r) => formatSize(r.size), align: 'right' },
      { header: 'Almacenado', value: (r) => formatDateTime(r.createdAt) },
    ],
    summary: (res) => 'Archivos que nunca se han compartido: ' + (res.total ?? res.items.length) + shownOf(res),
  },

  'folders-most-files': {
    filename: 'carpetas-con-mas-archivos',
    userMode: 'optional',
    limit: { default: 10, max: 100 },
    columns: [
      { header: 'Carpeta', value: (r) => r.name },
      { header: 'Propietario', value: (r) => r.owner ?? '' },
      { header: 'Archivos', value: (r) => r.files, align: 'right' },
      { header: 'Espacio ocupado', value: (r) => formatSize(r.totalSize), align: 'right' },
    ],
    bar: { header: 'Comparacion', value: (r) => r.files },
  },

  'shared-by-user': {
    filename: 'recursos-compartidos-por-usuario',
    userMode: 'selected',
    columns: sharesColumns([
      { header: 'Compartido con', value: (r) => r.sharedWith ?? '' },
      { header: 'Correo', value: (r) => r.sharedWithEmail ?? '' },
    ]),
    summary: (res) => 'Recursos compartidos: ' + (res.total ?? res.items.length),
  },

  'shared-with-user': {
    filename: 'recursos-recibidos-por-usuario',
    userMode: 'selected',
    columns: sharesColumns([{ header: 'Propietario', value: (r) => r.owner ?? '' }]),
    summary: (res) => 'Recursos recibidos: ' + (res.total ?? res.items.length),
  },

  'user-activity': {
    filename: 'historial-de-actividad',
    userMode: 'selected',
    limit: { default: 100, max: 500 },
    columns: [
      { header: 'Fecha', value: (r) => formatDateTime(r.createdAt) },
      { header: 'Accion', value: (r) => actionLabel(r.action) },
      { header: 'Tipo', value: (r) => typeLabel(r.resourceType) },
      { header: 'Recurso', value: (r) => r.resourceName ?? '' },
      { header: 'Detalle', value: (r) => details(r) },
    ],
    summary: (res) => 'Operaciones: ' + (res.total ?? res.items.length) + shownOf(res) + '. Las mas recientes primero.',
  },

  'operations-by-type': {
    filename: 'operaciones-por-tipo',
    userMode: 'optional',
    columns: [
      { header: 'Operacion', value: (r) => actionLabel(r.action) },
      { header: 'Cantidad', value: (r) => r.count, align: 'right' },
    ],
    bar: { header: 'Proporcion', value: (r) => r.count },
    summary: (res) => 'Total de operaciones: ' + (res.total ?? 0),
  },

  'operations-by-period': {
    filename: 'operaciones-por-periodo',
    userMode: 'optional',
    columns: [
      { header: 'Periodo', value: (r) => r.period },
      { header: 'Cantidad', value: (r) => r.count, align: 'right' },
    ],
    bar: { header: 'Proporcion', value: (r) => r.count },
    summary: (res) => 'Total de operaciones: ' + (res.total ?? 0),
  },

  'top-actions': {
    filename: 'principales-acciones',
    userMode: 'optional',
    limit: { default: 5, max: 50 },
    columns: [
      { header: 'Accion', value: (r) => actionLabel(r.action) },
      { header: 'Cantidad', value: (r) => r.count, align: 'right' },
      { header: 'Porcentaje', value: (r) => r.percentage + ' %', align: 'right' },
    ],
    bar: { header: 'Proporcion', value: (r) => r.count },
    summary: (res) => 'Total de operaciones: ' + (res.total ?? 0),
  },
};
