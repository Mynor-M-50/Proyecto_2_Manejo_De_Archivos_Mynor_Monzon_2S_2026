# Sistema de Gestion Documental

Proyecto final de Manejo e Implementacion de Archivos. Permite guardar, organizar, compartir y consultar archivos `.txt` y `.md` entre usuarios de una organizacion.

- **Cliente:** Angular 21 (carpeta `client`)
- **Servidor:** Node.js + Express + Mongoose (carpeta `server`)
- **Base de datos:** MongoDB; el contenido de los archivos se guarda en GridFS
- **Carga inicial:** carpeta `database` (indices y datos de prueba)

## Puesta en marcha

Requisitos: Node.js 22 o superior y MongoDB corriendo en `localhost:27017`.

```bash
# 1. Servidor
cd server
npm install
cp .env.example .env      # y cambiar JWT_SECRET
npm start                 # http://localhost:3000

# 2. Base de datos (indices y datos de prueba)
cd ../database
npm install
node indexes.js
node seed.js              # borra y vuelve a cargar los datos

# 3. Cliente
cd ../client
npm install
npm start                 # http://localhost:4200
```

Usuarios de prueba: `admin@gestion.com` / `Admin123*` y `ana@gestion.com`, `luis@gestion.com` / `User123*`.

## Documentacion

| Documento | Ubicacion |
|---|---|
| Modelo documental (colecciones, embebidos, referencias, indices) | [docs/modelo-documental.md](docs/modelo-documental.md) |
| Manual tecnico | [docs/manual-tecnico.md](docs/manual-tecnico.md) |
| Manual de usuario | [docs/manual-usuario.md](docs/manual-usuario.md) |
| Diagramas UML (draw.io) | [docs/diagramas](docs/diagramas) |
