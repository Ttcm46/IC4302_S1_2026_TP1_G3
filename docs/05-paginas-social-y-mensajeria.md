# Documentación: Páginas Sociales y Mensajería

## Índice
1. [Community.jsx](#communityjsx)
2. [Messaging.jsx](#messagingjsx)

---

## Community.jsx

### ¿Qué hace?
Es el hub social de la plataforma. Permite buscar usuarios, ver perfiles con su actividad de cursos, enviar/aceptar/rechazar solicitudes de amistad, y ver la lista de amigos y solicitudes pendientes.

### ¿Cómo lo hace?

#### Componentes internos

##### `UserAvatar({ user, className })`
- Muestra `<img>` con el avatar si existe, o `<div>` con las iniciales como fallback.
- Usa `getInitials()` que extrae las primeras letras del nombre completo o username.

##### `getCourseStatus(course)`
- Retorna etiqueta y clase CSS para el estado del curso (igual que en Dashboard).

##### `CourseList({ title, courses, emptyText, mode })`
- Componente reutilizable para mostrar una sección de cursos de un usuario.
- Filtra solo cursos publicados o terminados (`isPublished || isFinished`) ya que los ocultos no son visibles para terceros.
- Renderiza cada curso como una tarjeta con badge de estado y link "Ver curso".
- `mode` se usa para generar la `key` única de cada tarjeta evitando colisiones cuando el mismo curso aparece en "enseñando" y "matriculado".

#### Estado del componente
- `query`: Texto de búsqueda.
- `refreshKey`: Contador para forzar re-cálculo de todos los useMemo (al aceptar/rechazar solicitudes, enviar requests, etc.).

#### Datos principales (useMemo)

- **`allUsers`:** Todos los usuarios del sistema desde `getSystemUsers()`.
- **`friends`:** Amigos del usuario actual desde `getFriendsForUser(currentUserId)`.
- **`searchResults`:** Usuarios que coinciden con `query` desde `searchUsers(query, currentUserId)`. Excluye al usuario actual.
- **`pendingRequests`:** Solicitudes de amistad recibidas. Se enriquecen con el perfil del remitente usando `getUserById(r.from)`. Se filtran los que tienen `user` (en caso de que el perfil no exista).
- **`unreadDirectMessages`:** Conteo de mensajes directos no leídos.

#### `selectedUser` (useMemo)
- Determina qué perfil se muestra en el panel derecho.
- Prioridad: parámetro `?userId=` de la URL → primer amigo → primer resultado de búsqueda → cualquier usuario que no sea el actual.
- **Por qué:** El panel derecho siempre muestra alguien, dando feedback visual inmediato.

#### `useEffect` de sincronización de URL
- Cuando `selectedUser` cambia, actualiza el parámetro `userId` en la URL sin crear nueva entrada en el historial (`replace: true`).
- **Por qué:** Mantiene la URL sincronizada con el panel visible. Si el usuario comparte o recarga la URL, verá el mismo perfil.

#### Funciones de interacción social

##### `handleSendRequest(targetUserId)`
- Llama a `sendFriendRequest(currentUserId, targetUserId)`.
- Si retorna `true` (éxito), incrementa `refreshKey`.

##### `handleAcceptRequest(fromUserId)`
- Llama a `acceptFriendRequest(fromUserId, currentUserId)`.
- Incrementa `refreshKey` para actualizar la lista de solicitudes y amigos.

##### `handleRejectRequest(fromUserId)`
- Llama a `rejectFriendRequest(fromUserId, currentUserId)`.
- Incrementa `refreshKey`.

##### `handleSelectUser(targetUserId)`
- Actualiza el parámetro `userId` en la URL, lo que dispara el recálculo de `selectedUser`.

#### `selectedRequestStatus` (useMemo)
- Llama a `getFriendRequestStatus(currentUserId, selectedUser.id)`.
- Retorna `'friends'`, `'sent'`, `'received'` o `'none'`.
- **Por qué:** El botón de acción en el panel del perfil cambia según el estado:
  - `'none'` → "Enviar solicitud" (activo)
  - `'sent'` → "Solicitud enviada" (deshabilitado)
  - `'received'` → Botones "Aceptar" / "Rechazar"
  - `'friends'` → "Ya son amigos" (sin botón de acción)

#### `selectedActivity` (useMemo)
- Llama a `getUserCourseActivity(selectedUser.id)`.
- Retorna `{ teachingCourses: [], enrolledCourses: [] }`.
- Se usa para mostrar la actividad académica del perfil seleccionado con `<CourseList>`.

#### Layout
La página se divide en dos secciones principales:

**Barra lateral izquierda:**
- Campo de búsqueda.
- Lista de resultados de búsqueda (o todos los usuarios si `query` está vacío).
- Sección de solicitudes pendientes con botones Aceptar/Rechazar.
- Lista de amigos actuales.
- Link a mensajes directos con badge de no leídos.

**Panel derecho (perfil seleccionado):**
- Avatar, nombre, username, rol.
- Botón de acción de amistad según `selectedRequestStatus`.
- Link "Abrir chat directo" → `/social/messages?targetId=...`.
- `<CourseList>` para cursos que enseña.
- `<CourseList>` para cursos en los que está matriculado.

---

## Messaging.jsx

### ¿Qué hace?
Es la página de mensajería directa entre usuarios. Muestra la lista de conversaciones y el hilo de mensajes de la conversación seleccionada.

### ¿Cómo lo hace?

#### Funciones helper

##### `getCurrentUser()`
- Lee el usuario actual de localStorage.

##### `getInitials(user)`
- Genera iniciales para el fallback de avatar.

##### `UserAvatar({ user, className })`
- Muestra avatar o iniciales, igual que en Community.

#### Estado
- `draft`: Texto del mensaje siendo escrito.
- `refreshKey`: Fuerza re-lectura de mensajes y conversaciones.

#### Parámetros de URL
Lee varios parámetros de `useSearchParams`:
- `targetId`: ID del usuario con quien se habla.
- `targetName`, `targetRole`: Datos del usuario destino para mostrar si no está en socialStore.
- `fromCourseId`, `fromCourseName`: Si se abrió desde la pestaña de participantes de un curso matriculado.

**Por qué parámetros de URL:** Permite abrir mensajería directamente a un contacto específico desde cualquier parte de la app (perfil, participantes del curso). Si el usuario navega directamente a `/social/messages`, el sistema selecciona la primera conversación disponible.

#### `contacts` (useMemo)
- Construye la lista unificada de contactos combinando:
  1. Amigos del usuario (`getFriendsForUser`).
  2. Usuarios con los que ya existe conversación (`getDirectConversationSummaries`), enriquecidos con su perfil de `getUserById`.
  3. El `targetId` de la URL (si no está en las fuentes anteriores).
- Usa un `Map` con `userId` como clave para eliminar duplicados automáticamente.
- Ordena por timestamp del último mensaje (más reciente primero), luego alfabéticamente.
- **Por qué Map:** Garantiza que un usuario aparezca solo una vez aunque esté tanto en amigos como en conversaciones.

#### `selectedTarget` (useMemo)
- Si hay `targetId` en la URL: busca el usuario en socialStore (fallback a datos de la URL si no existe en el store).
- Si no hay: usa el primer contacto de la lista.
- **Por qué fallback con datos de URL:** Un docente puede tener conversación con un estudiante que no está en su lista de amigos; los datos de URL garantizan que el chat funcione igual.

#### `buildSearchParamsForTarget(nextTargetId)`
- Construye los parámetros de URL para seleccionar un contacto diferente.
- Preserva `fromCourseId` y `fromCourseName` si existían.
- **Por qué función separada:** Se reutiliza en la lista de contactos y en el `useEffect` de sincronización.

#### `messages` (useMemo)
- Llama a `getConversationMessages({ contextType: 'direct', contextId: null, userAId, userBId })`.
- Se recalcula cuando cambia `selectedTarget` o `refreshKey`.

#### `useEffect` de sincronización y marcado como leídos
- Sincroniza el parámetro `targetId` de la URL con el `selectedTarget`.
- Llama a `markConversationMessagesAsSeen()` para marcar los mensajes de esta conversación como leídos.
- Si se marcaron mensajes (`marked > 0`), incrementa `refreshKey` para actualizar el contador de no leídos.
- **Por qué:** Abrir una conversación debe limpiar su badge de no leídos automáticamente.

#### `handleSend(event)`
- Previene el submit del formulario.
- Valida que haya un destinatario y que el draft no esté vacío.
- Llama a `saveMessage({ contextType: 'direct', senderId, senderName, senderUsername, senderRole, receiverId, receiverName, receiverRole, text: draft.trim() })`.
- Limpia el draft e incrementa `refreshKey` para mostrar el mensaje inmediatamente.

#### Layout

**Sidebar izquierdo (lista de contactos):**
- Header con título "Conversaciones" y contador.
- Para cada contacto: avatar, nombre, `@username`, preview del último mensaje, y badge de no leídos (si hay).
- Al hacer clic: `setSearchParams(buildSearchParamsForTarget(...))`.

**Área principal (hilo de mensajes):**
- Si hay `fromCourseId`: aviso contextual del curso de origen.
- Header con avatar y datos del destinatario seleccionado.
- Stream de mensajes: cada mensaje muestra texto, nombre del remitente y timestamp. Los mensajes propios tienen clase `own`.
- Formulario de envío: input de texto + botón "Enviar".

#### Botón "Volver"
- Si hay `fromCourseId`: vuelve a `/courses/:id/registered?tab=participants`.
- Si no: vuelve a `/social`.
- **Por qué:** Mantiene el contexto de navegación según cómo se llegó a la página de mensajes.
