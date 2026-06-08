/**
 * SCRIPT: reset-databases.js
 * 
 * Propósito: Limpiar todas las bases de datos (MongoDB, RavenDB, Redis, Neo4j)
 * Uso: node reset-databases.js
 * 
 * ADVERTENCIA: Este script BORRA TODOS LOS DATOS. Úsalo solo en desarrollo.
 */

import 'dotenv/config.js';
import mongoose from 'mongoose';
import { DocumentStore } from 'ravendb';
import redis from 'redis';
import neo4j from 'neo4j-driver';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/?directConnection=true';
const RAVENDB_URLS = (process.env.RAVENDB_URLS || 'http://localhost:8080').split(',');
const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT || 6379;
const NEO4J_URI = process.env.NEO4J_URI || 'neo4j://localhost:7687';
const NEO4J_USER = process.env.NEO4J_USER || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'password';

async function resetMongoDB() {
  console.log('Limpiando MongoDB...');
  try {
    await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    
    // Obtener todas las colecciones
    const collections = mongoose.connection.collections;
    
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
      console.log(`Colección "${key}" limpiada`);
    }
    
    await mongoose.connection.close();
    console.log('MongoDB resetado\n');
  } catch (error) {
    console.error('Error en MongoDB:', error.message);
  }
}

async function resetRavenDB() {
  console.log('Limpiando RavenDB...');
  try {
    const store = new DocumentStore(RAVENDB_URLS, 'test');
    store.initialize();
    
    // Obtener todas las colecciones y borrarlas
    const session = store.openSession();
    
    // Consultar todos los documentos
    const allDocs = await session.query({ indexName: '@all_docs' }).all();
    
    if (allDocs.length > 0) {
      for (const doc of allDocs) {
        session.delete(doc);
      }
      await session.saveChanges();
      console.log(`${allDocs.length} documentos eliminados`);
    } else {
      console.log('RavenDB ya está vacío');
    }
    
    session.dispose();
    await store.dispose();
    console.log('RavenDB resetado\n');
  } catch (error) {
    console.error('Error en RavenDB:', error.message);
  }
}

async function resetRedis() {
  console.log('Limpiando Redis...');
  try {
    const client = redis.createClient({
      host: REDIS_HOST,
      port: REDIS_PORT,
    });
    
    client.on('error', (err) => {
      throw new Error(`Redis error: ${err.message}`);
    });
    
    await client.connect();
    
    // FLUSHDB borra todos los datos de la base de datos actual
    await client.flushDb();
    console.log('Todos los datos de Redis eliminados');
    
    await client.quit();
    console.log('Redis resetado\n');
  } catch (error) {
    console.error('Error en Redis:', error.message);
  }
}

async function resetNeo4j() {
  console.log('Limpiando Neo4j...');
  try {
    const driver = neo4j.driver(
      NEO4J_URI,
      neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD)
    );
    
    const session = driver.session();
    
    // MATCH (n) DETACH DELETE n - borra todos los nodos y relaciones
    await session.run('MATCH (n) DETACH DELETE n');
    console.log(' Todos los nodos y relaciones eliminados');
    
    await session.close();
    await driver.close();
    console.log('Neo4j resetado\n');
  } catch (error) {
    console.error('Error en Neo4j:', error.message);
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   RESET COMPLETO DE BASES DE DATOS   ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log('ADVERTENCIA: Esto borrará TODOS los datos de:\n');
  console.log(`  • MongoDB: ${MONGO_URI}`);
  console.log(`  • RavenDB: ${RAVENDB_URLS.join(', ')}`);
  console.log(`  • Redis: ${REDIS_HOST}:${REDIS_PORT}`);
  console.log(`  • Neo4j: ${NEO4J_URI}\n`);
  
  // Aquí podrías agregar un prompt para confirmar
  console.log('Iniciando reset...\n');
  
  const startTime = Date.now();
  
  await resetMongoDB();
  await resetRavenDB();
  await resetRedis();
  await resetNeo4j();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('╔════════════════════════════════════════╗');
  console.log('║       RESET COMPLETADO CON ÉXITO       ║');
  console.log('╚════════════════════════════════════════╝\n');
  console.log(`Tiempo total: ${duration}s`);
  console.log('\nTip: Ahora puedes crear un nuevo usuario admin con:');
  console.log('   node create-admin.js\n');
  
  process.exit(0);
}

// Ejecutar
main().catch(error => {
  console.error('\nError fatal:', error);
  process.exit(1);
});
