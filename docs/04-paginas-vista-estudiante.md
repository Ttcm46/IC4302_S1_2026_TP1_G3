# Documentación: Páginas de Vista Estudiante y Evaluaciones

## Índice
1. [StudentCourseView.jsx (EnrolledCourse)](#studentcourseviewjsx)
2. [StudentSectionView.jsx (EnrolledSectionDetail)](#studentsectionviewjsx)
3. [AssessmentAttempt.jsx](#assessmentattemptjsx)
4. [AssessmentResult.jsx](#assessmentresultjsx)
5. [AssessmentSubmissions.jsx](#assessmentsubmissionsjsx)
6. [CourseMembers.jsx](#coursemembersjsx)

---

## StudentCourseView.jsx

### ¿Qué hace?
Es la vista principal de un curso para el estudiante matriculado. Organiza el contenido en 4 pestañas: Contenido, Participantes, Evaluaciones e Información.

### ¿Cómo lo hace?

#### Funciones helper (fuera del componente)

##### `ChatIcon()`
- Componente SVG inline que renderiza el ícono de burbuja de chat.
- **Por qué:** Usar SVG inline en lugar de una imagen externa evita peticiones HTTP adicionales y permite controlar el color con CSS (`currentColor`).

##### `getCurrentUser()`
- Lee y parsea `user` de localStorage.

##### `formatDateTime(dateValue, timeValue)` / `formatDate(value)`
- Convierten fechas ISO a formato local `es-CR`.
- Usan `T00:00:00` para fijar la hora y evitar problemas de zona horaria.

##### `getAssessmentStatus(assessment)`
- **Qué hace:** Determina si una evaluación es `'upcoming'`, `'closed'` o `'available'`.
- **Cómo:** Crea objetos `Date` para `startDate+startTime` y `endDate+endTime`. Compara con `new Date()` (momento actual).
  - Si la hora actual es **antes** del inicio → `'upcoming'`
  - Si es **después** del fin → `'closed'`
  - En cualquier otro caso → `'available'`
- **Por qué:** Los estudiantes solo deben poder acceder a la evaluación durante su ventana de tiempo.

##### `renderResourcePreview(resource)`
- Renderiza el contenido de un recurso según su tipo:
  - `text`: Párrafo con el texto.
  - `video` con `fileData`: Elemento `<video>` con controles.
  - `image`: `<img>`.
  - Cualquier otro con `fileData`: Link "Abrir archivo".
  - Sin datos: Aviso "Recurso sin vista previa."
- **Por qué:** Un único helper centraliza la lógica de renderizado de recursos, evitando duplicar código en múltiples secciones de la vista.

##### `buildParticipants(course, currentUser, enrolledUsers)`
- **Qué hace:** Construye la estructura de datos de participantes (docente + estudiantes) para la pestaña de Participantes.
- **Cómo:** Extrae al docente desde `course.ownerId` y `course.teacher`. Mapea cada `enrolledUser` con su `userId`, `displayName`, y `roleLabel`. Si el estudiante es el usuario actual, su etiqueta es `'Tu cuenta'`.
- **Por qué:** Centralizar esta lógica permite que el renderizado de la pestaña sea declarativo y simple.

#### Estado del componente
- `activeTab`: Controla cuál de las 4 pestañas se muestra (`'content'`, `'participants'`, `'assessments'`, `'info'`).

#### Lectura de pestaña desde URL
- Lee el parámetro `?tab=` de la URL con `useSearchParams`.
- `useEffect` sincroniza `activeTab` si el parámetro cambia externamente (ej: el botón "Volver al curso" desde mensajería pasa `?tab=participants`).
- **Por qué:** Almacenar el tab activo en la URL permite navegar con el botón Atrás del navegador y compartir enlaces a una pestaña específica.

#### Datos cargados
- `course`: Curso por ID.
- `currentUser` / `currentUserId`: Identidad del usuario actual.
- `isEnrolled`: Verifica matrícula con `isCourseRegistered(id)`.
- `enrolledUsers`: Lista de estudiantes con perfiles enriquecidos desde `getRegisteredStudentsForCourse(id)`.
- `results`: Resultados de evaluaciones del usuario actual, ordenados del más reciente al más antiguo.
- `resultsByAssessmentId` (useMemo): Map de `assessmentId → result` para lookup O(1) al renderizar la lista de evaluaciones.

#### Protecciones de acceso
- Si el curso no existe: muestra aviso y botón para volver al dashboard.
- Si el usuario no está matriculado Y no es el creador del curso: muestra aviso con link para matricularse.

#### Pestaña Contenido
- Grid de tarjetas, una por cada sección raíz del curso.
- Cada tarjeta es un `<Link>` a `/courses/:id/registered/sections/:sectionId`.
- Muestra título, descripción, cantidad de subtemas y recursos.

#### Pestaña Participantes
- Divide en dos artículos: Docente y Estudiantes.
- Cada participante tiene un `<Link>` a `/social/messages?targetId=...` para abrir chat directo, **excepto el usuario actual** (no puedes chatear contigo mismo).
- El link de chat pasa parámetros: `targetId`, `targetName`, `targetRole`, `fromCourseId`, `fromCourseName` para que la página de mensajería sepa el contexto.

#### Pestaña Evaluaciones
- Lista cada evaluación con su status calculado y el resultado guardado (si existe).
- Botones condicionales:
  - Si ya realizó la evaluación: botón deshabilitado "Evaluación ya realizada" + link "Ver resultados".
  - Si está disponible: link "Realizar evaluación".
  - Si está próxima: botón deshabilitado "Aún no disponible".
  - Si está cerrada: botón deshabilitado "Evaluación cerrada".

#### Pestaña Información
- Muestra descripción del curso y metadatos (docente, estudiantes, fechas) en un grid.

---

## StudentSectionView.jsx

### ¿Qué hace?
Muestra el detalle completo de una sección específica para el estudiante: descripción, recursos y subtemas navegables.

### ¿Cómo lo hace?

#### Funciones helper

##### `findParentSectionId(nodes, targetId, parentId = null)`
- Recorre recursivamente el árbol de secciones buscando el nodo con `targetId` y retorna el ID de su padre.
- Si el nodo es raíz (sin padre), retorna `null`.
- **Por qué:** Se usa para construir el botón "Volver": si la sección tiene padre, vuelve al padre; si es raíz, vuelve al curso.

##### `findSectionPath(nodes, targetId, currentPath = [])`
- Construye el **breadcrumb trail** (ruta jerárquica) desde la raíz hasta la sección actual.
- Acumula los nodos del camino en `currentPath`. Si encuentra el target, retorna el path acumulado. Si no, recorre recursivamente los hijos.
- **Por qué:** La UI muestra "Curso matriculado / Tema A / Subtema B / Tema actual" para orientar al usuario en la jerarquía.

#### `handleBack()`
- Si hay `parentSectionId`: navega a la sección padre.
- Si no (es raíz): navega al curso matriculado.
- **Por qué:** Permite navegar hacia arriba en la jerarquía de secciones de forma intuitiva, como un explorador de archivos.

#### Renderizado

##### Breadcrumbs
- Usando `sectionPath`, renderiza links a cada nivel de la jerarquía. El último elemento (sección actual) no es link, solo texto.
- **Por qué:** Orientación visual necesaria cuando las secciones pueden tener múltiples niveles de profundidad.

##### Sección "Archivos y recursos"
- Renderiza cada recurso con `renderResourcePreview()`.
- Muestra etiqueta de tipo (Texto / Video / Imagen / Documento).

##### Sección "Subtemas"
- Grid de tarjetas, cada una es un `<Link>` a la sección hija.
- Muestra título, descripción, y contadores de subtemas y recursos del hijo.

---

## AssessmentAttempt.jsx

### ¿Qué hace?
Permite al estudiante realizar una evaluación de opción múltiple.

### ¿Cómo lo hace?

#### Estado
- `hasStarted`: Controla si el estudiante comenzó o está en la pantalla de presentación.
- `answers`: Map de `questionId → optionIndex` (respuesta seleccionada por pregunta).
- `attemptError`: Error de validación durante el intento.
- `submittedResult`: Resultado justo después de enviar (para mostrar inmediatamente sin recargar).

#### Datos cargados
- `course`, `assessment`: Datos del curso y evaluación.
- `isEnrolled`: Verificación de matrícula.
- `existingResult` (useMemo): Incluye `submittedResult` en las dependencias para re-evaluarse después de enviar.

#### Protecciones de acceso
- Curso o evaluación no encontrados → aviso con botón volver.
- No matriculado ni creador → aviso con link para matricularse.

#### Flujo de la pantalla
1. **Pantalla de inicio** (`!hasStarted` y `!resultToShow`): Muestra metadatos de la evaluación (fechas, cantidad de preguntas) y botón "Comenzar evaluación".
2. **Pantalla de preguntas** (`hasStarted`): Muestra todas las preguntas con radio buttons. Botones "Enviar" y "Cancelar".
3. **Resultado ya registrado** (`resultToShow`): Muestra banner con nota y link "Ver resultados".

#### `handleAnswerChange(questionId, optionIndex)`
- Actualiza el Map `answers` con la respuesta seleccionada para esa pregunta.

#### `handleSubmit()`
- Valida que no exista resultado previo (doble protección, además de la del store).
- Valida que **todas** las preguntas tengan respuesta.
- Calcula la nota: `(correctas / total) * 100` redondeado.
- Construye `questionResults`: arreglo con `questionId`, texto, opciones, `correctOptionIndex`, y `selectedOptionIndex` para cada pregunta.
- Llama a `saveAssessmentResult(course.id, assessment.id, { score, correctAnswers, totalQuestions, questionResults })`.
- Almacena el resultado en `submittedResult` para mostrarlo de inmediato sin esperar re-render.

#### ¿Por qué solo un intento?
La restricción de un solo intento se verifica en dos niveles:
1. `handleSubmit()` verifica `existingResult` antes de procesar.
2. `saveAssessmentResult()` en el store también lo verifica antes de guardar.

Esta doble verificación previene condiciones de carrera y manipulaciones del DOM.

---

## AssessmentResult.jsx

### ¿Qué hace?
Muestra el resultado detallado de una evaluación ya realizada por el estudiante, con el análisis pregunta por pregunta.

### ¿Cómo lo hace?

#### Funciones helper

##### `getAnswerClass(isSelected, isCorrect)`
- Retorna la clase CSS para colorear cada opción:
  - `'correct'`: La opción correcta (se colorea aunque no fue seleccionada, para mostrar cuál era).
  - `'selected-wrong'`: Opción seleccionada incorrectamente (roja).
  - `''`: Opción incorrecta no seleccionada (sin color especial).
- **Por qué:** El estudiante necesita ver no solo si respondió bien o mal, sino también cuál era la respuesta correcta.

#### Datos cargados
- `result`: Resultado del usuario para esta evaluación, obtenido con `getAssessmentResult(id, assessmentId)`.

#### Protecciones
- Curso o evaluación no encontrados → aviso.
- No matriculado → aviso con link.
- Sin resultado registrado → aviso con link para realizar la evaluación.

#### Grid de metadata
Muestra: usuario participante, nota (%), correctas/total, fechas de inicio/fin de la evaluación, timestamp de cuando fue presentada.

#### Detalle de preguntas
- Para cada pregunta en `result.questionResults`:
  - Muestra el texto de la pregunta.
  - Lista cada opción con la clase CSS de `getAnswerClass()`.
  - Etiquetas "Tu respuesta" y "Correcta" (pueden coexistir si respondió bien).
- Si el intento no tiene `questionResults` (guardado antes de que se implementara): muestra aviso de compatibilidad.

---

## AssessmentSubmissions.jsx

### ¿Qué hace?
Vista para el **docente** de las respuestas de todos los estudiantes a una evaluación específica.

### ¿Cómo lo hace?

#### Datos cargados
- `students`: Lista de estudiantes matriculados con `getRegisteredStudentsForCourse(id)`.
- `selectedUserId`: ID del estudiante actualmente seleccionado (inicializado con el primero de la lista).

#### Layout de dos paneles
- **Panel izquierdo:** Lista de estudiantes matriculados como botones. El botón activo tiene clase `'active'`. Al hacer clic en uno, actualiza `selectedUserId`.
- **Panel derecho:** Resultado del estudiante seleccionado.

#### `selectedResult` (useMemo)
- Llama a `getAssessmentResultByUser(id, assessmentId, selectedUserId)`.
- Se recalcula cuando cambia `selectedUserId`.
- Si el estudiante no ha realizado la evaluación, retorna `null`.

#### Estados del panel derecho
- Sin estudiante seleccionado: "Selecciona un estudiante".
- Estudiante sin resultado: "Evaluación no realizada" + nombre del estudiante.
- Con resultado: Mismo formato que `AssessmentResult.jsx` (metadata + preguntas con respuestas coloreadas).

#### ¿Por qué no se usa el mismo componente que AssessmentResult?
`AssessmentResult` usa `getAssessmentResult()` que filtra por el usuario actual. `AssessmentSubmissions` necesita ver los resultados de cualquier usuario, por lo que usa `getAssessmentResultByUser()`. Aunque el renderizado del detalle es similar, la fuente de datos y el contexto son distintos (estudiante vs. docente).

---

## CourseMembers.jsx

### ¿Qué hace?
Página que muestra el docente y todos los estudiantes matriculados en un curso, con sus avatares.

### ¿Cómo lo hace?

#### `getInitials(fullName, username)`
- Genera iniciales a partir del nombre completo (ej: "Juan Pérez" → "JP") o del username (ej: "jpinto" → "J").
- **Por qué:** Fallback visual cuando el usuario no tiene avatar.

#### `MemberAvatar({ avatar, fullName, username })`
- Componente visual que muestra:
  - `<img>` si el usuario tiene avatar.
  - `<div>` circular con las iniciales si no tiene avatar.
- **Por qué:** Componentizar el avatar evita duplicar la lógica de fallback en el docente y en cada estudiante.

#### Datos cargados
- `course`: Datos del curso.
- `students`: Lista de estudiantes con perfiles de `getRegisteredStudentsForCourse(id)` (incluye `fullName`, `username`, `avatar`).
- `teacherUser`: Perfil completo del docente obtenido con `getUserById(course.ownerId)` desde socialStore.
  - **Por qué:** El curso almacena el nombre del docente como string, pero para mostrar el avatar real se necesita el perfil completo del usuario.

#### Renderizado
- **Panel docente:** Muestra avatar real + nombre + etiqueta "Docente del curso".
- **Panel estudiantes:** Grid de filas, cada una con avatar, nombre completo y `@username`.
- Si no hay estudiantes: estado vacío "Aún no hay estudiantes matriculados".
