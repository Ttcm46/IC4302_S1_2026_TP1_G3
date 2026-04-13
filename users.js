import { DocumentStore, GetDatabaseRecordOperation, CreateDatabaseOperation } from "ravendb";
import crypto from "crypto";
import redis from "redis";



// Create and initialize the store once y asegurar creacion de bd
async function initializeStore(host = "http://localhost:8080", database = "test") {
  const store=null;
  const serverUrl = host;
  const databaseName = database;

  store = new DocumentStore([serverUrl], databaseName);

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
  const RDclient = createClient();
  RDclient.on('error', err => console.log('Redis Client Error', err));
  RDclient.connect();

  return [store,RDclient];
}



async function CreateUser(data = {},store) {
    if (!store) {
        throw new Error("Store is not initialized. Call initializeStore() first.");
    }
    const session = store.openSession();

    const username = data.username || "anonymous";
    const salt = crypto.createHash("sha256").update(username).digest("hex");
    const passwordInput = typeof data.password === "string" ? data.password : "secret";

    const user = {
      name: data.name || "John Doe",
      username,
      salt,
      password: crypto.createHash("sha256").update(passwordInput + salt).digest("hex"),
      dob: data.dob ? new Date(data.dob) : null,
      picPath: data.picPath || null,
      typeofuser: typeof data.typeofuser === "string" ? data.typeofuser : "student",
      correo: data.correo || null
    };

    await session.store(user,"user/");
    console.log("User stored", user.id);
    await session.saveChanges();
    console.log("User ID:", session.advanced.getDocumentId(user));
    console.log("User stored");
    return { success: true, data: user };


}


async function searchUserById(id,store) {
    const session = store.openSession();
    const user = await session.load(id);

    return { success: true, data: user };
}

async function searchUser(query,store) {
  if (!store) {
    throw new Error("Store is not initialized. Call initializeStore() first.");
  }
  const session = store.openSession();
  if (!query) {
    const users = await session.query({ collection: "@empty" }).all();
    return { success: true, data: users };
  }
  const users = await session.query({ collection: "@empty" }).search(query.field, query.value).all();
  return { success: true, data: users };
}

async function ValidateUser(query,store) {
  const session = store.openSession();
  const user = await session.query({ collection: "@empty" }).search("username", query.username).firstOrNull();
  const tmp = crypto.createHash("sha256").update(query.password + user.salt).digest("hex");
  if (tmp == user.password) {
    return { success: true, 
      message: `Welcome ${user.name}`,
      user: {
        name: user.name,
        username: user.username,  
        dob: user.dob,
        picPath: user.picPath,
        typeofuser: user.typeofuser,
        correo: user.correo,
        id: user.id}
     };
  } else {
    //TODO: Implementar intentos fallidos y bloqueo de cuenta
    return { success: false, message: "Invalid username or password" };
  }
};

export { initializeStore, CreateUser ,searchUserById, searchUser, ValidateUser};