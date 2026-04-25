# Uso de API

## General
### Simple call
[Call](http://localhost:3000)

devuelve metodos disponibles, pseudo isActive

### Startup
Se asegura de que las BD esten conectadas y configuradas correctamente y si no las configura [GET: /startup](http://localhost:3000/startup)


## Users

### Create user
[POST: /users/create](http://localhost:3000/users/create)

Request body:
```
{
  "name": "John Doe",
  "username": "12",
  "password": "1231",
  "dob": "2026-01-01",
  "picPath": "aaa/aaaaaaaaaaaa/aa",
  "typeofuser": "student",
  "correo":"xyz"
}
```
### search user 
#### by id 
Body 
```
"type":"id"
"id":"#########"
```
#### by properties
```
"field":"#########",
"value":"####"
```
o no enviar anada para obtenerlos todos

## Login
[Request body](http://localhost:3000/login)
```
{
  "username":"xyz",
  "password":"xyz"
}
```

o con token de inicio de sesion
```
{
  "token":"#########################"
}
```
## Logout
[Request body](http://localhost:3000/logout)
```
{
  "token":"#########################"
}
```

### AccessLog (Mongo)
Formato del documento de registro de acceso:
```json
{
  "ip": "192.168.1.20",
  "userId": "user_123",
  "device": {
    "type": "mobile",
    "vendor": "Samsung",
    "model": "Galaxy S24"
  },
  "action": "login",
  "successful": true
}
```

`action` solo admite los valores `login` o `logout`.
`userId` es obligatorio y debe identificar al usuario que ejecuta la acción.

## Resetting / updating passwords
### Reset password
el metodo asigan un nuevo password aleatorio, devuelve estado y nuevio password
```
{
  "username": "#############"
}
```

### Update Password
**PUT** `http://localhost:3000/users/update/password/{id}`

Request body:
```
{
  "newpassword":"#############", //nuevo password
  "password":"##########" //viejo para confirmar
}
```

### Get User Log
**GET** `http://localhost:3000/users/log/{id}`

### Set User Role
**POST** `http://localhost:3000/users/role/{id}`

Request body:
```
{
  "role": "student|professor|admin"
}
```

### Get User Role
**GET** `http://localhost:3000/users/role/{id}`

### Send Friend Request
**POST** `http://localhost:3000/users/friends/request/{id}`

Request body:
```
{
  "friendId": "user_id_to_befriend"
}
```

### Get Friends
**GET** `http://localhost:3000/users/friends/{id}`

### Get Friend Requests
**GET** `http://localhost:3000/users/friends/requests/{id}`

### Accept Friend Request
**POST** `http://localhost:3000/users/friends/accept/{id}`

Request body:
```
{
  "friendId": "user_id_to_accept"
}
```

### Reject Friend Request
**POST** `http://localhost:3000/users/friends/reject/{id}`

Request body:
```
{
  "friendId": "user_id_to_reject"
}
```

### Get User Courses
**GET** `http://localhost:3000/users/courses/{id}`

Alternative query parameter format:
**GET** `http://localhost:3000/users/courses?id={studentId}`

### Get User Details with Courses
**GET** `http://localhost:3000/users/details/{userId}`

Returns user information along with enrolled courses.

### 1. Create a course
**POST** `http://localhost:3000/courses/create`

Request body:
```json
{
  "class": {
    "classCode": "IC4302-2026-S1",
    "name": "Bases de Datos 2",
    "description": "Curso avanzado de grafos",
    "startDate": "2026-01-15",
    "endDate": "2026-05-15",
    "fotoPath": "/images/ic4302.jpg"
  },
  "creatorId": "prof_001"
}
```

### 2. Add a section to a course
**POST** `http://localhost:3000/courses/section/{id}`

Request body:
```json
{
  "sectionId": "sec_001",
  "description": "Introducción a bases de datos",
  "isClassParent": true
}
```

### 3. Update a section
**PUT** `http://localhost:3000/courses/section/{classCode}`

Request body:
```json
{
  "description": "Actualización de la descripción de la sección"
}
```
puede actualizarse con el body que se requiera, con cuanta informacion se necesite

### 4. Create an evaluation for a course
**POST** `http://localhost:3000/courses/evaluation/{classCode}`

Request body:
```json
{
  "evalId": "exam_001",
  "name": "Examen Parcial",
  "type": "exam",
  "content": {
    "duration": 120,
    "totalPoints": 200,
    "format": "Written",
    "date": "2026-03-10"
  }
}
```

### 5. Update course status
**PUT** `http://localhost:3000/courses/status/{id}`

Request body:
```json
{
  "status": "active|inactive"
}
```

### 6. Add/Enroll a student in a course
**POST** `http://localhost:3000/courses/students/{classCode}`

Request body:
```json
{
  "studentId": "student_001"
}
```

Alternative (same endpoint for enrollment):
**POST** `http://localhost:3000/courses/enroll/{classCode}`

Request body:
```json
{
  "studentId": "student_001"
}
```

### 7. Get enrolled students for a course
**GET** `http://localhost:3000/courses/students/{classCode}`

### 8. Get courses created by a user
**GET** `http://localhost:3000/courses/mine?id={userId}`

### 9. Clone a class
**POST** `http://localhost:3000/courses/clone/{sourceClassCode}`

Request body:
```json
{
  "newClassCode": "IC4302-2026-S1-copy",
  "creatorId": "prof_002"
}
```

### 10. Get full class details
**GET** `http://localhost:3000/courses/{classCode}`

Returns class information, evaluations, students, and sections.

### 11. List all classes
**GET** `http://localhost:3000/courses`

### 12. Get courses a student is enrolled in
**GET** `http://localhost:3000/courses/enrolled?id={studentId}`

### 13. Get evaluations for a course
**GET** `http://localhost:3000/courses/evaluations/{classCode}`

### 14. Submit evaluation
**POST** `http://localhost:3000/courses/submit/{id}`

Request body:
```json
{
  "evaluationId": "eval_001",
  "answers": {...}
}
```

### 15. Get grades for a course
**GET** `http://localhost:3000/courses/grades/{id}`

## Messages

### Send Message
**POST** `http://localhost:3000/messages/send/{id}`

Request body:
```json
{
  "recipientId": "user_id",
  "content": "Message content",
  "type": "direct|group"
}
```

### Get Inbox Messages
**GET** `http://localhost:3000/messages/inbox/{id}`

### Start New Conversation
**POST** `http://localhost:3000/messages/conversation/{id}`

Request body:
```json
{
  "participantIds": ["user1", "user2"],
  "name": "Conversation name (optional)"
}
```