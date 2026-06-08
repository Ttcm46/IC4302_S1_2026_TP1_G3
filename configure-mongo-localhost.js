import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';

// Este script existe para corregir un problema de configuración del replica set de MongoDB
// cuando se ejecuta en local con Docker. MongoDB puede fallar al resolver los miembros del
// cluster usando nombres de host no válidos para el entorno Docker, por lo que esta utilidad
// detecta el primary actual y reconfigura el replica set con los hostnames internos correctos.
// De esa forma se arregla el error de MongoDB que impedía que el replica set se estabilizara.
//
// Se creó específicamente para solucionar el error de conexión/replica set reportado
// en el entorno local, sin necesidad de modificar manualmente la configuración del cluster.
//
// Nota: este script no crea el replica set; asume que los nodos ya están en ejecución.
//       Solo ajusta los hostnames de los miembros al formato `mongo-node-X:27017`.

// Carga variables de entorno desde el archivo .env y las hace disponibles para la configuración.
dotenv.config();

// Puertos locales donde se espera que los miembros del replica set de MongoDB estén disponibles.
const ports = [27017, 27018, 27019];
// Tiempo máximo en segundos para esperar que un nodo se convierta en primary tras una reconfiguración.
const electionTimeoutSeconds = 30;

// Busca el nodo primary del replica set local iterando los puertos conocidos.
// Devuelve el cliente conectado, el puerto y la información de hello si encuentra el primary.
async function findPrimary() {
  for (const port of ports) {
    const uri = `mongodb://localhost:${port}/?directConnection=true&serverSelectionTimeoutMS=2000`;
    const client = new MongoClient(uri);

    try {
      await client.connect();
      const adminDb = client.db('admin');
      const info = await adminDb.command({ hello: 1 });

      if (info.isWritablePrimary || info.isWritablePrimary === true || info.ismaster === true) {
        console.log(`Found primary at localhost:${port}`);
        return { client, port, info };
      }

      await client.close();
    } catch (error) {
      console.warn(`Cannot connect to localhost:${port} as a primary: ${error.message}`);
      try {
        await client.close();
      } catch (_err) {
        // ignore
      }
    }
  }

  return null;
}

// Espera a que el nodo especificado se convierta en primary tras una reconfiguración.
// Reintenta periódicamente hasta agotar el tiempo de espera configurado.
async function waitForPrimary(port) {
  const uri = `mongodb://localhost:${port}/?directConnection=true&serverSelectionTimeoutMS=2000`;
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const adminDb = client.db('admin');

    const deadline = Date.now() + electionTimeoutSeconds * 1000;
    while (Date.now() < deadline) {
      const info = await adminDb.command({ hello: 1 });
      if (info.isWritablePrimary || info.isWritablePrimary === true || info.ismaster === true) {
        console.log(`localhost:${port} is now primary.`);
        return true;
      }
      console.log(`Waiting for localhost:${port} to become primary...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.error(`Timed out waiting for localhost:${port} to become primary.`);
    return false;
  } finally {
    await client.close();
  }
}

// Ejecuta el flujo principal de configuración del replica set local.
// Detecta el primary actual, adapta los hosts a Docker y reconfigura el replica set si es necesario.
async function run() {
  console.log('Starting MongoDB localhost replica set configuration script...');

  const primary = await findPrimary();
  if (!primary) {
    console.error('No primary found on localhost:27017, 27018 or 27019. A replica set must be running first.');
    process.exit(1);
  }

  const { client, port } = primary;
  const adminDb = client.db('admin');

  try {
    const configResult = await adminDb.command({ replSetGetConfig: 1 });
    const config = configResult.config;
    const desiredMembers = config.members.map((member) => ({
      ...member,
      host: member.host.startsWith('mongo-node-') ? member.host : `mongo-node-${member._id}:27017`,
      priority: member._id === 0 ? 2 : 1,
    }));

    const needsUpdate = config.members.some((member, index) => member.host !== desiredMembers[index].host);

    if (!needsUpdate) {
      console.log('Replica set is already configured for Docker internal hostnames. No reconfiguration required.');
    } else {
      const newConfig = {
        ...config,
        version: config.version + 1,
        members: desiredMembers,
      };

      console.log('Reconfiguring replica set members to Docker internal hostnames...');
      await adminDb.command({ replSetReconfig: newConfig });
      console.log('Replica set reconfiguration complete. Waiting for localhost:27017 to become primary...');

      const ready = await waitForPrimary(27017);
      if (!ready) {
        console.error('Replica set reconfiguration finished, but localhost:27017 did not become primary in time.');
        process.exit(1);
      }
    }

    console.log('MongoDB localhost replica set configuration completed successfully.');
    console.log('Ahora puedes ejecutar la aplicación de nuevo.');
  } catch (error) {
    console.error('Error al reconfigurar el replica set:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});