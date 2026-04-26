# Documentación: Archivos Core y Stores de Datos

## Índice
1. [main.jsx](#mainjsx)
2. [App.jsx](#appjsx)
3. [Layout.jsx](#layoutjsx)
4. [CourseCard.jsx](#coursecardjsx)
5. [storeUtils.js](#storeutilsjs)
6. [authStore.js](#authstorejs)
7. [courseStore.js](#coursestorejs)
8. [registrationStore.js](#registrationstorejs)
9. [assessmentStore.js](#assessmentstorejs)
10. [socialStore.js](#socialstorejs)
11. [messageStore.js](#messagestorejs)

---

## main.jsx

### ¿Qué hace?
Es el punto de entrada de la aplicación React. Monta el componente raíz `<App />` dentro del DOM del navegador.

### ¿Cómo lo hace?
Usa `ReactDOM.createRoot()` para crear la raíz de renderizado en el elemento HTML con `id="root"`, y renderiza `<App />` envuelto en `<React.StrictMode>` para activar verificaciones adicionales durante desarrollo.

### ¿Por qué lo hace así?
`React.StrictMode` ayuda a detectar problemas potenciales (efectos duplicados, APIs obsoletas) solo en desarrollo, sin impacto en producción. `createRoot` es la API moderna de React 18 para renderizado concurrente.

---

## App.jsx

### ¿Qué hace?
Define la estructura de rutas completa de la aplicación. Determina qué página se renderiza según la URL del navegador.

### ¿Cómo lo hace?

#### `isAuthenticated()`
- **Qué hace:** Verifica si el usuario tiene una sesión activa.
- **Cómo:** Lee `localStorage.getItem('accessToken')` y lo convierte a booleano con `Boolean()`.
- **Por qué:** El token de acceso se almacena en `localStorage` al hacer login; su presencia indica que el usuario está autenticado.

#### `ProtectedRoute({ children })`
- **Qué hace:** Componente envolvente que protege rutas que requieren autenticación.
- **Cómo:** Si `isAuthenticated()` retorna `false`, redirige al usuario a `/` con `<Navigate to="/" replace />`. Si está autenticado, renderiza los `children` (la página protegida).
- **Por qué:** Implementa el patrón de rutas protegidas sin middleware de servidor, ya que toda la app es cliente puro.

#### `App()`
- **Qué hace:** Componente principal que declara todas las rutas usando React Router.
- **Cómo:** Usa `<BrowserRouter>` para habilitar navegación por historial del navegador, y `<Routes>` con `<Route>` para mapear cada URL a un componente de página envuelto en `<Layout>`.
- **Por qué:** React Router v6 usa este patrón declarativo. Se separan rutas públicas (login, register, catálogo) de protegidas (dashboard, editor, mensajes). Las rutas públicas de auth redirigen a `/dashboard` si ya hay sesión.

**Rutas públicas:** `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/courses`, `/courses/:id`

**Rutas protegidas:** `/dashboard`, `/profile`, `/create-course`, `/change-password`, `/courses/:id/manage`, `/courses/:id/registered`, `/social`, `/social/messages`, y variantes anidadas para secciones, evaluaciones, etc.

**Catch-all:** `<Route path="*">` redirige cualquier ruta no reconocida a `/`.

---

## Layout.jsx

### ¿Qué hace?
Es la estructura visual común (header, contenido principal, footer) que envuelve todas las páginas.

### ¿Cómo lo hace?

#### Variables de estado
- `isAuthenticated`: Lee `localStorage.getItem('accessToken')` para determinar si mostrar opciones de sesión.
- `homePath`: Si hay sesión activa es `/dashboard`, si no es `/`.

#### `handleLogout()`
- **Qué hace:** Cierra la sesión del usuario.
- **Cómo:** Elimina `accessToken`, `refreshToken` y `user` de `localStorage`, luego redirige con `window.location.href = '/'`.
- **Por qué:** Se usa `window.location.href` en lugar de `navigate()` + `reload()` para evitar una condición de carrera donde React Router intenta navegar antes de que el estado de localStorage se actualice.

#### Renderizado
- **Header:** Logo clicable que navega a `homePath`, barra de navegación con enlaces condicionales según autenticación (Cursos, Comunidad, Ver Perfil, Cerrar Sesión para autenticados; Iniciar Sesión, Registrarse para no autenticados).
- **Main:** `{children}` renderiza la página específica pasada como hijo.
- **Footer:** Copyright estático.

### ¿Por qué lo hace así?
El patrón de layout wrapper centraliza la estructura visual común. Cada página se pasa como `children`, lo que evita duplicar header/footer en cada componente.

---

## CourseCard.jsx

### ¿Qué hace?
Componente reutilizable que muestra una tarjeta visual con la información resumida de un curso en el catálogo.

### ¿Cómo lo hace?

#### `handleClick()`
- **Qué hace:** Navega a la página de detalle del curso.
- **Cómo:** Usa `useNavigate()` de React Router para navegar a `/courses/${course.id}`.

#### Renderizado
- Muestra imagen de portada (`coverImage`), nombre del curso, código, descripción, nombre del docente y cantidad de estudiantes matriculados.

### ¿Por qué lo hace así?
Separar la tarjeta en su propio componente permite reutilizarla en cualquier vista que liste cursos (catálogo, comunidad). La navegación con `onClick` en toda la tarjeta ofrece mejor UX que solo un enlace.

---

## storeUtils.js

### ¿Qué hace?
Módulo de utilidades compartidas por todos los stores de datos. Define constantes de almacenamiento y funciones helper comunes.

### ¿Cómo lo hace?

#### Constantes exportadas
- `STORAGE_KEY = "tec_digitalito_courses"`: Clave de localStorage donde se guardan todos los cursos.
- `REGISTERED_COURSE_IDS_KEY = "tec_digitalito_enrolled_course_ids"`: Prefijo de clave para IDs de cursos matriculados por cada usuario.
- `ASSESSMENT_RESULTS_KEY = "tec_digitalito_assessment_results"`: Clave para resultados de evaluaciones.

#### `createId()`
- **Qué hace:** Genera un identificador numérico único.
- **Cómo:** Combina `Date.now()` (milisegundos desde epoch) con `Math.floor(Math.random() * 100000)` (número aleatorio de 0-99999).
- **Por qué:** Esta combinación produce IDs únicos con probabilidad extremadamente alta sin depender de un servidor. El timestamp base garantiza secuencia temporal, y el componente aleatorio evita colisiones si se crean múltiples entidades en el mismo milisegundo.

#### `hasLocalStorage()`
- **Qué hace:** Verifica si `localStorage` está disponible en el entorno actual.
- **Cómo:** Comprueba que `window` y `window.localStorage` están definidos.
- **Por qué:** Protege contra errores en entornos de server-side rendering (SSR) o navegadores con storage deshabilitado.

#### `getCurrentUserIdentity()`
- **Qué hace:** Obtiene el identificador único del usuario actual.
- **Cómo:** Lee y parsea el objeto `user` de localStorage, retorna `user.id` o `user.username`, o `"anonymous-user"` como fallback.
- **Por qué:** Se necesita un identificador consistente para asociar datos (cursos, matrículas) al usuario correcto. El fallback `"anonymous-user"` evita errores cuando no hay sesión.

#### `getCurrentUserProfile()`
- **Qué hace:** Obtiene el perfil completo del usuario actual.
- **Cómo:** Lee y parsea el objeto `user` de localStorage, retorna el objeto completo o `{}` como fallback.
- **Por qué:** Varias operaciones necesitan datos del perfil (nombre completo para asignar como docente, etc.).

#### `getKnownUserLabelByIdentity(userId)`
- **Qué hace:** Retorna una etiqueta legible para un ID de usuario.
- **Cómo:** Actualmente retorna el propio `userId` sin transformación.
- **Por qué:** Es un placeholder diseñado para ser reemplazado con una búsqueda real de nombres si se implementa un backend.

---

## authStore.js

### ¿Qué hace?
Simula un servicio de autenticación completo (registro, login, actualización de perfil, cambio de contraseña) usando localStorage como base de datos.

### ¿Cómo lo hace?

#### Funciones internas de persistencia

##### `getUsers()` / `saveUsers(users)`
- **Qué hacen:** Leen/escriben el arreglo de usuarios desde/hacia localStorage bajo la clave `tec_digitalito_users`.
- **Por qué:** Centralizan el acceso a datos de usuarios para evitar código repetido.

##### `findUser(username)` / `findUserByEmail(email)` / `findUserById(userId)`
- **Qué hacen:** Buscan un usuario por username, email o ID respectivamente.
- **Cómo:** Iteran el arreglo de usuarios con `.find()`, comparando strings en minúsculas para búsquedas case-insensitive (username y email) o por ID exacto.
- **Por qué:** Se necesitan distintas búsquedas: por username al hacer login, por email al registrar (verificar duplicados), por ID al actualizar perfil.

##### `generateToken()`
- **Qué hace:** Genera un token de autenticación aleatorio.
- **Cómo:** Usa `crypto.getRandomValues()` para llenar un `Uint8Array` de 32 bytes con valores criptográficamente aleatorios, luego los convierte a string hexadecimal.
- **Por qué:** `crypto.getRandomValues()` es la forma estándar y segura de generar valores aleatorios en navegadores, más seguro que `Math.random()`.

##### `hashPassword(password)`
- **Qué hace:** Genera un hash SHA-256 de la contraseña.
- **Cómo:** Codifica la contraseña a bytes con `TextEncoder`, la pasa a `crypto.subtle.digest('SHA-256', ...)`, y convierte el resultado a string hexadecimal.
- **Por qué:** Almacenar contraseñas en texto plano es inseguro. SHA-256 a través de Web Crypto API proporciona hashing en el navegador. Nota: en producción se usaría bcrypt con salt en un servidor.

##### `makeResponse(data)` / `makeError(status, message)`
- **Qué hacen:** Crean objetos con estructura de respuesta HTTP (similar a Axios).
- **Por qué:** Permiten que el código de las páginas trate las llamadas al store igual que trataría llamadas a una API REST real, facilitando una futura migración a backend.

#### Funciones exportadas

##### `register({ username, email, password, fullName, dateOfBirth, avatar })`
- **Qué hace:** Registra un nuevo usuario en el sistema.
- **Cómo:** Valida que los campos obligatorios existan, verifica que username y email no estén duplicados con `findUser()` y `findUserByEmail()`, hashea la contraseña, y agrega el usuario al arreglo en localStorage.
- **Por qué:** Simula el endpoint POST /register de un backend REST.

##### `login(username, password)`
- **Qué hace:** Autentica un usuario y retorna tokens de sesión.
- **Cómo:** Busca el usuario por username, hashea la contraseña proporcionada y la compara con el hash almacenado. Si coincide, genera `accessToken` y `refreshToken` y retorna el perfil del usuario (sin el campo password).
- **Por qué:** Simula POST /login. Se usa destructuración `{ password: _, ...safeUser }` para excluir el hash de la respuesta.

##### `updateProfile(profileInput)`
- **Qué hace:** Actualiza el perfil del usuario actual (username, nombre, fecha de nacimiento, avatar).
- **Cómo:** Identifica al usuario actual desde la sesión en localStorage, verifica que el nuevo username no esté tomado por otro usuario, y actualiza los campos en el arreglo de usuarios.
- **Por qué:** Permite editar el perfil sin cambiar la contraseña. La verificación de username duplicado previene conflictos de identidad.

##### `changePassword(currentPassword, newPassword)`
- **Qué hace:** Cambia la contraseña del usuario actual.
- **Cómo:** Verifica la contraseña actual hasheándola y comparándola, luego hashea la nueva contraseña y reemplaza el hash en el arreglo de usuarios.
- **Por qué:** La verificación de la contraseña actual previene cambios no autorizados.

##### `forgotPassword()` / `resetPassword()` / `logout()` / `refreshAccessToken()`
- **Qué hacen:** Simulan funcionalidades de recuperación de contraseña, cierre de sesión y refresco de tokens.
- **Cómo:** Retornan respuestas de éxito predefinidas sin lógica real.
- **Por qué:** Son stubs que mantienen la interfaz de API completa para futura implementación con backend real.

---

## courseStore.js

### ¿Qué hace?
Gestiona todo el ciclo de vida de los cursos: creación, lectura, actualización y eliminación (CRUD) de cursos, secciones, subsecciones y recursos. Persiste los datos en localStorage.

### ¿Cómo lo hace?

#### Helpers de árbol de secciones

Las secciones de un curso se organizan como un **árbol jerárquico** (secciones pueden tener sub-secciones hijas que a su vez pueden tener más hijas). Cada función de árbol recorre recursivamente esta estructura.

##### `normalizeSection(section)`
- **Qué hace:** Asegura que una sección tenga todos sus campos con valores por defecto.
- **Cómo:** Usa el operador `??` para asignar valores por defecto a `id`, `title`, `description`, y normaliza recursivamente `children` y `resources`.
- **Por qué:** Los datos en localStorage pueden estar incompletos (migración, edición manual). La normalización previene errores de campos undefined.

##### `computeIsFinished(course)`
- **Qué hace:** Determina si un curso ha terminado basándose en su fecha de fin.
- **Cómo:** Crea un objeto `Date` con la fecha actual (a las 00:00:00) y otro con la `endDate` del curso. Si la fecha de fin es anterior a hoy, retorna `true`.
- **Por qué:** El estado "terminado" se calcula dinámicamente en lugar de almacenarse, lo que garantiza que un curso se marca como terminado automáticamente cuando su fecha de fin pasa, sin intervención manual.

##### `normalizeCourse(course)`
- **Qué hace:** Asegura que un curso tenga todos sus campos calculados y normalizados.
- **Cómo:** Calcula `createdByCurrentUser` comparando `ownerId` con el usuario actual, aplica `computeIsFinished()` para `isFinished`, y normaliza todas las secciones recursivamente.
- **Por qué:** Cada vez que se lee un curso de localStorage, se recalculan los campos derivados para que siempre reflejen el estado actual (quién es el usuario logueado, si la fecha ya pasó, etc.).

##### `addChildSection(nodes, parentSectionId, newSection)`
- **Qué hace:** Agrega una nueva sub-sección como hija de una sección existente.
- **Cómo:** Recorre el árbol recursivamente: si encuentra el nodo padre, agrega la nueva sección a su arreglo `children`. Si no, recorre los hijos del nodo actual.
- **Por qué:** La estructura jerárquica requiere inserción recursiva ya que el padre puede estar a cualquier nivel de profundidad.

##### `addResourceToTree(nodes, targetSectionId, resource)`
- **Qué hace:** Agrega un recurso (texto, documento, video, imagen) a una sección específica.
- **Cómo:** Busca recursivamente la sección objetivo y agrega el recurso a su arreglo `resources`.
- **Por qué:** Misma lógica recursiva que las secciones, aplicada a los recursos dentro de una sección.

##### `findSectionInTree(nodes, targetSectionId)`
- **Qué hace:** Busca y retorna una sección por ID en el árbol.
- **Cómo:** Recorre con un `for` cada nodo: si coincide el ID, lo retorna; si no, busca recursivamente en los hijos.
- **Por qué:** Se necesita para obtener los datos de una sección específica al navegar a su detalle.

##### `updateSectionInTree(nodes, targetSectionId, updates)`
- **Qué hace:** Actualiza `title` y `description` de una sección específica.
- **Cómo:** Recorre recursivamente el árbol y, al encontrar la sección objetivo, retorna una copia con los campos actualizados (patrón immutable).
- **Por qué:** React depende de la inmutabilidad para detectar cambios. Se crea un nuevo objeto en lugar de mutar el existente.

##### `removeSectionFromTree(nodes, targetSectionId)`
- **Qué hace:** Elimina una sección y toda su descendencia del árbol.
- **Cómo:** Primero filtra el nodo objetivo del arreglo actual con `.filter()`, luego recorre recursivamente los hijos de cada nodo sobreviviente.
- **Por qué:** Filtrar en cada nivel asegura que la sección se elimine sin importar dónde esté en la jerarquía.

##### `updateResourceInTree(nodes, sectionId, resourceId, updates)` / `removeResourceFromTree(nodes, sectionId, resourceId)`
- **Qué hacen:** Actualizan o eliminan un recurso específico dentro de una sección.
- **Cómo:** Buscan recursivamente la sección contenedora y luego modifican su arreglo `resources` con `.map()` o `.filter()`.

##### `deepCloneSection(section)`
- **Qué hace:** Crea una copia profunda de una sección con IDs completamente nuevos.
- **Cómo:** Genera nuevos IDs con `createId()` para la sección, cada recurso, y recursivamente para cada sub-sección.
- **Por qué:** Se usa al clonar un curso; los IDs nuevos evitan colisiones con el curso original.

#### Funciones de persistencia

##### `ensureCourseDefaults(courses)`
- **Qué hace:** Normaliza un arreglo completo de cursos.
- **Cómo:** Aplica `normalizeCourse()` a cada elemento con `.map()`.

##### `saveCourses(courses)` / `getCourses()`
- **Qué hacen:** Escriben/leen el arreglo de cursos desde localStorage.
- **`getCourses()`** además maneja casos de error (JSON inválido, datos no-array) retornando un arreglo vacío normalizado, y siempre re-guarda los datos normalizados.
- **Por qué:** Re-guardar después de normalizar mantiene los datos consistentes incluso si fueron editados manualmente en localStorage.

##### `getCourseById(courseId)`
- **Qué hace:** Busca un curso por su ID numérico.
- **Cómo:** Normaliza el ID a `Number`, luego busca en el arreglo de cursos con `.find()`.

#### Funciones CRUD de cursos

##### `createCourse(courseInput)`
- **Qué hace:** Crea un nuevo curso asignando al usuario actual como docente.
- **Cómo:** Genera un ID con `Date.now()`, obtiene el nombre del docente desde `getCurrentUserProfile().fullName`, inicializa con `isPublished: false` y `students: 0`, y prepend al arreglo de cursos.
- **Por qué:** Los cursos nuevos se crean como borrador (no publicados) para que el docente configure contenido antes de hacerlos visibles.

##### `updateCourseMetadata(courseId, updates)`
- **Qué hace:** Actualiza código, nombre, fechas y portada de un curso.
- **Cómo:** Busca el curso por ID en el arreglo y crea una copia con los campos actualizados usando `?.trim()` para strings y `||` para la imagen.
- **Por qué:** Solo modifica metadatos, no secciones ni evaluaciones, para mantener operaciones atómicas.

##### `setCoursePublishedState(courseId, isPublished)`
- **Qué hace:** Cambia el estado de publicación de un curso (publicado/oculto).
- **Cómo:** Busca el curso y actualiza solo el campo `isPublished`.

##### `syncTeacherNameForOwner(ownerId, teacherName)`
- **Qué hace:** Actualiza el nombre del docente en todos los cursos de un usuario.
- **Cómo:** Filtra cursos por `ownerId` y les asigna el nuevo `teacherName`.
- **Por qué:** Cuando un docente cambia su nombre en el perfil, todos sus cursos deben reflejar el cambio.

##### `deleteCourse(courseId)` / `cloneCourse(sourceId, courseInput)`
- **`deleteCourse`:** Filtra el curso del arreglo y guarda.
- **`cloneCourse`:** Lee el curso original, crea uno nuevo con `deepCloneSection()` para copiar secciones (con IDs nuevos), y lo agrega al inicio del arreglo. Las evaluaciones no se copian (`assessments: []`).

#### Funciones CRUD de secciones y recursos

##### `addCourseSection()`, `updateCourseSection()`, `deleteCourseSection()`
- Operan sobre el árbol de secciones del curso, delegando en los helpers de árbol correspondientes.

##### `addSectionResource()`, `updateSectionResource()`, `deleteSectionResource()`
- Operan sobre los recursos dentro del árbol de secciones, delegando en `addResourceToTree`, `updateResourceInTree`, `removeResourceFromTree`.

---

## registrationStore.js

### ¿Qué hace?
Gestiona las matrículas de estudiantes en cursos: matricular, verificar matrícula, y listar estudiantes de un curso.

### ¿Cómo lo hace?

#### Constantes y helpers internos

##### `AUTH_USERS_KEY` / `SOCIAL_USERS_KEY`
- Claves de localStorage donde authStore y socialStore guardan sus respectivas listas de usuarios.

##### `getRegisteredCourseIdsStorageKey()`
- **Qué hace:** Genera la clave de localStorage específica del usuario actual para sus matrículas.
- **Cómo:** Concatena `REGISTERED_COURSE_IDS_KEY` con `getCurrentUserIdentity()`, produciendo algo como `tec_digitalito_enrolled_course_ids_juan123`.
- **Por qué:** Cada usuario tiene su propia lista de matrículas, separadas por clave de localStorage.

##### `readStoredUsers()`
- **Qué hace:** Consolida la información de usuarios de múltiples fuentes en un solo Map.
- **Cómo:** Lee usuarios de `tec_digitalito_users` (authStore), `tec_digitalito_system_users` (socialStore), y el usuario actual de sesión (`user`). Combina todo en un `Map` indexado por `userId`, donde las entradas posteriores sobreescriben las anteriores.
- **Por qué:** Los datos de usuario están distribuidos en varias claves de localStorage porque authStore y socialStore los gestionan independientemente. Esta función los unifica para mostrar nombres y avatares reales.

#### Funciones exportadas

##### `getRegisteredCourseIds()`
- **Qué hace:** Retorna la lista de IDs de cursos en los que el usuario actual está matriculado.
- **Cómo:** Lee el arreglo JSON de la clave específica del usuario, parsea los IDs y los normaliza a `Number`.

##### `isCourseRegistered(courseId)`
- **Qué hace:** Verifica si el usuario actual está matriculado en un curso específico.
- **Cómo:** Comprueba si el ID normalizado está en la lista de `getRegisteredCourseIds()`.

##### `registerInCourse(courseId)`
- **Qué hace:** Matricula al usuario actual en un curso.
- **Cómo:** Agrega el ID del curso a la lista del usuario en localStorage, e incrementa el contador `students` del curso en el arreglo de cursos.
- **Por qué:** Actualiza dos cosas: la lista personal del usuario (para saber en qué cursos está) y el contador del curso (para mostrar cuántos estudiantes hay).

##### `getRegisteredStudentsForCourse(courseId)`
- **Qué hace:** Retorna la lista de estudiantes matriculados en un curso, con sus perfiles enriquecidos.
- **Cómo:** Escanea TODAS las claves de localStorage que empiezan con el prefijo de matrículas, verifica cuáles incluyen el `courseId` buscado, luego cruza los IDs de usuario con `readStoredUsers()` para obtener nombres completos y avatares. Ordena alfabéticamente por nombre.
- **Por qué:** No hay una tabla centralizada de matrículas por curso; cada usuario tiene su propia lista. Se necesita escanear todas las claves para reconstruir la lista completa de un curso.

##### `getAllAssessmentResultsRaw()`
- **Qué hace:** Lee todos los resultados de evaluaciones (helper interno).
- **Cómo:** Parsea el JSON de la clave `tec_digitalito_assessment_results`.
- **Por qué:** Se usa como fuente adicional de usernames para enriquecer la lista de estudiantes.

---

## assessmentStore.js

### ¿Qué hace?
Gestiona el CRUD de evaluaciones de cursos y el almacenamiento/consulta de resultados de intentos de estudiantes.

### ¿Cómo lo hace?

#### `getAllAssessmentResults()`
- **Qué hace:** Lee todos los resultados de evaluaciones de localStorage.
- **Cómo:** Parsea el JSON almacenado bajo `ASSESSMENT_RESULTS_KEY`.

#### `addCourseAssessment(courseId, assessmentInput)`
- **Qué hace:** Crea una nueva evaluación para un curso.
- **Cómo:** Genera un ID único para la evaluación y para cada pregunta y opción con `createId()`. Agrega la evaluación al arreglo `assessments` del curso.
- **Por qué:** Cada pregunta y opción necesita su propio ID para poder rastrear respuestas individuales en los resultados.

#### `getAssessmentById(courseId, assessmentId)`
- **Qué hace:** Busca una evaluación específica dentro de un curso.
- **Cómo:** Primero obtiene el curso con `getCourseById()`, luego busca en su arreglo `assessments` con `.find()`.

#### `updateCourseAssessment(courseId, assessmentId, updates)`
- **Qué hace:** Actualiza una evaluación existente (título, fechas, preguntas).
- **Cómo:** Localiza la evaluación dentro del arreglo de assessments del curso y crea una copia con los campos actualizados. Si `updates.questions` está definido, regenera IDs para preguntas/opciones nuevas (que no tengan `id`).
- **Por qué:** Permite que el docente edite evaluaciones antes de que los estudiantes las realicen. Los IDs se regeneran solo para nuevos ítems.

#### `deleteCourseAssessment(courseId, assessmentId)`
- **Qué hace:** Elimina una evaluación de un curso.
- **Cómo:** Filtra la evaluación del arreglo `assessments` del curso con `.filter()`.

#### `getCourseAssessmentResults(courseId)` / `getAssessmentResult(courseId, assessmentId)` / `getAssessmentResultByUser(courseId, assessmentId, userId)`
- **Qué hacen:** Consultan resultados de evaluaciones con diferentes filtros.
- **`getCourseAssessmentResults`:** Todos los resultados del usuario actual para un curso.
- **`getAssessmentResult`:** El resultado específico del usuario actual para una evaluación.
- **`getAssessmentResultByUser`:** El resultado de cualquier usuario para una evaluación (usado por docentes para ver respuestas).

#### `saveAssessmentResult(courseId, assessmentId, resultInput)`
- **Qué hace:** Guarda el resultado de un intento de evaluación.
- **Cómo:** Verifica que no exista un resultado previo (solo se permite un intento). Crea un objeto con la nota, respuestas correctas, total de preguntas, detalle pregunta por pregunta, y timestamp. Lo agrega al arreglo de resultados en localStorage.
- **Por qué:** La restricción de un solo intento simula el comportamiento típico de exámenes académicos.

---

## socialStore.js

### ¿Qué hace?
Gestiona el sistema social: registro de usuarios conocidos, búsqueda, amistades, solicitudes de amistad y actividad de cursos de cada usuario.

### ¿Cómo lo hace?

#### Helpers de persistencia

##### `readJson(key, fallback)` / `writeJson(key, value)`
- **Qué hacen:** Lectura/escritura genérica de JSON en localStorage con manejo de errores.
- **Por qué:** Centralizan la lógica de parseo/serialización que se repite en cada operación.

##### `normalizeUser(user)`
- **Qué hace:** Asegura que un objeto de usuario tenga todos los campos requeridos con valores por defecto.
- **Cómo:** Extrae y normaliza `id`, `username`, `fullName`, `role`, `avatar`, `dateOfBirth`, usando fallbacks encadenados.

##### `buildFriendshipKey(userAId, userBId)`
- **Qué hace:** Genera una clave única e idempotente para una relación de amistad.
- **Cómo:** Ordena alfabéticamente los dos IDs y los une con `::` (ej: `"ana123::juan456"`).
- **Por qué:** Independientemente de quién envió la solicitud, la clave de amistad es la misma. Esto facilita buscar si dos usuarios ya son amigos sin importar el orden.

##### `seedUsers()`
- **Qué hace:** Sincroniza y consolida todos los usuarios conocidos en el sistema social.
- **Cómo:** Combina usuarios de `BUILT_IN_USERS` (vacío actualmente), los almacenados en `USERS_STORAGE_KEY`, y el usuario de sesión actual. Los deduplica por ID en un `Map`, ordena alfabéticamente, y guarda el resultado.
- **Por qué:** Garantiza que todos los usuarios conocidos estén disponibles para búsqueda y se muestren con datos actualizados.

#### Funciones de solicitudes de amistad

##### `sendFriendRequest(fromUserId, toUserId)`
- **Qué hace:** Envía una solicitud de amistad de un usuario a otro.
- **Cómo:** Verifica que no sean el mismo usuario, que no sean ya amigos, y que no exista una solicitud previa (en cualquier dirección). Si todo es válido, agrega la solicitud al arreglo con `from`, `to`, y `createdAt`.

##### `getPendingRequestsForUser(userId)` / `getSentRequestsForUser(userId)`
- **Qué hacen:** Retornan solicitudes recibidas/enviadas por un usuario.
- **Cómo:** Filtran el arreglo de solicitudes por `to` (recibidas) o `from` (enviadas).

##### `getFriendRequestStatus(userA, userB)`
- **Qué hace:** Determina el estado de relación entre dos usuarios.
- **Cómo:** Verifica en orden: si son amigos (`'friends'`), si A envió solicitud a B (`'sent'`), si B envió a A (`'received'`), o si no hay relación (`'none'`).
- **Por qué:** La UI necesita saber qué botón mostrar: "Enviar solicitud", "Procesando solicitud", "Aceptar/Rechazar", o nada.

##### `acceptFriendRequest(fromUserId, toUserId)`
- **Qué hace:** Acepta una solicitud de amistad.
- **Cómo:** Elimina la solicitud del arreglo y llama a `addFriend()` para crear la amistad.

##### `rejectFriendRequest(fromUserId, toUserId)`
- **Qué hace:** Rechaza una solicitud eliminándola del arreglo.

#### Funciones de amistad

##### `addFriend(userId, friendId)`
- **Qué hace:** Crea una amistad entre dos usuarios.
- **Cómo:** Genera la clave de amistad, verifica que no exista ya, y la agrega al arreglo de amistades con la clave, los IDs ordenados, y timestamp.

##### `areFriends(userId, otherUserId)`
- **Qué hace:** Verifica si dos usuarios son amigos.
- **Cómo:** Genera la clave de amistad y busca si existe en el arreglo.

##### `getFriendsForUser(userId)`
- **Qué hace:** Retorna la lista completa de amigos de un usuario con sus perfiles.
- **Cómo:** Filtra amistades que incluyan al usuario, extrae los IDs del otro amigo, y busca sus perfiles en `getAllUsers()`.

#### `getUserCourseActivity(userId)`
- **Qué hace:** Retorna los cursos que un usuario enseña y en los que está matriculado.
- **Cómo:** Filtra cursos por `ownerId` (enseñando) y por presencia en `getRegisteredStudentsForCourse()` (matriculado).
- **Por qué:** Se usa en la página de Comunidad para mostrar la actividad académica de un amigo.

---

## messageStore.js

### ¿Qué hace?
Gestiona el sistema de mensajería directa entre usuarios: envío, lectura, conteo de no leídos, y resúmenes de conversaciones.

### ¿Cómo lo hace?

#### Helpers internos

##### `buildConversationKey(a, b)`
- **Qué hace:** Genera una clave única para una conversación entre dos usuarios.
- **Cómo:** Ordena los IDs alfabéticamente y los une con `::`.
- **Por qué:** Igual que friendshipKey, garantiza que la conversación entre A→B y B→A se identifique como la misma.

##### `normalizeMessageReadState(message)`
- **Qué hace:** Asegura que un mensaje tenga campos `isSeen` y `seenAt` con valores por defecto.

#### Migraciones

##### `migrateLegacyCourseMessages()`
- **Qué hace:** Migra mensajes del formato antiguo (por curso) al formato actual unificado.
- **Cómo:** Lee la clave legacy `tec_digitalito_course_messages`, transforma cada mensaje al formato con `contextType: 'course'`, y los fusiona con los mensajes actuales evitando duplicados por ID. Marca la migración como hecha con una flag.
- **Por qué:** El sistema originalmente usaba mensajes asociados a cursos. Se migró a un sistema unificado de mensajería directa.

##### `bridgeCourseMessagesToDirect()`
- **Qué hace:** Crea copias "directas" de mensajes que originalmente eran de curso.
- **Cómo:** Para cada mensaje con `contextType: 'course'`, crea una copia con `contextType: 'direct'` y un ID prefijado con `course-bridge-`. Evita duplicados comparando firmas (sender + receiver + text + timestamp).
- **Por qué:** Los mensajes enviados dentro de un curso también deben aparecer en la bandeja de mensajes directos del usuario.

#### Funciones exportadas

##### `getConversationMessages({ contextType, contextId, userAId, userBId })`
- **Qué hace:** Retorna todos los mensajes de una conversación específica.
- **Cómo:** Filtra por `contextType`, `contextId`, y `conversationKey` (generada a partir de los dos usuarios). Ordena cronológicamente.

##### `saveMessage(messageInput)`
- **Qué hace:** Guarda un nuevo mensaje.
- **Cómo:** Crea el objeto del mensaje con ID, datos del remitente/destinatario, texto, `conversationKey`, `isSeen: false`, y timestamp actual. Lo agrega al arreglo y persiste.

##### `markConversationMessagesAsSeen({ contextType, contextId, viewerId, otherUserId })`
- **Qué hace:** Marca como leídos todos los mensajes no leídos recibidos por el usuario en una conversación.
- **Cómo:** Recorre todos los mensajes, identifica los que son de la conversación correcta, dirigidos al viewer, y aún no leídos. Los marca con `isSeen: true` y `seenAt: now`.
- **Por qué:** El conteo de "no leídos" se actualiza cuando el usuario abre una conversación.

##### `getUnseenMessageCountForConversation(...)` / `getTotalUnseenMessageCount(...)`
- **Qué hacen:** Cuentan mensajes no leídos para una conversación específica o en total.

##### `getDirectConversationSummaries(viewerId)`
- **Qué hace:** Genera un resumen de todas las conversaciones directas del usuario.
- **Cómo:** Recorre todos los mensajes directos, agrupa por `otherUserId`, y para cada conversación calcula: conteo de no leídos, timestamp del último mensaje, y texto del último mensaje.
- **Por qué:** Se usa para la lista de contactos en la página de mensajería, mostrando quién tiene mensajes sin leer y el preview del último mensaje.
