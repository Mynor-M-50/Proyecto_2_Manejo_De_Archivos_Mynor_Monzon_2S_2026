# Cliente - Gestion Documental

Aplicacion Angular 21 que consume la API REST del servidor (`../server`). Ver el [README principal](../README.md) para la puesta en marcha completa.

```bash
npm install
npm start      # http://localhost:4200
npm run build  # genera dist/
```

La URL de la API se configura en `src/app/core/config.ts` (por defecto `http://localhost:3000/api`).

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/app/core` | Servicios que llaman a la API, sesion, guardas e interceptores |
| `src/app/features` | Pantallas: login, archivos, compartidos, papelera, reportes y usuarios |
| `src/app/layout` | Menu lateral y estructura general |
| `src/app/shared` | Componentes y funciones reutilizables |
