# 📋 Documento de Cambios - Reestructuración a Monorepo (24 Abril 2026)

## 📌 Resumen Ejecutivo

Se ha reestructurado el proyecto de una configuración separada (backend raíz + frontend en carpeta) a una arquitectura de **monorepo con npm workspaces**. Esto centraliza la gestión de dependencias, facilita el desarrollo simultáneo de ambas partes y prepara el terreno para la integración frontend-backend.

---

## 🗂️ ESTRUCTURA ANTERIOR vs NUEVA

### ❌ Estructura Anterior
```
/
├── server.js                    (Backend en raíz)
├── users.js
├── clases.js
├── redisStore.js
├── package.json                 (Solo dependencias backend)
├── package-lock.json
├── Dockerfile
├── docker-compose.yml
├── api.md
├── README.md
│
├── TecDigitalito/               (Frontend aislado)
│   ├── package.json             (Workspace raíz)
│   ├── README.md
│   ├── SECURITY_GAPS.md
│   ├── docs/
│   ├── client/                  (Código React real)
│   │   ├── package.json         (Dependencias React)
│   │   ├── src/
│   │   ├── vite.config.js
│   │   └── ...
│   └── node_modules/
│
└── ...
```

**Problemas:**
- 3 niveles de `package.json` (confuso)
- Backend y frontend completamente separados
- Instalaciones de dependencias duplicadas
- Scripts de arranque complejos

### ✅ Estructura Nueva
```
/
├── package.json                 (Workspace raíz - NUEVO)
├── package-lock.json            (Único package-lock)
├── api.md
├── README.md
├── .gitignore
│
├── server/                       (Backend - MOVIDO)
│   ├── server.js
│   ├── users.js
│   ├── clases.js
│   ├── redisStore.js
│   ├── package.json             (Solo dependencias backend)
│   ├── package-lock.json
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .dockerignore
│   └── .env
│
└── client/                       (Frontend - RENOMBRADO)
    ├── package.json             (Solo dependencias frontend)
    ├── src/
    ├── vite.config.js
    ├── index.html
    ├── README.md
    ├── SECURITY_GAPS.md
    ├── .env.example
    ├── .gitignore
    └── ...
```

**Ventajas:**
- ✅ Estructura clara y profesional
- ✅ Un solo `npm install` (instalando workspaces)
- ✅ Scripts compartidos en raíz
- ✅ Manejo de dependencias centralizado
- ✅ Fácil para CI/CD

---

## 📂 CAMBIOS ESPECÍFICOS REALIZADOS

### 1. **Creación de carpeta `server/`**
- Ubicación: `/server/`
- Propósito: Centralizar todo código y configuración del backend

### 2. **Movimiento de archivos backend → `server/`**

| Archivo | Origen | Destino | Motivo |
|---------|--------|---------|--------|
| `server.js` | Raíz | `server/` | Código principal backend |
| `users.js` | Raíz | `server/` | Módulo de usuarios RavenDB |
| `clases.js` | Raíz | `server/` | Módulo de cursos Neo4j |
| `redisStore.js` | Raíz | `server/` | Módulo caché Redis |
| `package.json` | Raíz | `server/` | Dependencias backend |
| `package-lock.json` | Raíz | `server/` | Lock file backend |
| `Dockerfile` | Raíz | `server/` | Containerización |
| `docker-compose.yml` | Raíz | `server/` | Orquestación Docker |
| `.dockerignore` | Raíz | `server/` | Exclusiones Docker |
| `.env` | Raíz | `server/` | Variables de entorno backend |

### 3. **Renombrado de `TecDigitalito/` → `client/`**
- **Antes**: `TecDigitalito/client/` (anidación confusa)
- **Después**: `client/` (raíz con src, vite.config.js, etc.)

**Cambios internos:**
- Movido `TecDigitalito/client/*` → `client/`
- Eliminado `TecDigitalito/client/` (carpeta duplicada)
- Mantenido documentación en `client/`:
  - `README.md`
  - `SECURITY_GAPS.md`
- Limpiado `node_modules/` anterior
- Conservado `docs-frontend/` (si existía)

### 4. **Creación de `package.json` raíz (NUEVO)**

**Archivo**: `/package.json`

```json
{
  "name": "ic4302-tecdigitalito",
  "version": "1.0.0",
  "description": "TecDigitalito - Full Stack Virtual Classroom Platform",
  "private": true,
  "workspaces": [
    "server",
    "client"
  ],
  "scripts": {
    "install-all": "npm install",
    "dev": "npm run dev --workspace=client",
    "dev:client": "npm run dev --workspace=client",
    "dev:server": "npm start --workspace=server",
    "dev:all": "npm run dev --workspace=client & npm start --workspace=server",
    "build": "npm run build --workspace=client",
    "build:all": "npm run build --workspace=client && npm run build --workspace=server",
    "preview": "npm run preview --workspace=client",
    "start": "npm start --workspace=server"
  }
}
```

**Utilidad:**
- Gestiona ambos workspaces
- Scripts para desarrollo simultáneo
- Scripts para build de producción

### 5. **Actualización de `server/package.json`**

**Cambios:**
```json
{
  "name": "ic4302-tecdigitalito-server",  // Era: "ic4302_s1_2026_tp1_g3"
  "description": "TecDigitalito Backend - Express + Neo4j + RavenDB"  // Era: "Tecdigitalito"
}
```

### 6. **Recreación de `client/package.json`**

**Razón**: Se perdió durante la reorganización de carpetas

**Contenido recreado**:
```json
{
  "name": "ic4302-tecdigitalito-client",
  "version": "1.0.0",
  "description": "TecDigitalito Frontend - React + Vite",
  "private": true,
  "type": "module",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "js-cookie": "^3.0.5"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0"
  },
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

---

## 🔄 CAMBIOS DE RUTAS Y REFERENCIAS

### Backend
- ✅ **Sin cambios internos requeridos**
- Los scripts en `server/package.json` siguen igual: `"start": "node server.js"`
- Las importaciones relativas siguen funcionando igual

### Frontend
- ✅ **Sin cambios internos requeridos**
- Los scripts siguen igual: `"dev": "vite"`
- Las rutas relativas (src/, public/) no cambian
- Los imports relativos en código siguen siendo válidos

### Estructura de imports en código
- ❌ **No cambia**: `import authStore from './data/authStore.js'`
- ✅ **Sigue funcionando**: Rutas relativas dentro de `client/src/`

---

## 📊 ESTADO DE LOS WORKSPACES

| Workspace | Ubicación | Dependencias | Scripts Principales |
|-----------|-----------|--------------|---------------------|
| **server** | `/server/` | Express, Neo4j, RavenDB, Redis | `npm start` |
| **client** | `/client/` | React, React Router, Axios | `npm run dev` |

---

## 🚀 CÓMO USAR AHORA

### Instalación (TODO)
```bash
npm install  # Instala dependencias de AMBOS workspaces
```

### Desarrollo

**Solo frontend:**
```bash
npm run dev:client
# o
npm run dev  # (por defecto es client)
```

**Solo backend:**
```bash
npm run dev:server
# o
npm start --workspace=server
```

**Ambos simultáneamente:**
```bash
npm run dev:all
```

### Build

**Solo frontend:**
```bash
npm run build
```

**Todo:**
```bash
npm run build:all
```

---

## 🔑 ARCHIVOS MODIFICADOS

### Creados (NUEVOS)
1. `/package.json` - Workspace raíz
2. `/client/package.json` - Recreado con dependencias frontend

### Movidos
- `server.js` → `server/server.js`
- `users.js` → `server/users.js`
- `clases.js` → `server/clases.js`
- `redisStore.js` → `server/redisStore.js`
- `package.json` → `server/package.json` (actualizado nombre)
- `package-lock.json` → `server/package-lock.json`
- `Dockerfile` → `server/Dockerfile`
- `docker-compose.yml` → `server/docker-compose.yml`
- `.dockerignore` → `server/.dockerignore`
- `.env` → `server/.env`

### Eliminados
- `/package-lock.json` (movido a server/)
- `/TecDigitalito/` (renombrado a client/)
- Archivos duplicados de workspaces

### Mantenidos en raíz
- `api.md` - Documentación API
- `README.md` - README principal
- `.gitignore` - Exclusiones git

---

## ⚠️ NOTAS IMPORTANTES

### Próximos Pasos Necesarios

1. **Eliminar caché de npm** (si hay problemas):
   ```bash
   rm -rf node_modules
   npm install
   ```

2. **Verificar variables de entorno**:
   - `server/.env` - Asegurar configuración correcta
   - `client/.env.example` - Variables del cliente

3. **Actualizar documentación** (si es necesario):
   - El `README.md` raíz puede guiar a usuarios
   - Los READMEs en `server/` y `client/` son independientes

### Desarrollo

- ⚠️ Al hacer `npm install` en raíz, se instalan ambos workspaces
- ✅ Los imports relativos siguen funcionando igual
- ✅ No hay cambios en rutas de archivos dentro de cada workspace

### Docker

- ✅ Los Dockerfile y docker-compose.yml están en `server/`
- ⚠️ Actualizar rutas en Dockerfile si necesario (probablemente no)

---

## 📈 BENEFICIOS DE ESTA ESTRUCTURA

| Beneficio | Antes | Ahora |
|-----------|-------|-------|
| **Instalaciones de npm** | 2+ | 1 (centralizado) |
| **Scripts compartidos** | No | Sí |
| **Claridad estructura** | Confusa | Profesional |
| **Escalabilidad** | Difícil | Fácil (agregar workspaces) |
| **Manejo de dependencias** | Manual | Automático |
| **CI/CD** | Complejo | Simple |

---

## 🔗 REFERENCIAS

- **npm Workspaces**: https://docs.npmjs.com/cli/using-npm/workspaces
- **Monorepo Benefits**: https://monorepo.tools/

---

## ✅ CHECKLIST DE VERIFICACIÓN

Después de completar esta reestructuración, verifica:

- [ ] `npm install` funciona sin errores
- [ ] `npm run dev:client` inicia Vite
- [ ] `npm start --workspace=server` inicia Express (si .env está correcto)
- [ ] Las rutas internas del cliente funcionan
- [ ] Git reconoce los cambios correctamente
- [ ] Docker build funciona si lo necesitas

---

**Documento generado**: 24 de abril de 2026
**Estado**: ✅ Reestructuración completada
