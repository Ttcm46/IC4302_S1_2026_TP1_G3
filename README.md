# IC4302_S1_2026_TP1_G3
Tarea Programada 1 Grupo 3 BD2_S1_2026

## Intrucciones de inicio
1. Clonar repo (DUH)

2. correr en consola:
```
npm i               --instala paquetes
npm start           --inicia servidor
```

## contenedor de docker
 1. construir container
 ```
docker build . -t IC4302_S1_2026_TP1_G3/node-server:v1


docker run -d IC4302_S1_2026_TP1_G3/node-server:v1                      --detached
docker run -d -p 8001:8080 IC4302_S1_2026_TP1_G3/node-server:v1         -- especificar puerto y bind puerto 8001 de la compu al puerto 8080 del contenedor

 ```