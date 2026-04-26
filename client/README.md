# TEC Digitalito

Proyecto de pruebas enfocado en frontend con React + Vite.

## Requisitos

- Node.js 18+
- npm

## Instalacion

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Tambien puedes ejecutar desde la carpeta del cliente:

```bash
cd client
npm run dev
```

## Build de produccion

```bash
npm run build
```

## Preview local del build

```bash
npm run preview
```

## Estructura relevante

- `client/`: aplicacion React
- `client/src/data/courseStore.js`: capa temporal de datos mock y almacenamiento local para pruebas de UI
- `client/src/services/api.js`: configuracion de cliente HTTP para la futura integracion con backend

## Nota

Actualmente la experiencia de cursos y gestion usa datos mock en frontend mediante `localStorage`. Cuando se integre el backend, esa capa debe reemplazarse o conectarse a servicios reales sin cambiar el flujo principal de la interfaz.
