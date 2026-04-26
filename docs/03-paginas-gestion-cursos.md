# Documentación: Páginas de Gestión de Cursos (Docente)

## Índice
1. [Dashboard.jsx](#dashboardjsx)
2. [CourseCatalog.jsx](#coursecatalogjsx)
3. [CourseDetail.jsx](#coursedetailjsx)
4. [CreateCourse.jsx](#createcoursejsx)
5. [CloneCourse.jsx](#clonecoursejsx)
6. [CourseEditor.jsx](#courseeditorjsx)
7. [SectionEditor.jsx](#sectioneditorjsx)
8. [AssessmentEditor.jsx](#assessmenteditorjsx)

---

## Dashboard.jsx

### ¿Qué hace?
Es la página principal del usuario autenticado. Muestra un resumen de su actividad: cursos creados, cursos matriculados, amigos y mensajes no leídos.

### ¿Cómo lo hace?

#### `getCurrentUser()`
- Lee y parsea el objeto `user` de localStorage.
- **Por qué:** El dashboard necesita el nombre del usuario para el saludo y su ID para filtrar datos.

#### `getInitials(friend)`
- Genera las iniciales de un usuario (ej: "Ana García" → "AG").
- **Por qué:** Se usa como fallback visual cuando el amigo no tiene avatar.

#### `HorizontalCarousel({ items, getKey, renderItem, ariaLabel, ... })`
- **Qué hace:** Componente de carrusel con scroll horizontal, botones de avance/retroceso y detección automática de si el scroll es necesario.
- **Cómo:**
  - `trackRef`: Referencia al elemento scrollable.
  - `canScrollLeft` / `canScrollRight`: Estado que indica si hay más contenido a cada lado (con umbral de 4px para evitar falsos positivos).
  - `useEffect`: Escucha los eventos `scroll` y `resize`, y usa `ResizeObserver` para recalcular los controles cuando cambia el tamaño. Retorna una función de limpieza que elimina todos los listeners.
  - `scrollByStep(direction)`: Hace scroll de un 85% del ancho del contenedor (mínimo 240px) con animación suave (`behavior: 'smooth'`).
  - Si `showControls` es `false` (todo el contenido cabe sin scroll), los botones no se renderizan y se aplica la clase `no-controls`.
- **Por qué:** Un carrusel con scroll propio es necesario porque la cantidad de tarjetas puede variar. Los controles se calculan dinámicamente para no mostrarse si no hay overflow. El `ResizeObserver` asegura que los controles se actualicen si la ventana cambia de tamaño.

#### `getCourseStatus(course)`
- Retorna etiqueta y clase CSS según el estado del curso: `'Terminado'` / `'Publicado'` / `'Oculto'`.
- **Por qué:** Los badges de estado se usan en múltiples tarjetas del dashboard para dar contexto visual rápido.

#### `Dashboard()` — componente principal
- **`allCourses`:** Todos los cursos del sistema (filtrado posterior por `createdByCurrentUser`).
- **`unreadMessages`:** Conteo de mensajes directos no leídos del usuario actual.
- **`friends`:** Lista de amigos del usuario.
- **`createdCourses`:** Cursos donde `course.createdByCurrentUser === true` (calculado por `normalizeCourse` al leer).
- **`enrolledCourses`:** Cruza `getRegisteredCourseIds()` con `allCourses` para obtener los cursos en los que el usuario está matriculado.

#### Renderizado
- **Sección Resumen:** 4 métricas en grid: cursos creados, matriculados, amigos, mensajes sin leer.
- **Sección Amigos:** Carrusel de avatares de amigos, cada uno es un `<Link>` a `/social?userId=...`. Botones para ir a Comunidad o Mensajes.
- **Sección Cursos creados:** Carrusel de tarjetas de cursos con badge de estado. Link a `/courses/:id/manage`. Botón para crear curso.
- **Sección Cursos matriculados:** Carrusel similar. Link a `/courses/:id/registered`. Botón para ir al catálogo.

---

## CourseCatalog.jsx

### ¿Qué hace?
Muestra el catálogo público de cursos disponibles y permite buscarlos por nombre, código o descripción.

### ¿Cómo lo hace?

#### Estado
- `searchTerm`: Texto ingresado en el buscador.

#### `allCourses`
- Carga todos los cursos con `getCourses()` y filtra solo los que están **publicados o terminados** (`isPublished || isFinished`).
- **Por qué:** Los cursos ocultos (borradores) no deben aparecer en el catálogo público. Los cursos terminados sí se mantienen visibles para referencia histórica.

#### `filteredCourses`
- Filtra `allCourses` comparando el `searchTerm` en minúsculas contra `name`, `code` y `description`.
- **Por qué:** La búsqueda en tiempo real (sin botón submit) da feedback instantáneo mientras el usuario escribe.

#### Renderizado
- Header con título y botón "Crear curso" que navega a `/create-course`.
- Input de búsqueda.
- Contador de resultados.
- Grid de `<CourseCard>` para cada curso filtrado.

---

## CourseDetail.jsx

### ¿Qué hace?
Muestra la página pública de un curso con su información completa y permite a los estudiantes matricularse.

### ¿Cómo lo hace?

#### Datos cargados
- `course`: Curso obtenido por `getCourseById(id)`.
- `isEnrolled`: Si el usuario actual ya está matriculado con `isCourseRegistered(id)`.

#### Tarjeta de matrícula
Muestra condicionalmente según el estado del usuario y del curso:
- Si el curso está **terminado** (`course.isFinished`): Badge rojo "Este curso ha terminado", botón deshabilitado.
- Si ya está **matriculado**: Badge verde "Curso matriculado", link a la vista de estudiante.
- Si **no está matriculado** y el curso está activo: Botón "Matricularse" que llama a `registerInCourse(id)` y recarga la página.
- Si **creó el curso** el usuario actual: Link "Administrar curso".

#### `formatDate(value)`
- Convierte una fecha ISO (`YYYY-MM-DD`) a formato local `es-CR` (Costa Rica).
- Usa `new Date(\`${value}T00:00:00\`)` con hora fija medianoche para evitar desplazamientos de zona horaria.
- **Por qué:** Si se usa `new Date(value)` directamente con solo la fecha, algunos navegadores la interpretan como UTC y la muestran un día antes en zonas negativas.

#### `handleEnroll()`
- Llama a `registerInCourse(id)` para matricular al usuario y actualiza el estado local `isEnrolled` a `true`.
- **Por qué:** Actualizar el estado local de inmediato (sin recargar) muestra el badge "Curso matriculado" instantáneamente, siguiendo el patrón de actualización optimista en SPAs.

#### Renderizado
- Hero con imagen de portada, nombre, código, descripción, docente.
- Metadata: fecha de inicio, fin, estudiantes matriculados.
- Árbol de secciones (solo títulos y descripciones, sin contenido — requiere matrícula).
- Sidebar con tarjeta de matrícula.

---

## CreateCourse.jsx

### ¿Qué hace?
Formulario para que el docente cree un nuevo curso.

### ¿Cómo lo hace?

#### Estado
- `form`: Objeto con `code`, `name`, `description`, `startDate`, `endDate`, `coverImage` (base64).
- `preview`: String base64 de la imagen para mostrarla antes de guardar.
- `error`: Mensaje de error de validación.

#### `handleChange(event)`
- Manejador genérico para todos los inputs de texto del formulario (`code`, `name`, `description`, `startDate`, `endDate`). Usa `event.target.name` para actualizar el campo correspondiente en `form`.

#### `handleImage(event)`
- Lee el archivo de imagen con `FileReader.readAsDataURL()` y guarda el base64 en `form.coverImage` y en `preview`.
- **Por qué:** Sin backend de almacenamiento, las imágenes se guardan como strings base64 en localStorage.

#### `handleSubmit(event)`
- **Validaciones:** Código, nombre y fecha de inicio son obligatorios. La fecha de fin no puede ser menor que la de inicio.
- Llama a `createCourse({ ...form, coverImage })`.
- Navega a `/courses/${newCourse.id}/manage` para que el docente construya el contenido inmediatamente.
- **Por qué:** Redirigir directamente al editor evita el paso intermedio de ir al dashboard y buscar el curso recién creado.

---

## CloneCourse.jsx

### ¿Qué hace?
Permite al docente clonar un curso existente creando una copia con nuevo código, nombre y fechas.

### ¿Cómo lo hace?

#### Estado
- `form`: Nuevo código, nombre, fechas para el curso clonado.
- `coverImage`: Nueva imagen de portada (opcional; si no se sube, hereda la del original).
- `error`: Mensaje de error.

#### `countSectionResources(section)`
- Cuenta recursivamente el total de recursos propios de una sección más los de todos sus hijos (y sus descendientes).
- **Por qué:** Permite mostrar en el panel de resumen cuantos materiales se copiarán por cada sección, sin aplanar manualmente el árbol.

#### `SectionSummaryNode({ section, depth })`
- Componente interno que renderiza recursivamente el árbol de secciones del curso original como vista previa de lo que se copiará.
- **Por qué:** Antes de confirmar la clonación, el docente puede ver exactamente qué temas y subtemas se incluirán en la copia.

#### `handleChange(event)`
- Manejador genérico para todos los inputs del formulario de clonación (`code`, `name`, `startDate`, `endDate`). Usa `event.target.name` para actualizar el campo en `form`.

#### `handleImage(event)`
- Lee la nueva imagen de portada como base64 con `FileReader.readAsDataURL()` y la guarda en `form.coverImage` y en `preview`.
- **Por qué:** La clonación puede optar por reutilizar la imagen original o subir una nueva; si no se sube nada, `cloneCourse()` hereda la del curso original.

#### `handleSubmit(event)`
- Valida que código, nombre y fecha de inicio no estén vacíos.
- Llama a `cloneCourse(id, { ...form, coverImage: form.coverImage })`.
- Navega al editor del nuevo curso.
- **Por qué:** `cloneCourse()` en el store copia secciones y recursos (con IDs nuevos) pero omite evaluaciones, ya que típicamente las evaluaciones son específicas a una edición del curso.

---

## CourseEditor.jsx

### ¿Qué hace?
Es la página central de gestión para el docente. Permite construir y editar toda la estructura del curso: información general, secciones, recursos y evaluaciones.

### ¿Cómo lo hace?

#### Estado principal
- `refreshKey`: Contador numérico que al incrementarse hace que todos los `useMemo` que lo incluyen recalculen sus valores, forzando una re-lectura del store.
- `isEditingCourse`: Controla si se muestra el formulario de edición de información general.
- `form`: Datos del formulario de nueva sección (título, descripción, sección padre).
- `resourceForm`: Datos del formulario de nuevo recurso (tipo, título, texto/archivo, sección destino).
- `courseForm`: Campos de edición de información general.
- `assessmentMeta` + `assessmentQuestions`: Datos del formulario de nueva evaluación.

#### `formatDate(value)` / `formatDateTime(dateValue, timeValue)`
- Convierten fechas ISO a formato local `es-CR`.
- `formatDate` devuelve `'Siempre disponible'` si el valor es nulo (para fechas de fin opcionales).
- `formatDateTime` combina fecha y hora en un solo string, o solo la fecha si no hay hora.
- **Por qué:** Se usan en múltiples lugares del editor para mostrar fechas de inicio/fin de cursos y evaluaciones en formato legible.

#### `sectionOptions` (useMemo)
- Aplana el árbol de secciones en una lista plana con campo `depth` para poder mostrarlas con indentación en los `<select>`.
- La función `flatten(sections, depth)` recorre recursivamente el árbol.
- **Por qué:** Los `<select>` HTML no soportan datos jerarquicos; la lista plana con indentación visual (`'— '.repeat(depth)`) simula la jerarquía.

#### `startEditingCourse()`
- Inicializa `courseForm` con los valores actuales del curso y activa `isEditingCourse`.

#### `handleChange(event)`
- Manejador genérico para los inputs del formulario de nueva **sección** (`title`, `description`, `parentId`).
- Usa `event.target.name` para saber qué campo actualizar en el objeto `form`.
- **Por qué:** Un solo handler cubre todos los campos del formulario evitando crear uno por cada input.

#### `handleResourceChange(event)`
- Igual que `handleChange` pero para el formulario de nuevo **recurso** (`sectionId`, `type`, `title`, `text`).
- **Por qué:** Se separa de `handleChange` porque opera sobre `resourceForm` (estado distinto).

#### `handleResourceFile(event)`
- Lee el archivo seleccionado con `FileReader.readAsDataURL()` y guarda el resultado base64 en `resourceForm.fileData`.
- **Por qué:** Los archivos binarios (videos, documentos, imágenes) se codifican en base64 para poder almacenarlos en localStorage.

#### `handleAddSection(event)`
- Valida título y descripción.
- Llama a `addCourseSection(course.id, form, form.parentId || null)`.
- Incrementa `refreshKey` para releer el curso actualizado.

#### `handleAddResource(event)`
- Valida que se seleccionó sección, que hay título, y que el contenido específico del tipo está presente (texto para tipo texto, archivo para tipos binarios).
- Llama a `addSectionResource(course.id, sectionId, {...})`.
- **Nota:** Después de agregar, limpia el formulario pero mantiene la sección seleccionada (`sectionId: previous.sectionId`) para facilitar agregar múltiples recursos seguidos.

#### `handleSaveCourse(event)`
- Valida código, nombre, fecha de inicio y coherencia de fechas.
- Llama a `updateCourseMetadata(course.id, courseForm)`.

#### `handleCoverImageChange(event)`
- Lee el nuevo archivo de imagen con `FileReader` y llama a `updateCourseMetadata` solo con `{ coverImage: imageData }`.
- La imagen se activa haciendo clic en la imagen actual del curso (con `coverImageInputRef.current?.click()`).

#### `handleTogglePublished()`
- Pide confirmación con `window.confirm()` mostrando un mensaje apropiado según el estado actual.
- Llama a `setCoursePublishedState(course.id, nextState)`.

#### `handleDeleteCourse()`
- Pide confirmación, llama a `deleteCourse(course.id)` y navega al dashboard.

#### Gestión de preguntas de evaluación
- `makeBlankQuestion()`: Crea una pregunta vacía con `_key` temporal (base `Date.now() + Math.random()`) para que React pueda rastrearla como clave única antes de que el store le asigne un ID real.
- `handleAddQuestion()` / `handleRemoveQuestion(index)`: Agregan/eliminan preguntas del arreglo local.
- `handleAddOption(qi)` / `handleRemoveOption(qi, oi)`: Agregan/eliminan opciones de una pregunta. Al eliminar, ajusta `correctOptionIndex` si es necesario.
- `handleCorrectOptionChange(qi, oi)`: Marca una opción como la respuesta correcta.

#### `handleSaveAssessment()`
- Valida: título, fechas de inicio y fin (con hora), coherencia de fechas, al menos una pregunta, y que todas las preguntas y opciones tengan texto.
- Llama a `addCourseAssessment(course.id, { title, dates, questions })`.
- Resetea el formulario después de guardar.

#### `handleDeleteAssessment(assessmentId)`
- Pide confirmación y llama a `deleteCourseAssessment(course.id, assessmentId)`.

#### `renderSectionNode(section, depth)`
- Renderiza recursivamente el árbol de secciones como tarjetas anidadas con margen izquierdo proporcional al nivel.
- Cada tarjeta muestra título, cantidad de subtemas, cantidad de recursos, y un link a `SectionEditor`.

#### Control de estado "Terminado"
Cuando `course.isFinished === true`:
- Se ocultan los paneles "Crear Sección", "Agregar contenido" y "Nueva evaluación".
- Se ocultan los botones de eliminar evaluación individual.
- **Pero** el botón "Modificar" de información general **sigue funcionando** (para corregir código/nombre/fechas si es necesario).
- La imagen de portada se muestra como `<div>` en vez de `<button>` (no se puede cambiar).

---

## SectionEditor.jsx

### ¿Qué hace?
Página de detalle de una sección específica. Permite al docente editar título/descripción de la sección, gestionar subtemas directos y gestionar recursos.

### ¿Cómo lo hace?

#### Estado
- `refreshKey`: Fuerza re-lectura de datos del store.
- `sectionForm`: Título y descripción de la sección actual.
- `editingSubtopicId` + `editingSubtopicForm`: Controlan cuál subtema (si alguno) está en modo edición inline.
- `editingResourceId` + `editingResourceForm`: Controlan cuál recurso (si alguno) está en modo edición inline.
- `sectionError`: Error de validación del formulario de sección.

#### `useEffect` de sincronización
- Cuando `section` cambia (por `refreshKey`), sincroniza `sectionForm` con los datos actuales de la sección.
- **Por qué:** Sin esto, el formulario mostraría los datos anteriores después de guardar cambios.

#### `getResourceLabel(type)`
- Convierte el tipo interno del recurso (`'text'`, `'video'`, `'image'`, `'document'`) a su etiqueta en español (Texto / Video / Imagen / Documento).
- **Por qué:** Los tipos se almacenan en inglés en localStorage; la UI los muestra en español para el docente.

#### `resetRefresh()`
- Función de conveniencia que llama a `setRefreshKey((value) => value + 1)`.
- **Por qué:** Se invoca al final de cada operación de escritura (guardar, eliminar, actualizar) para forzar que `course` y `section` se re-lean desde el store con los datos más recientes.

#### `handleSectionSave(event)`
- Valida título y descripción no vacíos.
- Llama a `updateCourseSection(id, section.id, sectionForm)`.

#### `handleSectionDelete()`
- Pide confirmación (advirtiendo que se eliminarán subtemas y materiales).
- Llama a `deleteCourseSection(id, section.id)`.
- Navega de regreso al editor del curso.

#### Edición inline de subtemas
- `startEditingSubtopic(subtopic)`: Carga los datos del subtema en `editingSubtopicForm` y activa su edición.
- `saveSubtopicEdit(event)`: Valida y llama a `updateCourseSection(id, editingSubtopicId, form)`.
- `removeSubtopic(subtopicId)`: Pide confirmación y llama a `deleteCourseSection(id, subtopicId)`.
- **Por qué inline:** Permite editar un subtema sin navegar a otra página, manteniendo el contexto de la sección padre visible.

#### Edición inline de recursos
- `startEditingResource(resource)`: Carga los datos del recurso en `editingResourceForm`.
- `saveResourceEdit(event)`: Llama a `updateSectionResource(id, section.id, editingResourceId, form)`.
- `removeResource(resourceId)`: Llama a `deleteSectionResource(id, section.id, resourceId)`.
- `handleResourceFile(event)`: Actualiza `fileData` con el nuevo archivo leído como base64.

#### `renderResourcePreview(resource)`
- Muestra una vista previa según el tipo:
  - `'text'`: Párrafo con el texto.
  - `'video'`: `<video>` con controles, o link si no hay `fileData`.
  - `'image'`: `<img>`.
  - Otros: Link "Abrir documento".

#### Control de estado "Terminado"
Cuando `course.isFinished`:
- La descripción de la sección se muestra como texto (`<p>`) en vez de formulario editable.
- Los botones "Modificar" y "Eliminar" de subtemas y recursos **no se renderizan**.
- Se muestra el aviso "Este curso ha terminado. El contenido no se puede modificar."

---

## AssessmentEditor.jsx

### ¿Qué hace?
Página de detalle de una evaluación. Muestra sus datos, preguntas con respuestas correctas marcadas, y permite editarla.

### ¿Cómo lo hace?

#### Estado
- `refreshKey`: Fuerza re-lectura.
- `metaForm`: Título y fechas de la evaluación.
- `questions`: Arreglo de preguntas con sus opciones (copia editable, con `_key` temporales).
- `isEditing`: Alterna entre modo lectura y modo edición.
- `formError`: Error de validación.

#### `useEffect` de inicialización
- Cuando `assessment` cambia, sincroniza `metaForm` y `questions` con los datos actuales.
- Las preguntas existentes mantienen su `id` real; las nuevas que se agreguen tendrán `_key` pero no `id` (el store les asigna ID al guardar).

#### Helpers de edición de preguntas
- Idénticos en funcionamiento a los de `CourseEditor.jsx`: `handleAddQuestion`, `handleRemoveQuestion`, `handleAddOption`, `handleRemoveOption`, `handleOptionText`, `handleCorrectOption`.
- **Por qué duplicados:** Cada componente es autónomo; compartir lógica requeriría un hook personalizado que añadiría complejidad sin beneficio directo en este proyecto.

#### `handleSave()`
- Valida todos los campos requeridos, luego llama a `updateCourseAssessment(id, assessment.id, { ...metaForm, questions })`.
- Llama a `refresh()` y sale del modo edición.

#### `handleDelete()`
- Pide confirmación y llama a `deleteCourseAssessment(id, assessment.id)`.
- Navega de regreso al editor del curso.

#### `renderReadOnly()`
- Muestra fechas y preguntas en modo lectura.
- Cada pregunta lista sus opciones con `<ol>`. La opción correcta tiene clase `'correct'` y un badge "✓".

#### `renderEdit()`
- Formulario completo con campos de metadata y lista de preguntas editables.
- Cada opción tiene un radio button para marcarla como correcta, un input de texto, y botón "×" para eliminar (visible solo si hay más de 2 opciones).

#### Control de estado "Terminado"
Cuando `course.isFinished`:
- Solo se renderiza `renderReadOnly()` (nunca `renderEdit()`).
- Los botones "Modificar" y "Eliminar evaluación" **no se renderizan**.
- Se muestra el aviso "Este curso ha terminado. La evaluación no se puede modificar."
