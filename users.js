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
  const serverUrl = 'http://localhost:8080';
  const databaseName = 'test';

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
}



async function CreateUser(data = {}) {
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


async function searchUserById(id) {
    const session = store.openSession();
    console.log("user/0000000000000000008-A"==id)
    const user = await session.load("user/0000000000000000008-A");

    return { success: true, data: user };
}

async function searchUser(query) {
    const session = store.openSession();
    const users = await session.query({ collection: "user" }).all();
    return { success: true, data: users };
}

export { initializeStore, CreateUser ,searchUserById};