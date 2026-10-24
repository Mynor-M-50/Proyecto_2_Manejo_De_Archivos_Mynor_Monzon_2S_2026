# Manual tecnico

## 1. Arquitectura

Dos aplicaciones independientes que se comunican por una API REST en JSON. Solo el servidor accede a MongoDB.

```
Navegador (Angular 21, :4200)  --HTTP/JSON + JWT-->  Servidor (Node.js + Express, :3000)  --Mongoose / driver-->  MongoDB (:27017)
```

| Componente | Tecnologia | Carpeta |
|---|---|---|
| Cliente | Angular 21 (componentes standalone, signals) | `client` |
| Servidor | Node.js, Express 5, Mongoose, multer, bcryptjs, jsonwebtoken | `server` |
| Base de datos | MongoDB, GridFS para el contenido de los archivos | `database` (indices y seed) |

## 2. Requisitos e instalacion

Node.js 22 o superior y MongoDB en ejecucion. Los pasos estan en el [README](../README.md).

Variables del archivo `server/.env`:

| Variable | Uso | Valor por defecto |
|---|---|---|
| `PORT` | Puerto del servidor | 3000 |
| `MONGO_URI` | Conexion a MongoDB | `mongodb://localhost:27017` |
| `DB_NAME` | Nombre de la base | `gestion_documental` |
| `JWT_SECRET` | Clave para firmar tokens (obligatoria) | - |
| `JWT_EXPIRES_IN` | Duracion del token | 8h |
| `CLIENT_URL` | Origen permitido por CORS | `http://localhost:4200` |
| `DEFAULT_QUOTA_MB` | Espacio asignado a usuarios nuevos | 50 |

## 3. Estructura del servidor (`server/src`)

| Carpeta | Responsabilidad |
|---|---|
| `routes` | Define las rutas de cada modulo y que middleware lleva cada una |
| `controllers` | Valida la peticion, llama a los servicios y arma la respuesta |
| `services` | Reglas de negocio reutilizables: permisos (`access`), GridFS, papelera definitiva (`purge`), reportes, historial |
| `models` | Esquemas de Mongoose (`users`, `folders`, `files`, `shares`, `comments`, `activity_logs`) |
| `middlewares` | `authenticate` (JWT), `requireRole`, manejo global de errores |
| `utils` | Validaciones, fechas, parametros, serializadores |

## 4. API REST

Todas las rutas empiezan con `/api` y, salvo `/auth/login` y `/health`, requieren `Authorization: Bearer <token>`. Los errores responden `{ "message": "..." }`.

| Modulo | Rutas principales |
|---|---|
| Auth | `POST /auth/login`, `GET /auth/me` (incluye espacio asignado, usado y disponible) |
| Usuarios (admin) | `GET/POST /users`, `PUT /users/:id`, `PATCH /users/:id/active` |
| Carpetas | `GET/POST /folders`, `GET /folders/:id`, `PATCH /folders/:id/rename`, `PATCH /folders/:id/move`, `DELETE /folders/:id` |
| Archivos | `GET /files?folderId=&q=&ext=&sort=&order=`, `POST /files` (multipart), `GET /files/:id`, `GET /files/:id/content`, `GET /files/:id/download`, `PUT /files/:id/content`, `PATCH /files/:id/rename`, `PATCH /files/:id/move`, `DELETE /files/:id` |
| Comentarios | `GET/POST /files/:id/comments`, `DELETE /files/:id/comments/:commentId` |
| Compartir | `POST /shares`, `GET /shares?resourceType=&resourceId=`, `GET /shares/by-me`, `GET /shares/with-me`, `PATCH /shares/:id`, `DELETE /shares/:id` |
| Papelera | `GET /trash`, `POST /trash/files/:id/restore`, `POST /trash/folders/:id/restore`, `DELETE /trash/files/:id`, `DELETE /trash/folders/:id`, `DELETE /trash` |
| Reportes | `GET /reports` (catalogo) y `GET /reports/<clave>` con filtros por query |

## 5. Seguridad y control de acceso

- Las contrasenas se guardan con bcrypt; el token JWT lleva el id y el rol.
- `authenticate` consulta al usuario en cada peticion: si se desactiva, el token deja de servir aunque no haya expirado.
- Roles: `admin` (usuarios y reportes globales) y `user` (sus recursos y los que le comparten).
- Niveles de acceso a un recurso: `read < comment < edit < owner`. El permiso sobre una carpeta se hereda a su contenido. Mover, compartir y eliminar son solo del propietario.
- Validaciones de entrada (`utils/validators.js`, `utils/params.js`, `utils/dates.js`): correo con formato valido, nombres de maximo 100 caracteres sin caracteres de control ni `/` `\`, contrasena de 6 caracteres a 72 bytes, identificadores de 24 hexadecimales (evita inyeccion de operadores de MongoDB), fechas reales `AAAA-MM-DD` con rango coherente, extensiones solo `.txt` y `.md`, contenido sin bytes nulos, archivos de maximo 5 MB.
- Espacio asignado: no se puede subir ni editar un archivo si el propietario superaria su cuota (HTTP 413).

## 6. Reglas de negocio importantes

- **Jerarquia sin ciclos:** al mover una carpeta se rechaza el destino si es ella misma o una de sus descendientes. El campo `ancestors` permite comprobarlo sin consultas recursivas y se recalcula en los descendientes al mover.
- **Papelera:** eliminar solo pone `deletedAt`. Una carpeta y todo su contenido comparten la misma fecha para restaurarse juntos. Restaurar con el padre en la papelera lleva el elemento a la raiz; si el nombre esta ocupado se agrega `(restaurado)`.
- **Eliminacion definitiva:** borra el documento de `files`, luego el contenido en GridFS, luego permisos y comentarios, y descuenta el espacio. El historial se conserva.
- **Historial:** cada operacion relevante guarda usuario, accion, recurso (con copia del nombre) y fecha en `activity_logs`. Si el registro falla, la operacion principal no se interrumpe.
- **Sin transacciones:** MongoDB corre como instancia unica; los pasos de cada operacion se ordenan para que un fallo deje un estado valido.

## 7. Reportes

Usan pipelines de agregacion (`$match`, `$group`, `$lookup`, `$facet`, `$sort`, `$limit`, `$dateToString`) en `services/reports.service.js`. Los globales son solo del administrador; los de un usuario seleccionado los puede ver cada usuario sobre si mismo. Detalle en [modelo-documental.md](modelo-documental.md#6-reportes-y-como-los-soporta-el-modelo).

## 8. Carga inicial

`database/indexes.js` crea los indices y `database/seed.js` vacia las colecciones y carga: 3 usuarios, 14 carpetas, 50 archivos (con contenido en GridFS), 33 comparticiones, comentarios, recursos en la papelera y 293 registros de historial.

## 9. Diagramas

En [diagramas](diagramas) (formato draw.io): casos de uso, secuencia de subida de un archivo y despliegue.
