# Documentación: Páginas de Autenticación y Perfil

## Índice
1. [services/auth.js](#servicesauthjs)
2. [Home.jsx](#homejsx)
3. [Login.jsx](#loginjsx)
4. [Register.jsx](#registerjsx)
5. [ForgotPassword.jsx](#forgotpasswordjsx)
6. [ResetPassword.jsx](#resetpasswordjsx)
7. [ChangePassword.jsx](#changepasswordjsx)
8. [Profile.jsx](#profilejsx)

---

## services/auth.js

### ¿Qué hace?
Es una capa de servicio que actúa como intermediario entre los componentes de UI y `authStore.js`. Exporta `authService`, `userService`, `courseService` y `enrollmentService`.

### ¿Cómo lo hace?
- **`authService`:** Cada método (`register`, `login`, `forgotPassword`, `resetPassword`, `changePassword`, `logout`, `refreshToken`) simplemente delega la llamada a la función correspondiente de `authStore`.
- **`userService`, `courseService`, `enrollmentService`:** Declaran métodos que llaman a una API REST (`api.get`, `api.post`, `api.put`), pero estas funciones NO están conectadas a un backend real; la variable `api` no está definida en el archivo. Son stubs preparados para futura integración.

### ¿Por qué lo hace así?
Esta capa de indirección sigue el **patrón Service Layer**: los componentes de UI nunca importan directamente el store, sino que pasan por el servicio. Esto permite reemplazar la implementación (de localStorage a API REST) sin cambiar los componentes. Actualmente solo `authService` funciona; los demás servicios son placeholders para un backend futuro.

---

## Home.jsx

### ¿Qué hace?
Es la página de bienvenida (landing page) de la aplicación. Se muestra a usuarios no autenticados.

### ¿Cómo lo hace?
- Renderiza una sección **hero** con el nombre de la aplicación, una descripción breve, y dos botones:
  - "Iniciar Sesión" → navega a `/login`
  - "Registrarse" → navega a `/register`
- Usa dos botones con `onClick={() => nav("/login")}` y `onClick={() => nav("/register")}` respectivamente. `nav` es la función de `useNavigate()` de React Router — navega sin recargar la página.

### ¿Por qué lo hace así?
Es una página puramente presentacional sin estado ni lógica. Los `<Link>` ofrecen navegación SPA (Single Page Application) rápida, evitando recarga completa del navegador.

---

## Login.jsx

### ¿Qué hace?
Permite a los usuarios existentes autenticarse ingresando username y contraseña.

### ¿Cómo lo hace?

#### Estado
- `formData`: Objeto con `username`, `password`, `rememberMe` (los tres campos del formulario).
- `error`: Mensaje de error para mostrar al usuario.
- `loading`: Booleano que deshabilita el botón mientras se procesa el login.

#### `handleChange(e)`
- **Qué hace:** Actualiza cualquier campo del formulario (incluido el checkbox `rememberMe`).
- **Cómo:** Usa `e.target.name` para identificar el campo. Si el input es checkbox (`type === 'checkbox'`), usa `e.target.checked`; si no, usa `e.target.value`.
- **Por qué:** Un handler genérico evita crear uno por campo. El tratamiento especial del checkbox es necesario porque su valor no está en `value` sino en `checked`.

#### `handleSubmit(event)`
- **Qué hace:** Procesa el intento de login.
- **Cómo:**
  1. Previene el submit por defecto del formulario con `event.preventDefault()`.
  2. Llama a `authService.login(username, password)`.
  3. Si la respuesta es exitosa (`response.data`):
     - Almacena `accessToken`, `refreshToken` y el objeto `user` en localStorage.
     - Llama a `ensureUserRegistered()` de socialStore para sincronizar el usuario en el sistema social.
     - Navega a `/dashboard` con `navigate()`.
  4. Si falla, muestra el mensaje de error del response o un mensaje genérico.

#### Validación
- No se valida en el frontend antes de enviar; la validación la hace `authStore.login()` que verifica la existencia del usuario y la contraseña.

### ¿Por qué lo hace así?
El flujo sigue el patrón estándar de login en SPAs: formulario controlado → llamada al servicio → almacenamiento de tokens → redirección. Almacenar tokens en localStorage permite que `isAuthenticated()` (en App.jsx) funcione sin estado global.

---

## Register.jsx

### ¿Qué hace?
Permite crear una nueva cuenta de usuario con datos personales y avatar.

### ¿Cómo lo hace?

#### Estado
- `formData`: Objeto con `username`, `email`, `password`, `confirmPassword`, `fullName`, `dateOfBirth`, `avatar` (base64).
- `preview`: String base64 de vista previa del avatar seleccionado (solo para renderizado).
- `error`, `success`: Feedback al usuario.
- `loading`: Booleano que deshabilita el botón durante el registro.

#### `handleChange(e)`
- Actualiza el campo correspondiente en `formData` usando `e.target.name`.

#### `handleAvatar(e)`
- **Qué hace:** Procesa la selección de imagen de avatar.
- **Cómo:** Lee el archivo con `FileReader.readAsDataURL()`, guarda base64 en `formData.avatar` y en `preview` para mostrar la vista previa.
- **Por qué:** base64 permite almacenar imágenes directamente en localStorage sin necesidad de un servidor de archivos.

#### `handleSubmit(event)`
- **Qué hace:** Registra al usuario.
- **Cómo:**
  1. Valida que `password` coincida con `confirmPassword`.
  2. Llama a `authService.register({ ...form, avatar })`.
  3. Si es exitoso, llama a `ensureUserRegistered()` para registrar en el sistema social.
  4. Redirige a `/login` con `navigate()`.

### ¿Por qué lo hace así?
La validación de contraseñas iguales se hace en frontend para dar feedback inmediato. El avatar como base64 es la única opción viable sin backend para almacenamiento de archivos. La redirección a login (en vez de auto-login) sigue el patrón UX donde el usuario confirma sus credenciales explícitamente.

---

## ForgotPassword.jsx

### ¿Qué hace?
Muestra un formulario para solicitar restablecimiento de contraseña por email.

### ¿Cómo lo hace?

#### Estado
- `email`: Campo del formulario.
- `status`: Puede ser `'idle'`, `'success'` o `'error'`.
- `error`: Mensaje de error.

#### `handleSubmit(event)`
- Llama a `authService.forgotPassword(email)`.
- Si es exitoso, cambia `status` a `'success'` y muestra un mensaje informativo.

### ¿Por qué lo hace así?
Es una **simulación** — `authStore.forgotPassword()` siempre retorna éxito sin hacer nada real. Existe para completar el flujo de autenticación típico y facilitar la futura integración con un servicio de email. El estado `status` permite condicionar lo que se muestra: formulario vs. mensaje de confirmación.

---

## ResetPassword.jsx

### ¿Qué hace?
Permite restablecer la contraseña usando un token recibido por email.

### ¿Cómo lo hace?

#### Estado
- `token`: Token de recuperación.
- `password`, `confirmPassword`: Nueva contraseña.
- `status`, `error`: Control de estado del flujo.

#### `handleSubmit(event)`
- Valida que las contraseñas coincidan.
- Llama a `authService.resetPassword(token, password)`.
- Si es exitoso, muestra éxito con enlace a login.

### ¿Por qué lo hace así?
Al igual que ForgotPassword, es una **simulación** del flujo real. `authStore.resetPassword()` siempre retorna éxito. El formulario con token simula el enlace que llegaría por email en un sistema real.

---

## ChangePassword.jsx

### ¿Qué hace?
Permite al usuario autenticado cambiar su contraseña actual.

### ¿Cómo lo hace?

#### Estado
- `currentPassword`, `newPassword`, `confirmPassword`: Campos del formulario.
- `status`, `error`: Control del flujo.

#### `handleSubmit(event)`
- Valida que `newPassword` coincida con `confirmPassword`.
- Llama a `authService.changePassword(currentPassword, newPassword)`.
- Si es exitoso, muestra confirmación.
- Si la contraseña actual es incorrecta, muestra error.

### ¿Por qué lo hace así?
A diferencia de ForgotPassword/ResetPassword, esta funcionalidad **sí opera realmente**: `authStore.changePassword()` verifica el hash de la contraseña actual y actualiza el hash almacenado. Requiere autenticación previa (ruta protegida).

---

## Profile.jsx

### ¿Qué hace?
Permite al usuario ver y editar su perfil: username, nombre completo, fecha de nacimiento y avatar.

### ¿Cómo lo hace?

#### Helpers (fuera del componente)

#### `formatDate(value)`
- Convierte una fecha ISO a formato local `es-CR`. Devuelve `'No definida'` si el valor es nulo o inválido.

#### `getInitials(fullName, username)`
- Genera un string de 1 o 2 iniciales a partir del nombre completo o el username. Se usa para el avatar de texto cuando el usuario no tiene imagen.
- **Por qué:** Mostrar iniciales es un patrón UX estándar como fallback de avatar — más informativo que un ícono genérico.

#### Estado
- `user`: Perfil del usuario cargado desde `localStorage` al inicializar (IIFE dentro de `useState`).
- `formData`: Copia editable del perfil (`username`, `fullName`, `dateOfBirth`, `avatar` base64).
- `isEditing`: Booleano que alterna entre modo lectura y modo edición.
- `error`: Mensaje de error al guardar.

#### `handleChange(event)`
- Actualiza el campo correspondiente en `formData` usando `event.target.name`.
- **Por qué:** Un solo handler genérico para todos los inputs de texto del formulario.

#### `handleAvatar(event)`
- Lee el archivo seleccionado con `FileReader.readAsDataURL()` y guarda el base64 en `formData.avatar`.
- **Por qué:** Sin backend de almacenamiento de archivos, el avatar se persiste como string base64 en localStorage.

#### `handleSave()`
- **Qué hace:** Guarda los cambios del perfil.
- **Cómo:**
  1. Llama a `updateStoredProfile({ ...user, ...formData trimmed })` que actualiza en `authStore`.
  2. Actualiza el objeto `user` en localStorage con los nuevos datos.
  3. Llama a `ensureUserRegistered(updatedUser)` de socialStore para sincronizar en el sistema social.
  4. Llama a `syncTeacherNameForOwner(user.id, updatedUser.fullName)` de courseStore para actualizar el nombre del docente en todos sus cursos.
  5. Sale del modo edición.

#### `handleCancel()`
- Descarta los cambios: restaura `formData` con los valores actuales de `user` y desactiva `isEditing`.
- **Por qué:** Permite al usuario abandonar la edición sin guardar, volviendo al estado previo.

#### Renderizado
- **Modo lectura:** Muestra avatar (imagen o círculo con iniciales), username, nombre completo, fecha de nacimiento, y botones para editar o ir a cambiar contraseña.
- **Modo edición:** Formulario con inputs editables y selector de archivo para avatar.

### ¿Por qué lo hace así?
La función `handleSave` actualiza cuatro fuentes de datos porque la información del usuario está distribuida:
1. **authStore**: Es la fuente autoritativa del perfil.
2. **localStorage `user`**: Es la caché de sesión que usan los componentes sin consultar el store.
3. **socialStore**: Mantiene un registro paralelo de usuarios para el sistema social.
4. **courseStore**: Los cursos almacenan el nombre del docente como string denormalizado, así que se necesita sincronizar cuando cambia.

Esta denormalización es una consecuencia de usar localStorage en lugar de una base de datos relacional. En un backend real, bastaría con actualizar una tabla de usuarios y hacer JOINs.
