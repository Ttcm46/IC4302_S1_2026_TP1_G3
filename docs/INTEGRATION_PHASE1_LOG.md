# Integracion Fase 1 - Cambios Minimos en Backend

Fecha: 24 abril 2026

Objetivo: habilitar conexion real frontend-backend sin alterar la arquitectura de datos de los companeros.

## Cambios aplicados en backend

Archivo modificado: server/server.js

1. CORS habilitado para cliente
- Se agrego middleware para:
  - Access-Control-Allow-Origin (default: http://localhost:5173 o CLIENT_ORIGIN)
  - Access-Control-Allow-Methods (GET, POST, PUT, DELETE, OPTIONS)
  - Access-Control-Allow-Headers (Content-Type, Authorization)
  - Respuesta 204 para preflight OPTIONS
- Motivo: permitir llamadas del frontend Vite al backend sin errores de navegador.

2. Compatibilidad de login y logout con POST
- Se extrajo login a handler compartido y se expuso en:
  - GET /login (compatibilidad)
  - POST /login (nuevo, requerido por frontend)
- Se extrajo logout a handler compartido y se expuso en:
  - GET /logout (compatibilidad)
  - POST /logout (nuevo, requerido por frontend)
- Motivo: frontend moderno no usa GET con body para credenciales.

3. Ruta de detalle de curso por codigo
- Se agrego GET /courses/:classCode
- Mantiene la ruta anterior /courses/ para compatibilidad.
- Motivo: CourseDetail requiere consultar curso por identificador.

4. Rutas de matricula robustas
- Se mejoro POST /courses/enroll/ para aceptar classCode por body o params.
- Se agrego POST /courses/enroll/:classCode
- Motivo: permitir matricula desde frontend con identificador en URL.

5. Cambio de contrasena por id
- Se corrigio PUT /users/update/password/ para usar id desde params o body.
- Se agrego PUT /users/update/password/:id
- Motivo: la ruta original dependia de req.params.id sin tener parametro declarado.

## Cambios en frontend para consumir backend

Archivos modificados:
- client/src/services/api.js
- client/src/services/auth.js
- client/src/pages/CourseCatalog.jsx
- client/src/pages/CourseDetail.jsx
- client/src/pages/CreateCourse.jsx

Resumen:
- Base URL cambiada a http://localhost:3000
- authService ahora usa API real (register/login/logout/changePassword)
- Catalogo y detalle ahora cargan cursos desde backend
- Crear curso ahora guarda en backend (Neo4j)
- Matricula desde detalle conecta con backend

## Cambios NO realizados (para mantener estabilidad)

- No se modifico la logica de RavenDB en users.js
- No se modifico el modelo de Neo4j en clases.js
- No se removieron rutas antiguas del backend
- No se rediseno la autenticacion de tokens
- No se migro todo el frontend de stores locales (solo flujo base)

## Verificacion

- Build de frontend exitoso:
  - npm run build --workspace=client
  - Resultado: OK, sin errores

## Riesgos conocidos

1. Algunas pantallas avanzadas aun usan stores locales (evaluaciones, editor de secciones, etc.).
2. Reset por token aun no existe en backend (solo reset temporal por username).
3. Login sigue modelo token simple (sin refresh endpoint real).

## Siguiente fase sugerida

1. Migrar Profile para usar userService real (eliminar dependencia directa de authStore local).
2. Migrar Dashboard y vistas de estudiante a courseService/enrollmentService.
3. Unificar progresivamente stores restantes con endpoints reales.

---

## Actualizacion Fase 2 (Profile y Dashboard)

Fecha: 24 abril 2026

### Cambios minimos en backend

Archivo modificado: server/server.js

1. Endpoint de perfil por id
- Agregado GET /users/:id
- Retorna usuario saneado (sin password ni salt)

2. Endpoint de actualizacion de perfil
- Agregado PUT /users/:id
- Reutiliza updateUser existente en users.js
- Mapea payload frontend a campos backend:
  - fullName -> name
  - dateOfBirth -> dob
  - avatar -> picPath
  - role -> typeofuser
  - email -> correo

Motivo: habilitar edicion de perfil real desde frontend sin tocar la capa de RavenDB.

### Cambios en frontend

Archivos modificados:
- client/src/services/auth.js
- client/src/pages/Profile.jsx
- client/src/pages/Dashboard.jsx

Resumen:
1. userService ahora usa backend real para perfil
- getProfile(id) -> GET /users/:id
- updateProfile(id, data) -> PUT /users/:id

2. Profile migrado a backend
- Eliminada dependencia de updateProfile local (authStore)
- Guardado de perfil ahora persiste en backend

3. Dashboard migrado parcialmente
- Cursos creados: ahora desde enrollmentService.getTeachingCourses()
- Cursos matriculados: ahora desde enrollmentService.getMyCourses()
- Secciones de amigos/mensajes se mantienen en store local (sin cambios)

### Verificacion

- Build frontend exitoso tras fase 2:
  - npm run build --workspace=client
  - Resultado: OK

### Que no se toco

- No se modifico users.js (modelo ni funciones internas)
- No se modifico clases.js
- No se removieron rutas legacy
- No se migro modulo social/mensajeria aun

---

## Actualizacion Fase 3 (Vistas de Estudiante)

Fecha: 24 abril 2026

### Cambios en backend

- Sin cambios adicionales en backend para esta fase.
- Se reutilizaron endpoints ya existentes:
  - GET /courses/:classCode (detalle con class, sections, students, evaluations)

### Cambios en frontend

Archivos modificados:
- client/src/services/auth.js
- client/src/pages/StudentCourseView.jsx
- client/src/pages/StudentSectionView.jsx

Resumen:
1. Adaptador de curso extendido (services/auth.js)
- mapBackendCourse ahora soporta payload de detalle (class + students + sections + evaluations).
- Se normalizan:
  - sections -> formato de UI (id/title/description/children/resources)
  - evaluations -> formato de UI (id/title/fechas/preguntas)
  - enrolledStudentIds -> arreglo de ids matriculados

2. StudentCourseView migrado a backend
- Dejo de usar courseStore y registrationStore para cargar/validar curso matriculado.
- Ahora carga curso por API y valida acceso con enrolledStudentIds.
- Mantiene resultados de evaluaciones en storage local (assessmentStore) por compatibilidad temporal.
- Si una evaluacion no trae preguntas desde backend, el boton de intento se deshabilita con etiqueta explicita.

3. StudentSectionView migrado a backend
- Dejo de usar courseStore/registrationStore.
- Ahora carga curso por API y obtiene seccion desde sections del backend adaptado.
- Soporta ids de seccion string (no solo numericos).

### Verificacion

- Build frontend exitoso tras fase 3:
  - npm run build --workspace=client
  - Resultado: OK

### Riesgos y limites actuales

1. El backend devuelve secciones planas; por eso subtemas/recursos complejos dependen de evolucion futura del modelo.
2. Las evaluaciones sin preguntas estructuradas en backend quedan visibles, pero no intentables desde UI.

---

## Actualizacion Fase 4 (CourseMembers y Evaluaciones)

Fecha: 24 abril 2026

### Cambios minimos en backend

Archivos modificados:
- server/clases.js
- server/server.js

1. CRUD de evaluaciones en backend
- Agregado en capa Neo4j:
  - updateEvaluation(driver, classCode, evalId, updates)
  - deleteEvaluation(driver, classCode, evalId)

2. Nuevos endpoints de evaluaciones
- POST /courses/evaluation/:classCode
- PUT /courses/evaluation/:classCode/:evalId
- DELETE /courses/evaluation/:classCode/:evalId
- GET /courses/evaluations/:classCode

3. Compatibilidad preservada
- Se mantiene POST /courses/evaluation/
- Se mantiene GET /courses/evaluations/

### Cambios en frontend

Archivos modificados:
- client/src/services/auth.js
- client/src/pages/CourseMembers.jsx
- client/src/pages/AssessmentEditor.jsx
- client/src/pages/AssessmentSubmissions.jsx
- client/src/pages/AssessmentAttempt.jsx
- client/src/pages/AssessmentResult.jsx
- client/src/data/assessmentStore.js

Resumen:
1. CourseMembers migrado a backend
- Carga curso y miembros desde API real.
- Docente y estudiantes ya no dependen de registrationStore/socialStore para esta vista.

2. Evaluaciones migradas a backend (lectura + edicion)
- AssessmentEditor ahora carga evaluacion desde API y guarda/elimina via CRUD backend.
- AssessmentSubmissions, AssessmentAttempt y AssessmentResult cargan curso/evaluacion desde backend.

3. Compatibilidad de resultados locales
- Los intentos/resultados del estudiante se mantienen en assessmentStore local (temporal).
- assessmentStore se ajusto para soportar IDs string de curso/evaluacion (classCode/evalId).

### Verificacion

- Build frontend exitoso tras fase 4:
  - npm run build --workspace=client
  - Resultado: OK

### Limite restante identificado

- En CourseEditor, la seccion de creacion rapida de evaluaciones aun usa assessmentStore local.
- Las pantallas de detalle/intento/resultado ya consumen backend, pero la creacion en ese formulario puntual queda pendiente para completar migracion al 100%.

---

## Actualizacion Fase 5 (Cierre migracion de evaluaciones)

Fecha: 24 abril 2026

### Cambios en frontend

Archivo modificado:
- client/src/pages/CourseEditor.jsx

Resumen:
1. Formulario de "Nueva evaluacion" en CourseEditor migrado a backend
- Antes: addCourseAssessment() en assessmentStore local
- Ahora: assessmentService.createAssessment() via API

2. Eliminacion de evaluaciones en CourseEditor migrada a backend
- Antes: deleteCourseAssessment() en assessmentStore local
- Ahora: assessmentService.deleteAssessment() via API

3. Listado de evaluaciones en CourseEditor ahora viene del backend
- Antes: (course.assessments || []) de courseStore local
- Ahora: backendAssessments cargado desde courseService.getCourse(id)

### Estado final de evaluaciones

- Creacion: backend ✅
- Edicion: backend ✅
- Eliminacion: backend ✅
- Listado y detalle: backend ✅
- Intentos/resultados estudiante: guardado local temporal (pendiente endpoint real de submit/grades)

### Verificacion

- Build frontend exitoso:
  - npm run build --workspace=client
- Sintaxis backend valida:
  - node --check server/server.js

---

## Actualizacion Fase 8 (Migracion final de pendientes)

Fecha: 24 abril 2026

### Cambios en backend

Archivos modificados:
- server/clases.js
- server/server.js

1. Cursos: edicion, estado y eliminacion
- Nuevo PUT /courses/:classCode para actualizar metadata (name, description, fechas, portada).
- Nuevo PUT /courses/status/:classCode para publicar/ocultar (isPublished).
- Nuevo DELETE /courses/:classCode para eliminar curso.

2. Secciones: rutas funcionales con parametros
- Nuevo POST /courses/section/:classCode (creacion de seccion o subtema).
- Nuevo PUT /courses/section/:sectionId (actualizacion).
- Nuevo DELETE /courses/section/:sectionId (eliminacion con subarbol).
- Se corrigio manejo de params/body en rutas legacy de secciones.

3. Estructura de secciones para frontend
- Secciones ahora guardan parentId en Neo4j para reconstruir jerarquia.
- getClassDetails ahora incluye secciones alcanzables via HAS_SECTION|HAS_SUBSECTION.

4. Clonado de curso con overrides
- Nuevo POST /courses/clone/:sourceClassCode
- Acepta newClassCode y overrides de metadata (name, description, fechas, fotoPath).

### Cambios en frontend

Archivos modificados:
- client/src/services/auth.js
- client/src/pages/CourseEditor.jsx
- client/src/pages/SectionEditor.jsx
- client/src/pages/CloneCourse.jsx

1. courseService extendido
- updateCourse(), publishCourse(), deleteCourse()
- createSection(), updateSection(), deleteSection()
- cloneCourse(id, data) con payload completo

2. CourseEditor migrado a backend
- Carga del curso via API.
- Guardado de metadata del curso via API.
- Publicar/ocultar via API.
- Eliminar curso via API.
- Crear secciones/subtemas via API.

3. SectionEditor migrado parcialmente
- Lectura de seccion/subtemas desde curso backend.
- Editar/eliminar seccion y subtemas via API.
- Materiales quedan como pendiente (sin endpoint dedicado de recursos).

4. CloneCourse migrado a backend
- Carga de curso origen via API.
- Clonado via endpoint backend con metadata del formulario.

### Resultado de cobertura

- No quedan imports activos de stores locales de curso/registro en client/src.
- Los flujos pendientes quedaron acotados a manejo avanzado de materiales por seccion.

### Verificacion

- Build frontend exitoso:
  - npm run build --workspace=client
- Sintaxis backend valida:
  - node --check server/server.js
  - node --check server/clases.js

---

## Ajuste operativo (arranque local con Docker)

Fecha: 24 abril 2026

### Problema detectado

Al iniciar backend con `npm start` se presentaron errores de arranque:

1. RavenDB 503 en startup (readiness tardio)
2. `TypeError: Invalid protocol` en Redis

### Causa raiz

1. RavenDB podia responder con 503 en la ventana inicial de arranque.
2. Redis se inicializaba con URL invalida (`http://localhost:6379`) y variables inconsistentes por mayusculas/minusculas (`Redis_URL` vs `REDIS_URL`).

### Correcciones aplicadas

Archivos modificados:
- server/users.js
- server/redisStore.js
- server/server.js
- server/.env

1. `server/users.js`
- Se agregaron reintentos con espera al inicializar RavenDB (tolerante a readiness tardio).

2. `server/redisStore.js`
- Fallback corregido a `redis://localhost:6379`.
- Se espera conexion con `await RDclient.connect()`.
- Base de datos Redis parseada a numero.

3. `server/server.js`
- Se normalizo lectura de variables de entorno para Redis/Neo4j (soporte de variantes legacy).
- Fallback de Redis corregido a protocolo `redis://`.

4. `server/.env`
- Variables normalizadas:
  - `REDIS_URL`, `REDIS_DB`
  - `NEO4J_URL`, `NEO4J_USER`, `NEO4J_PASSWORD`

### Resultado

El backend inicia correctamente:
- RavenDB store initialized
- Redis client initialized
- Neo4j driver initialized

---

## Actualizacion Fase 10 (Frontend sin localStorage ni stores locales)

Fecha: 24 abril 2026

### Objetivo

Eliminar dependencia de almacenamiento/validaciones locales en frontend para dejar consumo backend-only.

### Cambios aplicados

1. Sesion en memoria (sin localStorage)
- Nuevo archivo: client/src/services/session.js
- Se migro manejo de sesion a memoria en:
  - client/src/services/api.js
  - client/src/services/auth.js
  - client/src/App.jsx
  - client/src/components/Layout.jsx
  - client/src/pages/auth/Login.jsx
  - client/src/pages/Profile.jsx
  - client/src/pages/StudentCourseView.jsx
  - client/src/pages/StudentSectionView.jsx
  - client/src/pages/AssessmentAttempt.jsx
  - client/src/pages/AssessmentResult.jsx

2. Eliminacion total de stores locales
- Se eliminaron archivos de client/src/data:
  - authStore.js
  - courseStore.js
  - registrationStore.js
  - assessmentStore.js
  - socialStore.js
  - messageStore.js
  - storeUtils.js

3. Modulos sociales sin fallback local
- Community y Messaging se reescribieron para modo backend-only (sin store local).

### Verificacion

- Busqueda en client/src sin coincidencias runtime de localStorage/sessionStorage.
- Sin imports desde client/src/data en client/src.
- Build frontend exitoso:
  - npm run build --workspace=client

### Nota operativa

La sesion en memoria no persiste recargas del navegador. Esto elimina almacenamiento local, pero requiere implementar sesion por cookies httpOnly en backend para persistencia segura entre refresh.

---

## Actualizacion Fase 9 (CRUD de materiales por seccion)

Fecha: 24 abril 2026

### Cambios en backend

Archivos modificados:
- server/clases.js
- server/server.js

1. Lectura de seccion por id
- Agregado getSectionById(driver, sectionId) en capa Neo4j.

2. Endpoints de materiales por seccion
- POST /courses/section/:sectionId/resources
- PUT /courses/section/:sectionId/resources/:resourceId
- DELETE /courses/section/:sectionId/resources/:resourceId

Implementacion:
- Los materiales se persisten en el campo JSON description de Section (propiedad resources).
- Se mantiene compatibilidad con el modelo actual (sin crear nodos nuevos para recursos).

### Cambios en frontend

Archivos modificados:
- client/src/services/auth.js
- client/src/pages/CourseEditor.jsx
- client/src/pages/SectionEditor.jsx

1. courseService extendido
- addSectionResource(sectionId, resourceInput)
- updateSectionResource(sectionId, resourceId, resourceInput)
- deleteSectionResource(sectionId, resourceId)

2. CourseEditor
- Se reactivo el formulario "Agregar contenido" con backend real.
- Validaciones de tipo y payload mantenidas.

3. SectionEditor
- Se reactivo "Modificar" y "Eliminar" material usando backend.
- Se mantiene refresco de vista al completar operaciones.

### Estado de integracion

- Flujos de cursos, secciones y materiales ahora conectados al backend.
- Sin dependencia activa de stores locales para estos flujos.

### Verificacion

- Build frontend exitoso:
  - npm run build --workspace=client
- Sintaxis backend valida:
  - node --check server/server.js
  - node --check server/clases.js

---

## Actualizacion Fase 7 (Verificacion de pendientes y ajustes de bajo riesgo)

Fecha: 24 abril 2026

### Cambios aplicados

Archivos modificados:
- client/src/components/Layout.jsx
- client/src/pages/CourseDetail.jsx

1. Logout conectado al backend
- Layout ahora llama authService.logout() antes de limpiar sesion local.
- Redireccion final ajustada a /login.

2. Matricula en CourseDetail conectada al backend
- Se elimino dependencia de registrationStore para estado de matricula.
- isEnrolled ahora se resuelve con enrollmentService.getMyCourses().

### Verificacion de cobertura backend/frontend

Despues de esta fase, solo quedan 3 paginas con dependencia directa de courseStore local:

1. client/src/pages/CourseEditor.jsx
2. client/src/pages/SectionEditor.jsx
3. client/src/pages/CloneCourse.jsx

### Motivo de pendientes

Estos flujos dependen de capacidades que el backend actual aun no expone completamente:
- CRUD completo de secciones con jerarquia y recursos (texto/video/imagen/documento)
- Actualizacion/eliminacion de curso (metadata, portada, publish/unpublish)
- Clonado con override de metadata completa desde UI

Sin esos endpoints, migrarlos totalmente al backend implicaria alterar mas fuerte la estructura de backend (no recomendado en esta etapa).
  - node --check server/clases.js

---

## Actualizacion Fase 6 (Submit y Grades de Evaluaciones en Backend)

Fecha: 24 abril 2026

### Cambios en backend

Archivo modificado:
- server/server.js

1. Persistencia de intentos de evaluacion
- Implementado POST /courses/submit/:classCode/:evalId
- Guarda resultado por usuario en Redis (incluye score, detalle por pregunta y timestamp)
- Evita doble envio del mismo usuario para la misma evaluacion (retorna 409 con intento previo)

2. Consulta de notas
- Implementado GET /courses/grades/:classCode/:evalId
  - con userId: retorna intento de un estudiante
  - sin userId: retorna todos los intentos de esa evaluacion
- Implementado GET /courses/grades/:classCode
  - con userId: retorna todos los intentos del estudiante en el curso
  - sin userId: retorna todos los intentos del curso

### Cambios en frontend

Archivos modificados:
- client/src/services/auth.js
- client/src/pages/AssessmentAttempt.jsx
- client/src/pages/AssessmentResult.jsx
- client/src/pages/AssessmentSubmissions.jsx
- client/src/pages/StudentCourseView.jsx

Resumen:
1. assessmentService extendido
- submitAssessment()
- getAssessmentResult()
- getAssessmentSubmissions()
- getCourseResultsForUser()

2. Attempt/Result/Submissions migrados a backend para resultados
- AssessmentAttempt envia intento con submitAssessment()
- AssessmentResult consulta resultado via backend
- AssessmentSubmissions consulta intentos de estudiantes via backend

3. StudentCourseView
- La pestaña de evaluaciones ahora muestra resultados obtenidos desde backend

### Estado final de evaluaciones

- Crear/Editar/Eliminar/Listar: backend ✅
- Submit de estudiante: backend ✅
- Consulta de calificaciones: backend ✅

### Verificacion

- Build frontend exitoso:
  - npm run build --workspace=client
- Sintaxis backend valida:
  - node --check server/server.js
