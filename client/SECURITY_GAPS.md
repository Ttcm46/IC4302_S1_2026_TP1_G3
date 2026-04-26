# Faltantes de Seguridad Identificados

Este documento consolida todos los requisitos de seguridad del enunciado que NO están implementados en el proyecto actual.

## 1. SALT POR USUARIO NO IMPLEMENTADO
**Archivos:** `client/src/data/authStore.js` (línea 31, 74)

**Problema:** El hash de contraseña se calcula directamente sobre la contraseña sin un salt único por usuario.

**Requisito:** Cada usuario debe tener su propio salt aleatorio. El mismo password con salts diferentes debe generar hashes distintos. Actualmente vulnerable a rainbow tables.

**TODO:** Implementar en backend:
- Generar salt criptográfico aleatorio para cada usuario
- Usar bcrypt, scrypt o Argon2 en lugar de SHA-256
- Derivar hash con salt + algoritmo seguro
- Almacenar salt + hash en base de datos

---

## 2. NO HAY BLOQUEO POR INTENTOS FALLIDOS
**Archivos:** `client/src/data/authStore.js` (línea 86, 89, 94)

**Problema:** No hay:
- Contador de intentos fallidos de login
- Bloqueo automático de cuenta después de N intentos
- Timestamps de bloqueo/desbloqueo automático
- Auditoría de intentos fallidos
- Notificación por email

**Requisito:** Bloquear cuenta después de 5 intentos fallidos durante 30 minutos, registrar eventos, notificar usuario.

**TODO:** Implementar en backend:
- Tabla `failed_login_attempts(user_id, timestamp, ip)`
- Contador de intentos en últimos 15 minutos
- Bloqueo de cuenta si contador >= 5
- Desbloqueo automático después de 30 minutos
- Notificación por email al usuario
- Incremento exponencial de delay entre intentos (1s, 2s, 4s, 8s, 16s)

---

## 3. "RECORDARME" NO CUMPLE REQUISITO
**Archivos:** `client/src/pages/auth/Login.jsx` (línea 12, 34), `client/src/services/api.js` (línea 16)

**Problema:** 
- Checkbox existe en UI pero no tiene efecto real
- Tokens siempre se guardan en localStorage (mismo período)
- localStorage es vulnerable a XSS (accesible a scripts maliciosos)

**Requisito:** 
- Si está marcado: refresh token dura 14 días
- Si no está marcado: refresh token dura 1 hora
- Tokens almacenados en httpOnly cookies (no accesibles a JavaScript)

**TODO:** Implementar en backend:
- Si `rememberMe=true`: generar refresh token con expiración 14 días
- Si `rememberMe=false`: generar refresh token con expiración 1 hora
- Respuesta HTTP incluye `Set-Cookie` con flags:
  - `HttpOnly` (no accesible desde JavaScript)
  - `Secure` (solo HTTPS)
  - `SameSite=Strict` (solo same-site requests)
- Frontend no guarda tokens en localStorage

---

## 4. RECUPERACIÓN DE CONTRASEÑA SIMULADA
**Archivos:** `client/src/data/authStore.js` (línea 152, 156, 158)

**Problema:**
- Muestra mensajes de éxito pero no genera token real
- No hay expiración corta del token
- No hay validación de single-use (puede usarse múltiples veces)
- No se invalida el token tras uso

**Requisito:** Token único, criptográficamente aleatorio, con expiración de 1 hora, válido solo una vez.

**TODO:** Implementar en backend:
- Generar token criptográfico aleatorio (32+ bytes)
- Guardar en tabla `password_reset_tokens(user_id, token_hash, expires_at, used_at)`
- Enviar token en enlace: `https://app.com/reset-password?token=XXX`
- Al recibir nuevo password:
  - Validar token existe
  - Validar token no expiró
  - Validar token no fue usado (`used_at IS NULL`)
  - Actualizar password
  - Marcar token como usado (`SET used_at = NOW()`)
  - Invalidar todos los demás tokens de ese usuario
- Enviar email de confirmación del cambio

---

## 5. CAMBIO DE CONTRASEÑA SIN POLÍTICA
**Archivos:** `client/src/pages/auth/ChangePassword.jsx` (línea 20), `client/src/data/authStore.js` (línea 162)

**Problema:**
- Solo valida que las confirmaciones coincidan
- No valida longitud mínima
- No valida complejidad (mayús, minús, números, símbolos)
- No valida contra reutilización de contraseñas anteriores
- No valida que no sea igual al username

**Requisito:** Aplicar política de contraseña fuerte.

**TODO:** Implementar validación en cliente + servidor:
- Mínimo 8 caracteres
- Incluir al menos 1 mayúscula
- Incluir al menos 1 minúscula
- Incluir al menos 1 número
- Incluir al menos 1 símbolo (no permitir algunas que causen SQL injection)
- No puede ser igual a username
- No puede ser igual a ninguna de las últimas 5 contraseñas
- Mostrar requisitos en UI
- Notificar cambio por email

---

## 6. CIERRE DE SESIÓN PARCIAL
**Archivos:** `client/src/components/Layout.jsx` (línea 10-14)

**Problemas:**
1. La app limpia localStorage pero NO invalida tokens en backend
   - Token sigue siendo válido si alguien lo capturó
   - No hay blacklist de tokens
2. Redirige a `/` (página de bienvenida) pero requisito pide redirigir a `/login`

**Requisito:** Logout debe revocar tokens de forma autoritativa y redirigir a login.

**TODO:** Implementar en backend:
- Crear tabla `token_blacklist(token_hash, expires_at)`
- Al recibir logout: hashear token y guardar en blacklist
- En validación de token: verificar que no esté en blacklist
- Redirigir a `/login` después de logout
- Mostrar mensaje "Sesión cerrada exitosamente"

---

## 7. NO SE REGISTRA FECHA/HORA DE LOGIN
**Archivos:** `client/src/data/authStore.js` (línea 79, 97)

**Problema:**
- Solo se guarda `createdAt` al momento del registro
- No hay `lastLogin` (timestamp del último acceso)
- No hay historial de accesos para auditoría
- Usuario no puede ver dónde y cuándo se accedió a su cuenta

**Requisito:** Registrar auditoría de logins para que el usuario detecte accesos sospechosos.

**TODO:** Implementar en backend:
- Tabla `login_history(user_id, ip_address, user_agent, timestamp, success)`
- Al login exitoso: guardar IP, user-agent, timestamp
- Al login fallido: registrar intento fallido
- Agregar a perfil de usuario: vista de "Sesiones activas" y "Historial de accesos"
- Mostrar últimos 10 logins con timestamp, IP, dispositivo
- Permitir cerrar sesiones remotas

---

## 8. TOKENS ALMACENADOS EN LOCALSTORAGE
**Archivos:** `client/src/services/api.js` (línea 16)

**Problema:**
- Access token y refresh token se guardan en localStorage
- localStorage es accesible a cualquier script JavaScript
- Vulnerable a ataques XSS (inyección de código malicioso)
- Una sola vulnerabilidad XSS expone todos los tokens de todos los usuarios

**Requisito:** Tokens en httpOnly cookies.

**TODO:** Implementar en backend:
- Respuesta de login incluye `Set-Cookie` con tokens
- Cookies con flags HttpOnly, Secure, SameSite=Strict
- Frontend NO accede a tokens (axios maneja cookies automáticamente)
- CSRF tokens en headers para POST/PUT/DELETE

---

## Resumen de Prioridades

**CRÍTICO (resolver primero):**
1. Salt por usuario + algoritmo seguro (bcrypt/Argon2)
2. Bloqueo por intentos fallidos
3. Tokens en httpOnly cookies en lugar de localStorage

**ALTO:**
4. Recuperación de contraseña con tokens de un solo uso
5. Cambio de contraseña con política fuerte
6. Logout con invalidación de tokens (token blacklist)

**MEDIO:**
7. "Recordarme" con duraciones diferentes
8. Auditoría de logins (lastLogin, historial)

---

## Referencias en Código

| Faltante | Archivo | Línea | Detalles |
|----------|---------|-------|----------|
| Salt por usuario | `authStore.js` | 31, 74 | Hash sin salt |
| Bloqueo por intentos | `authStore.js` | 86, 89, 94 | Login sin contadores |
| Recordarme | `Login.jsx` | 12, 34 | Checkbox sin efecto |
| Recordarme | `api.js` | 16 | localStorage en lugar de cookies |
| Recuperación | `authStore.js` | 152, 156, 158 | Token simulado |
| Cambio password | `ChangePassword.jsx` | 20 | Sin política |
| Cambio password | `authStore.js` | 162 | Sin validación |
| Logout | `Layout.jsx` | 10-14 | Sin invalidación de tokens |
| Auditoría | `authStore.js` | 79, 97 | Sin lastLogin |
