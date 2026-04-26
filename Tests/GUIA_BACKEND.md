# Guía Completa del Backend - IC4302_S1_2026_TP1_G3

## 📋 Índice
1. [Descripción General](#descripción-general)
2. [Arquitectura del Proyecto](#arquitectura-del-proyecto)
3. [Bases de Datos](#bases-de-datos)
4. [Cómo Ejecutar el Backend](#cómo-ejecutar-el-backend)
5. [Herramientas para Probar](#herramientas-para-probar)
6. [Guía de Pruebas Completa](#guía-de-pruebas-completa)
7. [Solución de Problemas](#solución-de-problemas)

---

## Descripción General

Este es un backend para **Tecdigitalito**, una plataforma educativa que gestiona:
- 👥 Usuarios (estudiantes, profesores, admins)
- 📚 Cursos y evaluaciones
- 🤝 Sistema de amigos
- 💬 Mensajería
- 📊 Registro de accesos (logs)

**Stack Tecnológico:**
- **Express.js** (Framework web)
- **Node.js** (Runtime)
- **MongoDB** (Base de datos principal - usuarios, mensajes)
- **Neo4j** (Grafos - relaciones entre usuarios, cursos)
- **RavenDB** (Cluster de 3 nodos - almacenamiento distribuido)
- **Redis** (Cache - sesiones)
- **Mailpit** (Servicio de emails para desarrollo)

---

## Arquitectura del Proyecto

```
IC4302_S1_2026_TP1_G3/
├── server.js              # Punto de entrada principal
├── users.js               # Lógica de usuarios
├── clases.js              # Lógica de cursos/clases
├── accessLogs.js          # Registro de accesos (MongoDB)
├── redisStore.js          # Configuración de Redis
├── mailpit.js             # Integración con Mailpit
├── package.json           # Dependencias
├── docker-compose.yml     # Orquestación de contenedores
├── Dockerfile             # Configuración Docker
├── .env                   # Variables de entorno
└── api.md                 # Documentación de API
```

### Flujo General de Datos

```
Cliente (Postman/API)
        ↓
    Express Server (server.js)
        ↓
   ┌───┴──────┬─────────┬─────────┐
   ↓          ↓         ↓         ↓
MongoDB   Neo4j      RavenDB   Redis
(Datos)  (Relaciones) (Cluster) (Sesiones)
```

---

## Bases de Datos

### 1. **MongoDB** (Puerto: 27017)
- Almacena: Usuarios, mensajes, evaluaciones, logs de acceso
- Modelo: Documentos NoSQL
- Funciones en `accessLogs.js` y `users.js`

**Colecciones principales:**
```javascript
// Usuarios
{
  id: "user_123",
  name: "John Doe",
  username: "johndoe",
  password: "hashed_password",
  dob: "2000-01-01",
  correo: "john@example.com",
  typeofuser: "student",
  role: "student"
}

// Access Logs
{
  ip: "192.168.1.20",
  userId: "user_123",
  device: {
    type: "mobile",
    vendor: "Samsung",
    model: "Galaxy S24"
  },
  action: "login",
  successful: true,
  createdAt: "2026-04-25T16:00:00Z"
}
```

### 2. **Neo4j** (Puerto: 7687)
- Almacena: Relaciones entre usuarios, cursos, evaluaciones
- Modelo: Grafos
- Funciones en `clases.js`

**Nodos principales:**
```
(User) -[:ENROLLED_IN]-> (Course)
(User) -[:FRIENDS_WITH]-> (User)
(Course) -[:HAS_SECTION]-> (Section)
(Course) -[:HAS_EVALUATION]-> (Evaluation)
```

### 3. **RavenDB** (Cluster de 3 nodos)
- Puertos: 8080, 8081, 8082 (Web UI)
- TCP: 38888, 38889, 38890
- Almacena: Datos distribuidos y replicados
- Funciones en `redisStore.js`

### 4. **Redis** (Puerto: 6379)
- Almacena: Sesiones de usuario (tokens)
- Cachés de datos frecuentes
- Funciones en `redisStore.js`

### 5. **Mailpit** (Puerto: 1025 SMTP, 8025 Web UI)
- Servicio local de correo para desarrollo
- No envía realmente correos, los captura en la web UI
- Funciones en `mailpit.js`

---

## Cómo Ejecutar el Backend

### Opción 1: Sin Docker (Local)

**Requisitos:**
- Node.js v16+
- MongoDB en ejecución
- Neo4j en ejecución
- Redis en ejecución
- Mailpit en ejecución

**Pasos:**

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
# Editar o crear .env (consultar archivo existente)

# 3. Iniciar servidor
npm start

# Servidor estará en http://localhost:3000
```

### Opción 2: Con Docker (Recomendado)

**Requisitos:**
- Docker
- Docker Compose

**Pasos:**

```bash
# 1. Construir la imagen
docker build . -t IC4302_S1_2026_TP1_G3/node-server:v1

# 2. Ejecutar con Docker Compose (inicia todos los servicios)
docker-compose up -d

# 3. Ver logs
docker-compose logs -f

# 4. Detener servicios
docker-compose down
```

**Servicios en Docker Compose:**
- **Node Server**: http://localhost:3000
- **MongoDB**: localhost:27017
- **Neo4j**: bolt://localhost:7687 (Browser: http://localhost:7474)
- **RavenDB Node 1**: http://localhost:8080
- **RavenDB Node 2**: http://localhost:8081
- **RavenDB Node 3**: http://localhost:8082
- **Redis**: localhost:6379
- **Mailpit UI**: http://localhost:8025

### Verificar que el servidor está activo

```bash
curl http://localhost:3000
```

Deberías recibir:
```json
{
  "message": "Hello World! app is running in port: 3000",
  "timestamp": "2026-04-26T...",
  "methods": {...}
}
```

---

## Herramientas para Probar

### 1. **Postman** (Recomendado para UI)
- Descarga: https://www.postman.com/downloads/
- Permite crear colecciones de requests
- Visualización clara de responses
- Gestión de variables de entorno

**Pasos para usar Postman:**
1. Abre Postman
2. Crea una nueva colección
3. Crea requests para cada endpoint
4. Usa variables para `userId`, `classCode`, etc.
5. Guarda la colección para reutilizarla

### 2. **cURL** (Línea de comandos)
```bash
# Ejemplo: Crear usuario
curl -X POST http://localhost:3000/users/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Juan",
    "username": "juan123",
    "password": "pass123",
    "dob": "2000-01-01",
    "typeofuser": "student",
    "correo": "juan@example.com"
  }'
```

### 3. **Insomnia**
- Similar a Postman pero más ligero
- https://insomnia.rest/

### 4. **Bruno**
- Cliente REST de código abierto
- https://www.usebruno.com/

### 5. **Thunder Client** (Extensión VS Code)
- Plugin de VS Code para hacer requests
- Comando: Ctrl+Shift+P → "Thunder Client: Activity"

### 6. **CLI con Node.js/JavaScript**
```javascript
// Ejemplo: test.js
import fetch from 'node-fetch';

const response = await fetch('http://localhost:3000/users/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: "Test",
    username: "test123",
    password: "pass123",
    dob: "2000-01-01",
    typeofuser: "student",
    correo: "test@example.com"
  })
});

console.log(await response.json());
```

---

## Guía de Pruebas Completa

### A. PRUEBAS DE USUARIOS

#### 1. Crear Usuario
```
POST http://localhost:3000/users/create
Content-Type: application/json

{
  "name": "John Doe",
  "username": "johndoe123",
  "password": "SecurePass123",
  "dob": "2000-01-15",
  "picPath": "/images/john.jpg",
  "typeofuser": "student",
  "correo": "john@example.com"
}
```

**Respuesta esperada (200):**
```json
{
  "message": "User created successfully",
  "data": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "username": "johndoe123"
  }
}
```

#### 2. Buscar Usuario
```
GET http://localhost:3000/users
Content-Type: application/json

// Por ID:
{
  "type": "id",
  "id": "507f1f77bcf86cd799439011"
}

// Por propiedades:
{
  "field": "username",
  "value": "johndoe123"
}

// Todos los usuarios (cuerpo vacío)
{}
```

#### 3. Login
```
POST http://localhost:3000/login
Content-Type: application/json

{
  "username": "johndoe123",
  "password": "SecurePass123"
}
```

**Respuesta esperada (200):**
```json
{
  "message": "Login successful",
  "token": "abc123def456..."
}
```

#### 4. Logout
```
POST http://localhost:3000/logout
Content-Type: application/json

{
  "token": "abc123def456..."
}
```

#### 5. Actualizar Contraseña
```
PUT http://localhost:3000/users/update/password?id=507f1f77bcf86cd799439011
Content-Type: application/json

{
  "password": "OldPass123",
  "newpassword": "NewPass123"
}
```

#### 6. Resetear Contraseña
```
POST http://localhost:3000/users/reset
Content-Type: application/json

{
  "username": "johndoe123"
}
```

**Respuesta esperada (200):**
```json
{
  "message": "Password reset successful",
  "temporaryPassword": "a1b2c3d4"
}
```

#### 7. Gestión de Amigos

```
# Enviar solicitud de amistad
POST http://localhost:3000/users/friends/request?id=507f1f77bcf86cd799439011
Content-Type: application/json

{
  "friendId": "507f1f77bcf86cd799439012"
}

# Obtener solicitudes pendientes
GET http://localhost:3000/users/friends/requests?id=507f1f77bcf86cd799439011

# Aceptar solicitud
POST http://localhost:3000/users/friends/accept?id=507f1f77bcf86cd799439011
Content-Type: application/json

{
  "friendId": "507f1f77bcf86cd799439012"
}

# Rechazar solicitud
POST http://localhost:3000/users/friends/reject?id=507f1f77bcf86cd799439011
Content-Type: application/json

{
  "friendId": "507f1f77bcf86cd799439012"
}

# Obtener lista de amigos
GET http://localhost:3000/users/friends?id=507f1f77bcf86cd799439011
```

#### 8. Roles de Usuario
```
# Asignar rol
POST http://localhost:3000/users/role?id=507f1f77bcf86cd799439011
Content-Type: application/json

{
  "role": "student"  // o "professor" o "admin"
}

# Obtener rol
GET http://localhost:3000/users/role?id=507f1f77bcf86cd799439011
```

#### 9. Historial de Acceso
```
GET http://localhost:3000/users/log?id=507f1f77bcf86cd799439011
```

**Respuesta esperada (200):**
```json
{
  "message": "Login history for user ID: 507f1f77bcf86cd799439011",
  "logs": [
    {
      "ip": "192.168.1.20",
      "userId": "507f1f77bcf86cd799439011",
      "device": {
        "type": "mobile",
        "vendor": "Samsung",
        "model": "Galaxy S24"
      },
      "action": "login",
      "successful": true,
      "createdAt": "2026-04-25T16:00:00.000Z"
    }
  ]
}
```

### B. PRUEBAS DE CURSOS

#### 1. Crear Curso
```
POST http://localhost:3000/courses/create
Content-Type: application/json

{
  "class": {
    "classCode": "IC4302-2026-S1",
    "name": "Bases de Datos 2",
    "description": "Curso avanzado de grafos y bases de datos distribuidas",
    "startDate": "2026-01-15",
    "endDate": "2026-05-15",
    "fotoPath": "/images/ic4302.jpg"
  },
  "creatorId": "507f1f77bcf86cd799439011"
}
```

#### 2. Agregar Sección
```
POST http://localhost:3000/courses/section?classCode=IC4302-2026-S1
Content-Type: application/json

{
  "sectionId": "sec_001",
  "description": "Introducción a bases de datos",
  "isClassParent": true
}
```

#### 3. Agregar Evaluación
```
POST http://localhost:3000/courses/evaluation?classCode=IC4302-2026-S1
Content-Type: application/json

{
  "evalId": "exam_001",
  "name": "Examen Parcial 1",
  "type": "exam",
  "content": {
    "duration": 120,
    "totalPoints": 200,
    "format": "Written",
    "date": "2026-03-10"
  }
}
```

#### 4. Inscribir Estudiante
```
POST http://localhost:3000/courses/students?classCode=IC4302-2026-S1
Content-Type: application/json

{
  "studentId": "507f1f77bcf86cd799439012"
}
```

#### 5. Obtener Estudiantes del Curso
```
GET http://localhost:3000/courses/students?classCode=IC4302-2026-S1
```

#### 6. Obtener Detalles Completos del Curso
```
GET http://localhost:3000/courses?classCode=IC4302-2026-S1
```

**Respuesta esperada (200):**
```json
{
  "message": "Class details retrieved",
  "class": {
    "classCode": "IC4302-2026-S1",
    "name": "Bases de Datos 2",
    "description": "...",
    "students": [...],
    "sections": [...],
    "evaluations": [...]
  }
}
```

#### 7. Listar Todos los Cursos
```
GET http://localhost:3000/courses
```

#### 8. Clonar Curso
```
POST http://localhost:3000/courses/clone?sourceClassCode=IC4302-2026-S1
Content-Type: application/json

{
  "newClassCode": "IC4302-2026-S1-copy",
  "creatorId": "507f1f77bcf86cd799439011"
}
```

### C. PRUEBAS DE MENSAJES

#### 1. Enviar Mensaje
```
POST http://localhost:3000/messages/send?id=507f1f77bcf86cd799439011
Content-Type: application/json

{
  "recipientId": "507f1f77bcf86cd799439012",
  "content": "Hola, ¿cómo estás?",
  "type": "direct"
}
```

#### 2. Obtener Bandeja de Entrada
```
GET http://localhost:3000/messages/inbox?id=507f1f77bcf86cd799439011
```

#### 3. Iniciar Conversación
```
POST http://localhost:3000/messages/conversation?id=507f1f77bcf86cd799439011
Content-Type: application/json

{
  "participantIds": ["507f1f77bcf86cd799439012", "507f1f77bcf86cd799439013"],
  "name": "Grupo de Estudio"
}
```

---

## Solución de Problemas

### Problema: "Connection refused" en puerto 3000
**Causa:** El servidor no está ejecutándose
**Solución:**
```bash
npm start
# O si usas Docker:
docker-compose up -d
```

### Problema: "MongoDB connection error"
**Causa:** MongoDB no está en ejecución
**Solución:**
```bash
# Si está en Docker:
docker-compose logs mongodb

# Si está local, inicia el servicio MongoDB
```

### Problema: "Neo4j connection error"
**Causa:** Neo4j no está disponible
**Solución:**
```bash
# Verifica la conexión Neo4j
# URL: bolt://localhost:7687
# Usuario: neo4j
# Contraseña: (verificar en .env)
```

### Problema: "Redis connection error"
**Causa:** Redis no está disponible
**Solución:**
```bash
# Verifica Redis está ejecutándose
redis-cli ping
# Deberías ver: PONG
```

### Problema: "Token inválido" en requests
**Solución:**
1. Primero haz login
2. Copia el token de la respuesta
3. Úsalo en requests posteriores

### Problema: Emails no se envían
**Solución:**
1. Mailpit está solo para desarrollo local
2. Los emails se capturan en http://localhost:8025
3. No se envían realmente, es un simulador

---

## Checklist de Configuración

- [ ] Node.js v16+ instalado
- [ ] MongoDB disponible
- [ ] Neo4j disponible
- [ ] Redis disponible
- [ ] Mailpit disponible
- [ ] `npm install` ejecutado
- [ ] `.env` configurado correctamente
- [ ] Puerto 3000 disponible
- [ ] `npm start` ejecutado sin errores
- [ ] `curl http://localhost:3000` retorna JSON

---

## Información Adicional

### Variables de Entorno Importantes (.env)
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/tecdigitalito
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
REDIS_HOST=localhost
REDIS_PORT=6379
MAILPIT_URL=http://localhost:8025
NODE_ENV=development
```

### Endpoints Principales (Rápida Referencia)
```
GET  /                          # Estado del servidor
POST /users/create              # Crear usuario
POST /login                     # Login
POST /logout                    # Logout
GET  /users                     # Buscar usuarios
POST /courses/create            # Crear curso
GET  /courses                   # Listar cursos
POST /messages/send             # Enviar mensaje
GET  /users/log                 # Ver historial de acceso
```

### Documentación Adicional
- Ver `api.md` para documentación completa de endpoints
- Ver código fuente en `users.js`, `clases.js`, `accessLogs.js`

---

**Última actualización:** 2026-04-26
**Versión:** 1.0.0
**Grupo:** IC4302_S1_2026_TP1_G3
