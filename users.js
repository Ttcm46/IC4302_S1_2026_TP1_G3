import { DocumentStore, GetDatabaseRecordOperation, CreateDatabaseOperation } from "ravendb";
import crypto from "crypto";

let store = null;
let RDBhost;
let RDBdatabase;

// Create and initialize the store once y asegurar creacion de bd
async function initializeStore(host = "http://localhost:8080", database = "test") {
  if (store) {
    return store;
  }
  RDBhost = host;
  RDBdatabase = database;
  store = new DocumentStore(host, database);
  store.initialize();

  const record = await store.maintenance.server.send(
    new GetDatabaseRecordOperation(database)
  );

  if (!record) {
    console.log(`Database '${database}' does not exist. Creating...`);
    await store.maintenance.server.send(
      new CreateDatabaseOperation({ databaseName: database })
    );
  }
}

/**
 * Runs a sample RavenDB operation:
 * - stores a user
 */
async function CreateUser(data = {}) {
  if (!store) {
    throw new Error("Store is not initialized. Call initializeStore() first.");
  }
  const session = store.openSession();

  try {
    const username = data.username || "anonymous";
    const salt = crypto.createHash("sha256").update(username).digest("hex");  //string para ensuciar
    const passwordInput = typeof data.password === "string" ? data.password : "secret"; //si no hay pass creamos uno generico
    const dob = data.dob ? new Date(data.dob) : null;
    const correo = data.correo || null;

    const user = {
      name: data.name || "John Doe",
      salt,
      username,
      password: crypto.createHash("sha256").update(passwordInput + salt).digest("hex"), //ensuciar pass con salt
      dob,
      picPath: data.picPath || null,
      typeofuser: typeof data.typeofuser === "string" ? data.typeofuser : "student",
      correo
    };

    await session.store(user);
    await session.saveChanges();


    const users = await session
      .query({ collection: "@empty" })
      .whereEquals("username", username)
      .all();

    const plainUsers = Array.isArray(users)
      ? users.map(u => ({
          id: u.id,
          username: u.username,
          dob: u.dob,
          name: u.name,
          typeofuser: u.typeofuser,
          correo: u.correo
        }))
      : [];
    await session.dispose();
    return {
      success: true,
      data: plainUsers
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function searchUser(search = null) {
 if (!store) {
    throw new Error("Store is not initialized. Call initializeStore() first.");
  }
  const session = store.openSession();
  let users = null
  let plainUsers = null;
if (search != null)  {
  users = await session.query({ collection: "@empty" })
      .whereEquals(search.field, search.value,search.modifier ? search.modifier : null)
      .all();
}else {
  users = await session.query({ collection: "@empty" }).all();
}
  
  plainUsers = Array.isArray(users)
    ? users.map(u => ({
        id: u.id,
        username: u.username,
        dob: u.dob,
        name: u.name,
        typeofuser: u.typeofuser, 
        correo: u.correo

    }))
    : [];
  await session.dispose();
  return {
    success: true,
    data: plainUsers
  };
}

export { CreateUser,
        initializeStore,
        searchUser 
      };