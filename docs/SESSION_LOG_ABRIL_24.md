# Sesión de Trabajo — 24 de Abril de 2026
## TEC Digitalito — IC4302 TP1 Grupo 3

---

## 1. Resumen de la sesión

Esta sesión se centró en resolver dos bugs críticos reportados por el usuario (pantalla gris en `StudentCourseView` y matrículas duplicadas), diagnosticar errores de infraestructura reportados en la consola del servidor, y hacer un análisis de cobertura completo del proyecto contra el enunciado oficial.

---

## 2. Bugs corregidos

### Bug 1: Pantalla gris al entrar a un curso como estudiante

**Síntoma:** Al navegar a `/courses/:id/registered`, la pantalla quedaba completamente en gris (blank screen) sin renderizar nada.

**Causa raíz:** Violación de las Rules of Hooks de React en `StudentCourseView.jsx`.  
El hook `useMemo` para `resultsByAssessmentId` estaba declarado **después** de tres returns condicionales (loading, course=null, isEnrolled check). React requiere que todos los hooks se llamen en el mismo orden y **antes** de cualquier return condicional.

**Archivos modificados:** `client/src/pages/StudentCourseView.jsx`

**Solución:** Se movió el `useMemo` de `resultsByAssessmentId` junto con `isEnrolled` (ambos ahora antes de los returns condicionales). El `const participants = buildParticipants(...)` y el `return (...)` principal quedaron como estaban.

**Antes:**
```jsx
const isEnrolled = useMemo(...); // OK
// if (loadingCourse) return ...  ← return condicional
// if (!course) return ...        ← return condicional
// if (!isEnrolled) return ...    ← return condicional
const participants = buildParticipants(...);
const resultsByAssessmentId = useMemo(...); // ← VIOLACIÓN: useMemo después de returns
return (<div>...);
```

**Después:**
```jsx
const isEnrolled = useMemo(...);
const resultsByAssessmentId = useMemo(...); // ← movido aquí antes de returns
// if (loadingCourse) return ...
// if (!course) return ...
// if (!isEnrolled) return ...
const participants = buildParticipants(...);
return (<div>...);
```

---

### Bug 2: Usuario matriculado 6 veces en el mismo curso

**Síntoma:** Al verificar los datos en Neo4j, el mismo usuario tenía 6 relaciones `HAS_STUDENT` con el mismo curso.

**Causa raíz:** En `addStudent()` dentro de `server/clases.js`, la query Cypher usaba `MERGE` para el nodo `Student` pero `CREATE` para la relación `HAS_STUDENT`. El `MERGE` en el nodo evita duplicar el nodo, pero el `CREATE` en la relación crea una nueva relación cada vez que se llama, sin verificar si ya existe.

**Archivos modificados:** `server/clases.js`

**Solución:** Cambiar `CREATE (c)-[:HAS_STUDENT]->(s)` por `MERGE (c)-[:HAS_STUDENT]->(s)`.

**Antes:**
```cypher
MERGE (s:Student {studentId: $studentId})
WITH s
MATCH (c:Class {classCode: $classCode})
CREATE (c)-[:HAS_STUDENT]->(s)
```

**Después:**
```cypher
MERGE (s:Student {studentId: $studentId})
WITH s
MATCH (c:Class {classCode: $classCode})
MERGE (c)-[:HAS_STUDENT]->(s)
```

---

## 3. Diagnóstico de errores en consola del servidor

Se analizó el stack trace completo reportado por el usuario al correr `npm start`. Se identificaron **3 causas independientes**:

### Error 1: `DatabaseLoadTimeoutException` (RavenDB 503)

- **Qué pasó:** El servidor Express arrancó y comenzó a atender requests (login, carga de usuarios) mientras RavenDB aún estaba inicializando la base de datos `test`.
- **Evidencia:** El log de carga de RavenDB muestra que termina a las 00:54:07, pero las requests fallaron después de 30s de espera desde ~00:53:38.
- **Causa técnica:** RavenDB tarda ~30s en inicializar su `IndexStore` (auto index `BySearch(username)` tardó 11,402ms solo).
- **Impacto:** Primeras requests de búsqueda de usuarios y login durante ese período devuelven 503.
- **Resolución temporal:** Reintentar después de que el servidor muestre "RavenDB store initialized". En producción se puede agregar un readiness probe en Docker Compose (ya está parcialmente: `condition: service_healthy`).

### Error 2: `Neo4jError: Connection lost. Server didn't respond in 120000ms`

- **Qué pasó:** Durante una matriculación, el driver de Neo4j esperó 2 minutos sin respuesta.
- **Causa:** Neo4j no estaba disponible o estaba bajo carga alta en ese momento.
- **Evidencia:** Stack trace apunta a `addStudent` en `server/clases.js:149`.
- **Resolución:** Asegurarse de que Neo4j esté completamente disponible antes de operar. El error no es de código sino de disponibilidad del servicio.

### Error 3: `Neo4jError: Deadlock — can't acquire EXCLUSIVE RELATIONSHIP_DELETE`

- **Qué pasó:** Dos transacciones concurrentes en Neo4j (`tx:235` y `tx:236`) se bloquearon mutuamente intentando borrar una evaluación.
- **Causa técnica:** Ciclo de espera mutua (deadlock) entre `RELATIONSHIP_DELETE(1)` y `NODE_RELATIONSHIP_GROUP_DELETE(2)`.
- **Evidencia:** Stack trace apunta a `deleteEvaluation` en `server/clases.js:126`.
- **Resolución:** Neo4j abortó una de las transacciones automáticamente (comportamiento correcto). Para evitarlo: asegurarse de no lanzar múltiples operaciones de borrado en paralelo sobre el mismo nodo.

---

## 4. Análisis de cobertura vs enunciado (Historias 1–30)

### Leyenda: ✅ Cumplido | ⚠️ Parcial | ❌ Faltante

| # | Historia | Estado | Notas |
|---|----------|--------|-------|
| 1 | Registro (username, password+salt, nombre, dob, avatar) | ⚠️ | Salt derivado de username (determinístico), no aleatorio criptográfico |
| 2 | Login con credenciales hasheadas + mensaje genérico + fecha de login | ⚠️ | Fecha guardada en Redis token, no bitácora persistente por usuario con IP/dispositivo |
| 3 | Bloqueo tras 5 intentos fallidos + desbloqueo automático + email | ⚠️ | Bloqueo y desbloqueo automático implementados; falta envío de email |
| 4 | Actividad sospechosa: bitácora + email | ❌ | No implementado |
| 5 | Cerrar sesión (invalidar tokens, redirigir a login) | ✅ | Token Redis borrado, cookies limpias, redirige a /login |
| 6 | Recordarme (httpOnly cookie + expiración diferente + invalidar si sospechoso) | ⚠️ | Cookie httpOnly sí; duración no cambia con rememberMe; falta flag `Secure` (solo HTTPS) |
| 7 | Recuperar contraseña con token one-time con expiración corta | ❌ | Implementado como reset directo a contraseña temporal; no hay token de enlace |
| 8 | Cambio de contraseña (pide actual + política de seguridad) | ⚠️ | Pide contraseña actual; no hay validación de política de complejidad en backend |
| 9 | Accesibilidad (ARIA, labels, contraste) | ⚠️ | Labels y ARIA en formularios; contraste no validado formalmente |
| 10 | Bitácora de admin (IP, fecha, hora, dispositivo; exitosos y fallidos) | ❌ | Endpoint `/users/log/` es TODO en backend |
| 11 | Crear curso (código, nombre, descripción, fechas, foto) | ✅ | |
| 12 | Agregar secciones/subtemas en árbol | ✅ | |
| 13 | Contenido en secciones (texto, docs, video, imagen, múltiples) | ✅ | |
| 14 | Evaluaciones de selección única con fechas y calificación automática | ✅ | |
| 15 | Publicar curso (solo visibles al publicar) | ✅ | |
| 16 | Docente ve lista de estudiantes matriculados | ✅ | |
| 17 | Mensajería docente-estudiante (consultas y respuestas) | ❌ | Backend TODO; frontend es un placeholder vacío |
| 18 | Docente ve cursos creados activos/terminados | ⚠️ | Lista de creados existe; `isFinished` siempre false en mapeo |
| 19 | Clonar curso (materiales copiados, fechas/nombre/código nuevos) | ✅ | |
| 20 | Estudiante busca cursos publicados y ve info general | ✅ | |
| 21 | Estudiante se matricula | ✅ | |
| 22 | Estudiante ve cursos matriculados | ✅ | |
| 23 | Estudiante ve secciones y contenido | ✅ | |
| 24 | Estudiante realiza evaluación y obtiene resultado inmediato | ✅ | |
| 25 | Estudiante ve resultados de evaluaciones del curso | ✅ | |
| 26 | Estudiante envía consultas al docente por mensajes | ❌ | Mismo estado que H17 |
| 27 | Estudiante ve otros estudiantes del curso | ✅ | |
| 28 | Amistad entre usuarios (ver cursos de amigo, sin notas) | ❌ | Rutas friends en TODO, sin lógica |
| 29 | Buscar otros usuarios del sistema | ✅ | |
| 30 | Mensajería usuario a usuario con respuestas | ❌ | Backend TODO; frontend placeholder |

**Resumen:** 16 ✅ | 8 ⚠️ | 6 ❌

---

## 5. Análisis de requisito técnico de bases de datos

El enunciado requiere **al menos 4 bases de datos distintas** con:
- Datos distribuidos entre ellas
- Justificación documentada de cada una
- 2 en la nube + 2 locales en Docker con al menos 3 nodos cada una

| BD | Estado actual | Uso actual |
|----|---------------|------------|
| Neo4j | ✅ Corriendo en Docker (1 nodo) | Cursos, secciones, evaluaciones, matrículas, relaciones |
| RavenDB | ✅ Corriendo en Docker (1 nodo) | Usuarios (perfil, credenciales) |
| Redis | ✅ Corriendo en Docker (1 nodo) | Sesiones/tokens, calificaciones, intentos fallidos de login |
| MongoDB | ⚠️ Declarada en `.env` y `package.json`, no usada en rutas | — |

**Brechas de infraestructura:**
- Solo 3 bases de datos operando con datos reales (falta MongoDB u otra en uso)
- Todas con 1 nodo (el enunciado pide al menos 3 nodos por BD en Docker)
- No hay despliegue en nube (2 BDs deben estar en nube)
- No hay documento de justificación de diseño por BD

---

## 6. Estado del build al final de la sesión

```
✓ 133 modules transformed
dist/index.html                   0.57 kB
dist/assets/index-*.css          60.18 kB
dist/assets/index-*.js          333.68 kB
✓ built in ~18s
```

`node --check server/server.js && node --check server/clases.js` — sin errores de sintaxis.

---

## 7. Follow-up para próxima sesión

### Prioridad 1 — Funcionalidades faltantes (valor para evaluación)

#### 7.1 Mensajería real (H17, H26, H30)
El backend tiene los endpoints en TODO y MongoDB ya está en `.env` y `package.json`.

- Crear `server/messages.js` con funciones MongoDB para: enviar mensaje, obtener inbox, obtener conversación entre dos usuarios.
- Conectar el cliente MongoDB en `server.js` (similar a como se hizo con RavenDB).
- Implementar rutas `POST /messages/send/`, `GET /messages/inbox/:userId`, `GET /messages/conversation/:userId1/:userId2`.
- Conectar `client/src/pages/Messaging.jsx` al backend (actualmente placeholder vacío).

#### 7.2 Sistema de amistades (H28)
- Usar Neo4j (relación `:FRIENDS_WITH` entre usuarios o nodos User).
- Implementar rutas `POST /users/friends/request/`, `POST /users/friends/accept/`, `GET /users/friends/`.
- En `Community.jsx`, agregar botón "Agregar amigo" al perfil de usuario seleccionado.
- En `Dashboard.jsx`, cargar amigos reales desde backend (actualmente `friends = []` hardcoded).

#### 7.3 Estado "terminado" de cursos (H18)
- Agregar campo `isFinished` en Neo4j al nodo `Class` (o calcularlo por `endDate < today`).
- Actualizar `mapBackendCourse()` en `auth.js` para leer ese campo correctamente (actualmente hardcodea `isFinished: false`).

#### 7.4 Token de recuperación one-time (H7)
- En `POST /users/reset`: generar token criptográfico (`crypto.randomBytes(32).toString('hex')`), guardarlo en Redis con TTL de 1 hora, y devolverlo al frontend.
- Agregar endpoint `POST /users/reset/confirm` que valide el token (existe en Redis, no expiró), actualice la contraseña, y borre el token.
- El frontend `ResetPassword.jsx` ya tiene la UI preparada para recibir token desde URL.

### Prioridad 2 — Seguridad (cumplimiento del enunciado)

#### 7.5 Salt aleatorio en registro (H1)
En `server/users.js` `CreateUser()`, cambiar:
```js
const salt = crypto.createHash("sha256").update(username).digest("hex");
```
por:
```js
const salt = crypto.randomBytes(32).toString('hex');
```

#### 7.6 Bitácora de actividad (H2, H4, H10)
- Guardar en Redis (o MongoDB) un registro por cada login con: userId, timestamp, IP (`req.ip`), user-agent (`req.headers['user-agent']`), éxito/fallo.
- Implementar `GET /users/log/:id` para que admin vea historial.

#### 7.7 Envío de email en bloqueo (H3) y actividad sospechosa (H4)
- Instalar `nodemailer` o usar SMTP.
- Enviar correo al `user.correo` cuando la cuenta queda bloqueada.

#### 7.8 Política de contraseña (H8)
- Agregar validación en `PUT /users/update/password/:id`: mínimo 8 chars, al menos 1 mayúscula, 1 número.

### Prioridad 3 — Infraestructura de BD (requisito no negociable)

#### 7.9 Usar MongoDB para mensajería (4ta BD)
- Con los cambios del punto 7.1 ya queda cubierta la 4ta base de datos.
- Documentar en README o informe: qué datos van en cada BD y justificación.

#### 7.10 Topología de nodos (3 nodos por BD en Docker)
El `docker-compose.yml` actual levanta instancias únicas. Para cumplir el enunciado:
- Neo4j: cluster de 3 nodos (requiere licencia Enterprise o community con causal clustering).
- Redis: replicaset de 3 nodos (Redis Sentinel o Redis Cluster).
- RavenDB: cluster de 3 nodos (soportado en la imagen oficial).
- MongoDB: replicaset de 3 nodos (soportado nativamente con `--replSet`).

#### 7.11 2 BDs en la nube
El enunciado permite cualquier combinación. Opciones prácticas:
- MongoDB Atlas (free tier, cuenta gratuita).
- Redis Cloud (free tier).
- Cambiar URLs en `.env` a las conexiones de nube y mantener Neo4j + RavenDB locales.

---

## 8. Arquitectura actual del sistema

```
┌─────────────────────────────┐
│  Frontend React+Vite :5173  │
│  ─ cookie httpOnly auth     │
│  ─ axios withCredentials    │
└────────────┬────────────────┘
             │ HTTP
┌────────────▼────────────────┐
│  Backend Express :3000      │
│  ─ ESM modules              │
│  ─ cookie-parser            │
│  ─ CORS credenciales ON     │
└──┬──────┬──────┬────────────┘
   │      │      │
   ▼      ▼      ▼
Neo4j  RavenDB  Redis
:7687  :8080    :6379
Cursos Usuarios Sesiones
Secciones       Calificaciones
Evaluaciones    Intentos login
Matrículas
```

**MongoDB** (:27017) está declarada pero pendiente de integración real (mensajería).

---

## 9. Comandos útiles para la próxima sesión

```bash
# Levantar todas las BDs en Docker
cd server && docker-compose up -d

# Iniciar servidor backend
cd server && npm start

# Iniciar frontend en modo dev
npm run dev --workspace=client

# Build de producción del frontend
npm run build --workspace=client

# Verificar sintaxis del servidor sin ejecutar
node --check server/server.js && node --check server/clases.js

# Ver logs de Neo4j en Docker
docker logs neo4j -f

# Ver logs de RavenDB en Docker
docker logs ravendb -f
```

---

*Documento generado al cierre de la sesión del 24 de abril de 2026.*
