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
[GET: /users ](http://localhost:3000/users)
Sin Body: busca a todos los usuarios

Con Body buscara a todos los usuarios cuyo field empieza con el valor dado [Documentacion dde busquedas](https://docs.ravendb.net/7.2/indexes/querying/filtering)
```
{
    "type":"equals"|"whereGreaterThan"|"whereLessThan"|"containsAny"|"containsAll"|"whereStartsWith"|"whereEndsWith"|"whereExists" default: "search",
  "field": "username"|"name"|"dob"|"picpath"|"typeofuser"|"correo",
  "value": "####"
}
```
O busqueda con modificadores para ampliar la busqueda
```
{
    "type":"equals"|"whereGreaterThan"|"whereLessThan"|"containsAny"|"containsAll"|"whereStartsWith"|"whereEndsWith"|"whereExists" default: "search",
  "field": "username"|"name"|"dob"|"picpath"|"typeofuser"|"correo",
  "value": "term1 term2",
  "modifier":"AND"|"OR"
}
```