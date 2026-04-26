# Guía de Uso - Postman + Tecdigitalito Backend

## 📦 Importar la Colección

### Paso 1: Descargar Postman
Descarga desde: https://www.postman.com/downloads/

### Paso 2: Importar la Colección
1. Abre Postman
2. Haz clic en el botón **Import** (esquina superior izquierda)
3. Selecciona la pestaña **File**
4. Elige el archivo: `Tecdigitalito_API_Tests.postman_collection.json`
5. Haz clic en **Import**

### Paso 3: Crear Entorno (Variables)
1. Haz clic en el icono de **Environments** (engranaje, arriba a la derecha)
2. Haz clic en **Create New**
3. Nombra el entorno: "Tecdigitalito-Dev"
4. Agrega estas variables:

```
Variable          | Valor Inicial        | Descripción
------------------|----------------------|------------------
userId            | (dejar vacío)        | Cambiar después de crear usuario
authToken         | (dejar vacío)        | Cambiar después de login
classCode         | IC4302-2026-S1       | Código del curso
friendUserId      | (dejar vacío)        | ID del amigo
studentUserId     | (dejar vacío)        | ID del estudiante
recipientId       | (dejar vacío)        | ID del destinatario
classId           | (dejar vacío)        | ID de la clase
```

5. Haz clic en **Save**

### Paso 4: Seleccionar el Entorno
En la esquina superior derecha, en el dropdown que dice "No Environment", selecciona "Tecdigitalito-Dev"

---

## 🚀 Flujo de Prueba Recomendado

### 1️⃣ Verificar que el servidor esté activo

**Request:** GENERAL → Health Check

```
GET http://localhost:3000
```

**Esperado:** Status 200 con JSON de métodos disponibles

---

### 2️⃣ Crear un Usuario de Prueba

**Request:** USUARIOS → 1. Crear Usuario

**Body:**
```json
{
  "name": "Juan Pérez",
  "username": "juan.perez",
  "password": "SecurePass123",
  "dob": "2000-05-15",
  "picPath": "/images/juan.jpg",
  "typeofuser": "student",
  "correo": "juan.perez@example.com"
}
```

**Esperado:** Status 200 con ID del usuario creado

**⚠️ Importante:** Copia el `id` de la respuesta y guárdalo en tu portapapeles

---

### 3️⃣ Guardar el userId en Variables

1. En la respuesta, busca el campo `data.id` (o solo `id`)
2. Haz clic derecho en el valor del ID
3. Selecciona **Set as variable** → `userId`
4. **O** manualmente: haz clic en tu entorno y pega el valor en `userId`

**Ahora puedes hacer:**
```
http://localhost:3000/users?id={{userId}}
```

Y se reemplazará automáticamente con tu ID.

---

### 4️⃣ Probar Login

**Request:** USUARIOS → 5. Login

**Body:**
```json
{
  "username": "juan.perez",
  "password": "SecurePass123"
}
```

**Esperado:** Status 200 con token

**Guardar token:**
- Copia el token de la respuesta
- Pégalo en tu entorno en la variable `authToken`

---

### 5️⃣ Crear un Curso

**Request:** CURSOS → 1. Crear Curso

**Body:**
```json
{
  "class": {
    "classCode": "IC4302-2026-S1",
    "name": "Bases de Datos 2",
    "description": "Curso avanzado de grafos y bases de datos distribuidas",
    "startDate": "2026-01-15",
    "endDate": "2026-05-15",
    "fotoPath": "/images/ic4302.jpg"
  },
  "creatorId": "{{userId}}"
}
```

---

### 6️⃣ Crear Segundo Usuario (para pruebas de amistad/mensajes)

Repite el paso 2, pero:
- Username: "maria.garcia"
- Copia su ID y guárdalo en `friendUserId`

---

### 7️⃣ Probar Sistema de Amigos

**Request:** AMIGOS → 1. Enviar Solicitud de Amistad

```json
{
  "friendId": "{{friendUserId}}"
}
```

---

### 8️⃣ Probar Inscripción a Curso

**Request:** CURSOS → 10. Inscribir Estudiante

```json
{
  "studentId": "{{userId}}"
}
```

---

## 📊 Scripts Útiles en Postman

### Guardar automáticamente el userId después de crear usuario

En el tab **Tests** de la request "Crear Usuario", agrega:

```javascript
var jsonData = pm.response.json();
pm.environment.set("userId", jsonData.data.id);
console.log("userId guardado:", jsonData.data.id);
```

### Guardar automáticamente el token después de login

En el tab **Tests** de la request "Login", agrega:

```javascript
var jsonData = pm.response.json();
pm.environment.set("authToken", jsonData.token);
console.log("Token guardado:", jsonData.token);
```

### Verificar que la respuesta es 200

En el tab **Tests**, agrega:

```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Response has data", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property("message");
});
```

---

## 🔍 Datos de Prueba Rápida

### Usuario 1 (Profesor)
```json
{
  "name": "Prof. Carlos López",
  "username": "carlos.lopez",
  "password": "Prof123456",
  "dob": "1980-03-20",
  "typeofuser": "professor",
  "correo": "carlos@university.edu"
}
```

### Usuario 2 (Estudiante)
```json
{
  "name": "María García",
  "username": "maria.garcia",
  "password": "Maria123456",
  "dob": "2001-08-10",
  "typeofuser": "student",
  "correo": "maria@student.edu"
}
```

### Usuario 3 (Admin)
```json
{
  "name": "Admin System",
  "username": "admin",
  "password": "Admin123456",
  "dob": "1985-01-01",
  "typeofuser": "admin",
  "correo": "admin@system.edu"
}
```

---

## 🐛 Troubleshooting en Postman

### Problema: "Cannot GET /users"
**Solución:**
- Verifica que la URL sea correctamente formada
- Asegúrate que el servidor esté ejecutándose
- Comprueba en: http://localhost:3000

### Problema: "{{userId}} no se reemplaza"
**Solución:**
- Selecciona el entorno correcto (arriba a la derecha)
- Asegúrate que la variable esté guardada en el entorno

### Problema: "403 Forbidden" o "401 Unauthorized"
**Solución:**
- Primero haz login
- Copia el token de la respuesta
- Guárdalo en la variable `authToken`

### Problema: "Connection refused"
**Solución:**
- Verifica que el servidor Node.js esté ejecutándose
- Ejecuta: `npm start`
- Espera a que la consola muestre "Server is running on port 3000"

---

## 📝 Otros Clientes REST Alternativos

### Si prefieres no usar Postman:

**Thunder Client** (Extensión VS Code)
- Más ligero que Postman
- Comando: Ctrl+Shift+P → "Thunder Client: Activity"
- Importa la colección directamente

**Insomnia**
- https://insomnia.rest/
- Interface similar a Postman
- Importa el archivo JSON

**cURL** (Línea de comandos)
```bash
curl -X POST http://localhost:3000/users/create \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","username":"test","password":"pass","dob":"2000-01-01","typeofuser":"student","correo":"test@test.com"}'
```

**REST Client** (Extensión VS Code)
- Más ligero
- Crea archivos `.rest` o `.http`
- Ejemplo:
```
### Crear Usuario
POST http://localhost:3000/users/create
Content-Type: application/json

{
  "name": "Test",
  "username": "test123",
  "password": "pass123",
  "dob": "2000-01-01",
  "typeofuser": "student",
  "correo": "test@test.com"
}
```

---

## 🎯 Checklist de Configuración

- [ ] Postman instalado
- [ ] Colección importada
- [ ] Entorno "Tecdigitalito-Dev" creado
- [ ] Entorno seleccionado
- [ ] Servidor Node.js ejecutándose en http://localhost:3000
- [ ] Base de datos MongoDB accesible
- [ ] Primer request (Health Check) responde 200
- [ ] Usuario de prueba creado
- [ ] userId guardado en variables

---

## 🔗 URLs Rápidas

```
Backend API:        http://localhost:3000
Neo4j Browser:      http://localhost:7474
RavenDB Node 1:     http://localhost:8080
RavenDB Node 2:     http://localhost:8081
RavenDB Node 3:     http://localhost:8082
Mailpit Email UI:   http://localhost:8025
```

---

## 📚 Referencias

- Documentación API completa: [api.md](api.md)
- Guía del Backend: [GUIA_BACKEND.md](GUIA_BACKEND.md)
- Archivo de colección: [Tecdigitalito_API_Tests.postman_collection.json](Tecdigitalito_API_Tests.postman_collection.json)
- GitHub: https://github.com/Ttcm46/IC4302_S1_2026_TP1_G3

**¡Listo! Ahora estás preparado para probar todos los endpoints.**
