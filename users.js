import { DocumentStore, GetDatabaseRecordOperation, CreateDatabaseOperation } from "ravendb";
import crypto from "crypto";
import { createClient } from "redis";



// Create and initialize the store once
async function RDBinitializeStore(host = "http://localhost:8080", database = "test") {
  console.log("starting RVDB connection")
  const serverUrl = host;
  const databaseName = database;
  
  let store = new DocumentStore([serverUrl], databaseName);

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
  return store;
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
      correo: data.correo || null,
      friends: []
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
  
  // If user not found, return generic error but include userFound flag for internal tracking
  if (!user) {
    return { 
      success: false, 
      message: "Invalid username or password",
      userFound: false  // For internal use only - server must NOT send this to client
    };
  }
  
  const tmp = crypto.createHash("sha256").update(query.password + user.salt).digest("hex");
  if (tmp == user.password) {
    return { 
      success: true, 
      message: `Welcome ${user.name}`,
      userFound: true,
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
    // Password incorrect - return user for internal tracking, but don't send to client
    return { 
      success: false, 
      message: "Invalid username or password",
      userFound: true,  // For internal use only
      user: user,
      uid: user.id
    };
  }
};
async function getUser(username,store) {
  const session = store.openSession();
  const user = await session.query({ collection: "@empty" }).search("username", username).firstOrNull();
  return { success: true, data: user };
}
async function loadUser(id,store) {
  const session = store.openSession();
  const user = await session.load(id);
  return { success: true, data: user };
}

async function updateUser(id, data, store) {
  const session = store.openSession();
  const user = await session.load(id);
  if (!user) {
    return { success: false, message: "User not found" };
  }
  user.name= data.name || user.name
  user.username=data.username || user.username
  user.dob=data.dob || user.dob
  user.picPath=data.picPath ||user.picPath
  user.typeofuser=data.typeofuser||user.typeofuser
  user.correo=data.correo||user.correo
  user.password= data.password ? crypto.createHash("sha256").update(data.password + user.salt).digest("hex") : user.password

  await session.saveChanges();
  return { success: true, data: user };
}

async function getFriends(id, store) {
  const session = store.openSession();
  const user = await session.load(id);
  if (!user) {
    return { success: false, message: "User not found" };
  }
  return { success: true, friends: user.friends || [] };
}

async function addFriend(userId, friendId, store) {
  const session = store.openSession();
  
  // Load both users
  const user = await session.load(userId);
  const friend = await session.load(friendId);
  
  if (!user || !friend) {
    return { success: false, message: "User or friend not found" };
  }
  
  // Initialize friends arrays if they don't exist
  if (!user.friends) user.friends = [];
  if (!friend.friends) friend.friends = [];
  
  // Add friendId to user's friends if not already there
  if (!user.friends.includes(friendId)) {
    user.friends.push(friendId);
  }
  
  // Add userId to friend's friends if not already there (mutual friendship)
  if (!friend.friends.includes(userId)) {
    friend.friends.push(userId);
  }
  
  await session.saveChanges();
  return { success: true, message: "Friend added successfully" };
}

async function removeFriend(userId, friendId, store) {
  const session = store.openSession();
  const user = await session.load(userId);
  const friend = await session.load(friendId);

  if (!user || !friend) {
    return { success: false, message: "User not found" };
  }

  if (user.friends) user.friends = user.friends.filter((id) => id !== friendId);
  if (friend.friends) friend.friends = friend.friends.filter((id) => id !== userId);

  await session.saveChanges();
  return { success: true, message: "Friend removed successfully" };
}

async function sendFriendRequest(userId, friendId, store) {
  const session = store.openSession();
  const user = await session.load(userId);
  const friend = await session.load(friendId);

  if (!user || !friend) {
    return { success: false, message: "User or friend not found" };
  }

  if (!friend.friendRequests) friend.friendRequests = [];
  if (!user.friends) user.friends = [];
  if (!friend.friends) friend.friends = [];

  if (user.friends.includes(friendId) || friend.friends.includes(userId)) {
    return { success: false, message: "Already friends" };
  }

  if (!user.sentRequests) user.sentRequests = [];

  if (!friend.friendRequests.includes(userId)) {
    friend.friendRequests.push(userId);
  }
  if (!user.sentRequests.includes(friendId)) {
    user.sentRequests.push(friendId);
  }

  await session.saveChanges();
  return { success: true, message: "Friend request sent" };
}

async function getPendingRequests(userId, store) {
  const session = store.openSession();
  const user = await session.load(userId);
  if (!user) {
    return { success: false, message: "User not found" };
  }
  return { success: true, requests: user.friendRequests || [] };
}

async function acceptFriendRequest(userId, fromUserId, store) {
  const session = store.openSession();
  const user = await session.load(userId);
  const from = await session.load(fromUserId);

  if (!user || !from) {
    return { success: false, message: "User not found" };
  }

  if (!user.friends) user.friends = [];
  if (!from.friends) from.friends = [];
  if (!user.friendRequests) user.friendRequests = [];

  user.friendRequests = user.friendRequests.filter((id) => id !== fromUserId);
  if (from.sentRequests) from.sentRequests = from.sentRequests.filter((id) => id !== userId);

  if (!user.friends.includes(fromUserId)) user.friends.push(fromUserId);
  if (!from.friends.includes(userId)) from.friends.push(userId);

  await session.saveChanges();
  return { success: true, message: "Friend request accepted" };
}

async function rejectFriendRequest(userId, fromUserId, store) {
  const session = store.openSession();
  const user = await session.load(userId);
  const from = await session.load(fromUserId);

  if (!user) {
    return { success: false, message: "User not found" };
  }

  if (!user.friendRequests) user.friendRequests = [];
  user.friendRequests = user.friendRequests.filter((id) => id !== fromUserId);
  if (from && from.sentRequests) from.sentRequests = from.sentRequests.filter((id) => id !== userId);

  await session.saveChanges();
  return { success: true, message: "Friend request rejected" };
}

async function getSentRequests(userId, store) {
  const session = store.openSession();
  const user = await session.load(userId);
  if (!user) {
    return { success: false, message: "User not found" };
  }
  return { success: true, requests: user.sentRequests || [] };
}

// Verifica si un username ya existe
async function checkUsernameExists(username, store) {
  if (!username || !store) return false;
  const session = store.openSession();
  try {
    const users = await session.query({ collection: "@empty" }).all();
    const exists = users.some(u => u.username && u.username.toLowerCase() === username.toLowerCase());
    return exists;
  } catch (error) {
    console.error('[checkUsernameExists] Error:', error);
    return false;
  } finally {
    session.dispose();
  }
}

// Verifica si un email ya existe
async function checkEmailExists(email, store) {
  if (!email || !store) return false;
  const session = store.openSession();
  try {
    const users = await session.query({ collection: "@empty" }).all();
    const exists = users.some(u => u.correo && u.correo.toLowerCase() === email.toLowerCase());
    return exists;
  } catch (error) {
    console.error('[checkEmailExists] Error:', error);
    return false;
  } finally {
    session.dispose();
  }
}

// Busca y devuelve el documento de usuario cuyo campo 'correo' coincida con el email
// proporcionado (comparación case-insensitive). Devuelve null si no existe.
// Usada en POST /users/reset para verificar que el correo pertenece a una cuenta
// registrada antes de generar el token de recuperación.
async function getUserByEmail(email, store) {
  if (!email || !store) return null;
  const session = store.openSession();
  try {
    const users = await session.query({ collection: "@empty" }).all();
    return users.find(u => u.correo && u.correo.toLowerCase() === email.toLowerCase()) || null;
  } catch (error) {
    console.error('[getUserByEmail] Error:', error);
    return null;
  } finally {
    session.dispose();
  }
}
// se ocupa modificar porque el sistema de mensajes necesita 
// el username del destinatario para mostrarlo en la interfaz, 
// pero el token solo tiene el id. Entonces se hace una consulta 
// para obtener el username a partir del id antes de enviar el 
// mensaje.
export { RDBinitializeStore, CreateUser, searchUserById, searchUser, ValidateUser, getUser, updateUser, loadUser, getFriends, addFriend, removeFriend, sendFriendRequest, getPendingRequests, getSentRequests, acceptFriendRequest, rejectFriendRequest, checkUsernameExists, checkEmailExists, getUserByEmail };