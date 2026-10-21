# Modelo documental - Sistema de Gestion Documental

Base de datos: `gestion_documental` (MongoDB).
Colecciones propias: `users`, `folders`, `files`, `shares`, `comments`, `activity_logs`.
Colecciones de GridFS (las crea el driver): `fs.files`, `fs.chunks`.

## 1. Vista general

| Coleccion | Proposito |
|---|---|
| `users` | Cuentas, rol, estado activo/inactivo y espacio usado |
| `folders` | Jerarquia de carpetas y subcarpetas por usuario |
| `files` | Metadatos de cada archivo (.txt y .md) y referencia a su contenido |
| `fs.files` / `fs.chunks` | Contenido real de los archivos (GridFS) |
| `shares` | Permisos otorgados sobre archivos y carpetas |
| `comments` | Comentarios sobre archivos (permiso "comentar") |
| `activity_logs` | Historial de operaciones para auditoria y reportes |

## 2. Colecciones y campos

### users

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | |
| `email` | string | Unico |
| `passwordHash` | string | bcrypt |
| `role` | string | `admin` o `user` |
| `active` | boolean | Un usuario inactivo no puede iniciar sesion; no se borra nada |
| `storageUsed` | number | Bytes de todos sus archivos existentes (incluye papelera) |
| `createdAt`, `updatedAt` | date | |

### folders

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `ownerId` | ObjectId | Referencia a `users` |
| `parentId` | ObjectId o null | Referencia a `folders`; null = raiz |
| `name` | string | |
| `ancestors` | array de ObjectId | Ids de todos los padres, de la raiz hacia abajo |
| `deletedAt` | date o null | null = activa; con fecha = en papelera |
| `createdAt`, `updatedAt` | date | |

### files

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `ownerId` | ObjectId | Referencia a `users` |
| `folderId` | ObjectId o null | Referencia a `folders`; null = raiz |
| `name` | string | |
| `ext` | string | `txt` o `md` |
| `mimeType` | string | `text/plain` o `text/markdown` |
| `size` | number | Bytes |
| `gridfsId` | ObjectId | Referencia a `fs.files._id` |
| `deletedAt` | date o null | null = activo; con fecha = en papelera |
| `createdAt`, `updatedAt` | date | |

### fs.files y fs.chunks (GridFS)

El contenido de cada archivo se guarda en MongoDB en fragmentos de 255 KB. El campo `metadata` de `fs.files` guarda `ownerId`, `ext` y `mimeType`.

### shares

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `ownerId` | ObjectId | Quien comparte |
| `sharedWithId` | ObjectId | Quien recibe |
| `resourceType` | string | `file` o `folder` |
| `resourceId` | ObjectId | Id del archivo o de la carpeta |
| `permission` | string | `read`, `comment` o `edit` |
| `createdAt`, `updatedAt` | date | |

### comments

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `fileId` | ObjectId | Referencia a `files` |
| `userId` | ObjectId | Autor del comentario |
| `text` | string | |
| `createdAt`, `updatedAt` | date | |

### activity_logs

| Campo | Tipo | Notas |
|---|---|---|
| `_id` | ObjectId | |
| `userId` | ObjectId | Quien realizo la accion |
| `action` | string | Ver lista abajo |
| `resourceType` | string | `file`, `folder` o `user` |
| `resourceId` | ObjectId | |
| `resourceName` | string | Copia del nombre al momento de la accion |
| `details` | objeto | Estructura variable segun la accion |
| `createdAt` | date | |

Acciones: `auth.login`, `folder.create`, `folder.trash`, `file.upload`, `file.trash`, `file.view`, `file.download`, `file.edit`, `file.rename`, `file.move`, `share.create`, `comment.create`. El backend agrega ademas restauracion, eliminacion definitiva y cambios o retiro de permisos.

## 3. Documentos embebidos vs referencias

| Dato | Decision | Justificacion |
|---|---|---|
| Contenido del archivo | GridFS, referenciado con `files.gridfsId` | Un documento BSON tiene limite de 16 MB; GridFS divide el contenido en fragmentos y no tiene ese limite. Los metadatos quedan en `files`, asi se listan y filtran sin leer el contenido. |
| `files.ownerId`, `folders.ownerId` | Referencia a `users` | Un usuario tiene muchos archivos y carpetas. Su estado (activo, rol) cambia sin tocar sus recursos. |
| `files.folderId`, `folders.parentId` | Referencia | Mover un recurso es cambiar un solo campo. |
| `folders.ancestors` | Arreglo embebido | Dato derivado que siempre se lee junto con la carpeta. Evita consultas recursivas (`$graphLookup`) para detectar ciclos, heredar permisos y mandar a papelera en cascada. Costo: al mover una carpeta hay que actualizar `ancestors` de sus descendientes. |
| Permisos | Coleccion `shares`, referencia | Los reportes piden recursos compartidos por un usuario, recibidos por un usuario y archivos compartidos con mas usuarios. Con una sola coleccion cada reporte es un `$match` o `$group` directo. Si fueran embebidos en `files` y `folders` habria que unir ambas colecciones en cada reporte, y cada compartir modificaria el documento del recurso. |
| Comentarios | Coleccion aparte | Crecen sin limite, se consultan por archivo y no siempre se cargan junto con el archivo. Embebidos harian crecer el documento de `files`. |
| Historial | Coleccion aparte, solo se agrega | Crece sin limite y se consulta por usuario, recurso, tipo y fechas. |
| `activity_logs.details` | Objeto embebido | Cada accion guarda datos distintos (permiso otorgado, destino de un movimiento, nombre nuevo). Es el caso donde la flexibilidad de documentos conviene. |
| `activity_logs.resourceName` | Copia del nombre | El historial debe seguir siendo legible aunque el recurso se elimine de forma definitiva. |

## 4. Indices

| Coleccion | Indice | Para que sirve |
|---|---|---|
| `users` | `{ email: 1 }` unico | Login y evitar correos repetidos |
| `folders` | `{ ownerId, parentId, deletedAt }` | Listar el contenido de una carpeta y la papelera |
| `folders` | `{ ancestors: 1 }` | Encontrar descendientes (mover, papelera en cascada, ciclos) |
| `files` | `{ ownerId, folderId, deletedAt }` | Listar archivos de una carpeta y la papelera |
| `files` | `{ ownerId, createdAt: -1 }` | Archivos de un usuario por fecha |
| `files` | `{ ext: 1 }` | Reporte de archivos por tipo |
| `files` | `{ gridfsId: 1 }` | Relacionar con el contenido |
| `files` | `{ name: "text" }` | Busqueda por nombre |
| `shares` | `{ sharedWithId, createdAt: -1 }` | Recursos recibidos por un usuario |
| `shares` | `{ ownerId, createdAt: -1 }` | Recursos compartidos por un usuario |
| `shares` | `{ resourceType, resourceId }` | Permisos de un recurso |
| `shares` | `{ resourceType, resourceId, sharedWithId }` unico | Un solo permiso por usuario y recurso (cambiar permiso = actualizar) |
| `comments` | `{ fileId, createdAt }` | Comentarios de un archivo en orden |
| `activity_logs` | `{ userId, createdAt: -1 }` | Historial de un usuario por rango de fechas |
| `activity_logs` | `{ resourceType, resourceId }` | Actividad sobre un recurso |
| `activity_logs` | `{ action: 1 }` | Reportes por tipo de operacion |
| `activity_logs` | `{ createdAt: -1 }` | Reportes por periodo |

El indice de texto busca por palabras. Para coincidencias parciales del nombre se usa expresion regular.

## 5. Reglas de consistencia

**Permisos.** El propietario siempre tiene acceso total. Otro usuario accede si existe un `share` sobre el recurso o sobre cualquiera de sus carpetas ancestro (`[folderId, ...ancestors]`). Jerarquia: `edit` incluye `comment`, y `comment` incluye `read`.

**Ciclos.** Al mover la carpeta X al destino D se rechaza si D es X o si X esta en `D.ancestors`. Al mover se actualiza `ancestors` de X y de todos sus descendientes (`updateMany` sobre `{ ancestors: X }`).

**Papelera.**
- Eliminar pone `deletedAt` con la fecha actual. Las consultas normales filtran `deletedAt: null`.
- Al eliminar una carpeta, ella y todos sus descendientes activos reciben el mismo `deletedAt`.
- Al restaurar una carpeta solo vuelven los elementos con ese mismo `deletedAt`; lo que ya estaba en papelera antes se queda ahi.
- Si se restaura un recurso cuya carpeta sigue en papelera, se mueve a la raiz.

**Eliminacion definitiva.** Se elimina el documento de `files`, luego su contenido en GridFS, y sus `shares` y `comments`. Se resta `size` de `storageUsed`. El historial se conserva siempre.

**Sin transacciones.** MongoDB local corre como instancia unica (sin replica set), asi que no hay transacciones. Las operaciones de varios pasos se ordenan para que un fallo deje un estado recuperable: por ejemplo, al eliminar de forma definitiva se borra primero el metadato y despues el contenido, de modo que lo peor que puede quedar es un fragmento huerfano, nunca un archivo que apunte a contenido inexistente.

**Usuarios.** Desactivar un usuario pone `active: false`. No se borran sus archivos ni su historial.

**Nombres.** La unicidad del nombre dentro de una misma carpeta se valida en la aplicacion.

## 6. Reportes y como los soporta el modelo

| Reporte | Coleccion | Operadores |
|---|---|---|
| Archivos agrupados por tipo | `files` | `$match` (deletedAt null), `$group` por `ext` |
| Archivos en un rango de fechas | `files` | `$match` por `createdAt` |
| Archivos con mas operaciones | `activity_logs` | `$match` (resourceType file), `$group` por `resourceId`, `$sort`, `$limit`, `$lookup` a `files` |
| Top 10 usuarios con mas archivos | `files` | `$group` por `ownerId`, `$sort`, `$limit`, `$lookup` a `users` |
| Usuarios con mas recursos compartidos | `shares` | `$group` por `ownerId`, `$sort`, `$lookup` a `users` |
| Archivos compartidos con mas usuarios | `shares` | `$match` (file), `$group` por `resourceId`, `$sort`, `$lookup` a `files` |
| Recursos compartidos por un usuario | `shares` | `$match` por `ownerId`, `$lookup` a `files` y `folders` |
| Recursos recibidos por un usuario | `shares` | `$match` por `sharedWithId`, `$lookup` a `files` y `folders` |
| Historial de un usuario en un rango | `activity_logs` | `$match` por `userId` y `createdAt`, `$sort` |
| Operaciones agrupadas por tipo | `activity_logs` | `$group` por `action` |
| Operaciones agrupadas por periodo | `activity_logs` | `$group` por `$dateToString` (dia o mes) |
| Principales acciones | `activity_logs` | `$group` por `action`, `$sort`, `$limit` |

## 7. Datos iniciales

Se cargan con `database/seed.js`. Resultado de la carga actual:

| Dato | Cantidad |
|---|---|
| Usuarios | 3 (1 admin, 2 user) |
| Carpetas | 14 (2 en papelera) |
| Archivos | 50 (7 en papelera: 3 eliminados directamente y 4 dentro de carpetas en papelera) |
| Comparticiones | 33 |
| Comentarios | 9 |
| Registros de actividad | 293 |
| Contenido en GridFS | 50 archivos |

Para reproducirlo (requiere `server/.env`):

```bash
cd database
npm install
node indexes.js
node seed.js
```

Usuarios de prueba: `admin@gestion.com` con `Admin123*`; `ana@gestion.com` y `luis@gestion.com` con `User123*`.
