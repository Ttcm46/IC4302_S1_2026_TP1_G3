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
"id":"#########"
```
#### by properties
