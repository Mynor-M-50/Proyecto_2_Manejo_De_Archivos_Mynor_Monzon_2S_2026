# Manual de usuario

## 1. Iniciar sesion

1. Abre `http://localhost:4200`.
2. Escribe tu correo y contrasena. El icono del ojo muestra u oculta la contrasena.
3. Si el usuario esta inactivo o los datos son incorrectos, aparece un mensaje de error.

Usuarios de prueba: `admin@gestion.com` / `Admin123*`, `ana@gestion.com` y `luis@gestion.com` / `User123*`.

El menu lateral muestra tus secciones y, abajo, tu **almacenamiento**: espacio asignado, usado y disponible. El boton **Salir** cierra la sesion.

## 2. Mis archivos

Es la pantalla principal. Muestra las carpetas y archivos del nivel donde estas; la ruta de carpetas aparece arriba para volver a un nivel anterior.

| Accion | Como hacerlo |
|---|---|
| Crear carpeta | Boton **Nueva carpeta**, escribir el nombre |
| Subir archivos | Boton **Subir archivos** o arrastrar los archivos a la pantalla. Solo `.txt` y `.md`, maximo 5 MB cada uno |
| Abrir un archivo | Clic en su nombre: se ve el contenido (el Markdown se muestra formateado) |
| Editar el contenido | En el visor, **Editar**, luego **Guardar** (necesitas permiso de edicion) |
| Descargar | Boton de descarga en la fila o en el visor |
| Renombrar | Icono de lapiz; el archivo debe conservar la extension `.txt` o `.md` |
| Mover | Icono de mover y elegir la carpeta destino |
| Eliminar | Icono de papelera: el elemento va a la **Papelera**, no se borra |
| Buscar y filtrar | Cuadro de busqueda por nombre (en todo tu espacio), filtro por tipo y orden por nombre, fecha o tamano |

Mensajes habituales: "Ya existe un archivo con ese nombre en esta ubicacion", "No se puede mover una carpeta dentro de si misma", "No hay espacio suficiente" (se supero el espacio asignado).

## 3. Compartir

1. En la fila de un archivo o carpeta, pulsa el icono **Compartir**.
2. Escribe el correo de otro usuario activo y elige el permiso:
   - **Lectura:** ver y descargar.
   - **Comentar:** lo anterior y escribir comentarios.
   - **Edicion:** lo anterior y modificar contenido, renombrar y crear dentro de una carpeta.
3. En el mismo dialogo puedes cambiar el permiso o retirar el acceso.

Compartir una carpeta da acceso a todo su contenido. Solo el propietario puede compartir, mover o eliminar.

La seccion **Compartidos** tiene dos pestanas: lo que otros compartieron contigo y lo que tu compartiste (desde ahi tambien puedes cambiar o retirar permisos).

## 4. Comentarios

En el visor de un archivo, la zona de comentarios permite escribir (maximo 1000 caracteres). Cada comentario lo puede borrar su autor o el propietario del archivo.

## 5. Papelera

- Muestra lo que eliminaste, con la fecha.
- **Restaurar** devuelve el elemento a su lugar. Si su carpeta tambien esta en la papelera, vuelve a la raiz; si el nombre esta ocupado, se agrega "(restaurado)".
- **Eliminar definitivamente** borra el elemento y libera el espacio. No se puede deshacer.
- **Vaciar papelera** elimina todo lo que hay en ella.

## 6. Reportes

Elige un reporte de la lista, ajusta los filtros (fechas, usuario, tipo, cantidad) y se actualiza la tabla. Algunos incluyen barras para comparar valores, y todos se pueden exportar a CSV.

- **Usuario normal:** reportes sobre su propia informacion (compartidos, recibidos, historial y operaciones, archivos sin compartir, carpetas con mas archivos).
- **Administrador:** ademas los reportes globales (archivos por tipo, por rango de fechas, con mas operaciones, top de usuarios, archivos mas compartidos) y puede elegir el usuario a consultar.

## 7. Usuarios (solo administrador)

- **Nuevo usuario:** nombre (maximo 100 caracteres), correo, contrasena (6 a 72 bytes), rol y espacio asignado en MB.
- **Editar:** cambia nombre, rol, espacio asignado o contrasena. El correo no se puede cambiar. El espacio no puede ser menor a lo que el usuario ya usa.
- **Desactivar / Activar:** un usuario inactivo no puede entrar, pero conserva sus archivos e historial. No puedes desactivarte ni quitarte el rol de administrador a ti mismo.
- Filtros por nombre o correo, rol y estado.
