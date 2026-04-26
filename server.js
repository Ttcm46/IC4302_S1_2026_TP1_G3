import express, { json } from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import crypto from "crypto";
import { promises as fs } from "fs";

//funcioines externas
import {
  CreateUser,
  RDBinitializeStore,
  searchUser,
  searchUserById,
  ValidateUser,
  getUser,
  updateUser,
  loadUser,
  getFriends,
  addFriend,
} from "./users.js";
import { initializeMongo, AccessLog, createAccessLog, getDeviceInfo, createMessage, getInboxMessages, getConversationMessages } from "./accessLogs.js";
import { RedisinitializeStore } from "./redisStore.js";
import {
  connectToNeo4j,
  createClass,
  addEvaluation,
  addStudent,
  addSection,
  updateSection,
  deleteSection,
  updateEvaluation,
  deleteEvaluation,
  updateClass,
  setClassPublishedState,
  deleteClass,
  cloneClass,
  getClassDetails,
  getEvaluations,
  getStudents,
  getSections,
  getSectionById,
  getAllClasses,
  sendSampleData,
  getEnrolledClasses,
  getCreatedClasses

} from "./clases.js";
import { get } from "http";

dotenv.config();
//constantes de cleintes de acceso de BD para reciclarlos segun se necesite
let store = null;
let RDclient = null;
let neo4jDriver = null;

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", process.env.CLIENT_ORIGIN || "http://localhost:5173");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});

app.use((err, req, res, next) => {
  if (err?.type === "entity.too.large") {
    return res.status(413).json({
      success: false,
      message: "Payload demasiado grande. Reduce el tamaño del archivo e intenta de nuevo.",
    });
  }

  if (err) {
    return res.status(400).json({ success: false, message: "Request inválido." });
  }

  next();
});

app.get("/", (req, res) => {
  // Send a JSON response with a json
  res.json({
    message: `Hello World! app is running in port: ${PORT}`,
    timestamp: new Date().toISOString(),
    methods: {
      users: [
        "POST /users/create",
        "GET /users/reset",
        "PUT /users/update/password/",
        "GET /users/",
        "GET /users",
        "GET /users/log/",
        "POST /users/role/",
        "GET /users/role/",
        "POST users/friends/request/",
        "GET users/friends/",
        "GET users/friends/requests/",
        "POST users/friends/accept/",
        "POST users/friends/reject/",
        "GET users/courses/",
        "GET users/details/",
      ],
      login: ["GET /login", "GET /logout"],
      courses: [
        "POST /courses/create",
        "POST /courses/section/",
        "PUT /courses/section/",
        "POST /courses/evaluation/",
        "PUT /courses/status/",
        "GET /courses/students/",
        "GET /courses/mine",
        "POST /courses/clone/",
        "GET /courses/",
        "GET /courses",
        "POST /courses/enroll/",
        "GET /courses/enrolled",
        "GET /courses/evaluations/",
        "POST /courses/submit/",
        "GET /courses/grades/",
      ],
      messages: [
        "POST /messages/send/",
        "GET /messages/inbox/",
        "POST /messages/conversation/",
      ],
    },
  });
  // Send a plain text response

  //startupo fucntion to check if all db are up and setup correctlly
});

//------------------------------------------------------------------------------------------------------------------------------------------------
// usuarios
//DONE:
app.post("/users/create", async (req, res) => {
  const data = await CreateUser(req.body, store);
  res.json({ message: "User created successfully", data: data });
});

//DONE: password reset
app.post("/users/reset", async (req, res) => {
  let tmp = await getUser(req.body.username, store);
  if (!tmp) {
    return res.json({ success: false, message: "User not found" });
  }
  tmp = await loadUser(tmp.data.id, store);
  const tmppass = crypto
    .createHash("sha256")
    .update(req.body.username + new Date())
    .digest("hex")
    .slice(0, 8);

  tmp.data.password=tmppass
  await updateUser(tmp.data.id, tmp.data, store);

  const result = await loadUser(req.body.username, store);
  RDclient.del(tmp.data.id); // Invalidate any existing sessions for the user

  res.json({
    message: "Password reset successful, you temporal pass word is ",
    temporaryPassword: tmppass,
  });
});
//DONE: update password                   TEST: untested
app.put("/users/update/password/", (req, res) => {
  const userId = req.params.id || req.body.id;
  if (!userId || !req.body.newpassword) {
    return res.status(400).json({ success: false, message: "Missing id or newpassword" });
  }
  updateUser(userId, { password: req.body.newpassword }, store);
  res.json({ success: true, message: "Password updated successfully" });
});

app.put("/users/update/password/:id", (req, res) => {
  const userId = req.params.id;
  if (!userId || !req.body.newpassword) {
    return res.status(400).json({ success: false, message: "Missing id or newpassword" });
  }
  updateUser(userId, { password: req.body.newpassword }, store);
  res.json({ success: true, message: "Password updated successfully" });
});

//DONE:
app.get("/users", async (req, res) => {
  try {
    const query = req.query?.value
      ? { field: req.query.field || "username", value: req.query.value }
      : (req.body || null);

    if (query && query.type == "id") {
      const data = await searchUserById(query.id, store);
      return res.json({ message: "User search completed", data: data });
    }

    const data = await searchUser(query, store);
    return res.json({ message: "User search completed", data: data });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: "No fue posible buscar usuarios" });
  }
});

app.get("/users/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ success: false, message: "Missing user id" });
  }

  const result = await loadUser(id, store);
  if (!result?.data) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const { password, salt, ...safeUser } = result.data;
  res.json({ success: true, user: safeUser });
});

app.put("/users/:id", async (req, res) => {
  const id = req.params.id;
  if (!id) {
    return res.status(400).json({ success: false, message: "Missing user id" });
  }

  const payload = {
    name: req.body.fullName || req.body.name,
    username: req.body.username,
    dob: req.body.dateOfBirth || req.body.dob,
    picPath: req.body.avatar || req.body.picPath,
    typeofuser: req.body.role || req.body.typeofuser,
    correo: req.body.email || req.body.correo,
  };

  const result = await updateUser(id, payload, store);
  if (!result?.success || !result?.data) {
    return res.status(404).json({ success: false, message: "User not found" });
  }

  const { password, salt, ...safeUser } = result.data;
  res.json({ success: true, message: "Profile updated successfully", user: safeUser });
});
//TODO:
app.get("/users/log/", async (req, res) => {
  const uid = req.query.id || req.query.ID;
  if (!uid) {
    return res.status(400).json({ message: "Missing user id. Use ?id=USER_ID (or ?ID=USER_ID)" });
  }
  const logs = await AccessLog.find({ userId: uid }).sort({ createdAt: -1 }).lean();
  res.json({ message: `Login history for user ID: ${uid}`, logs });
});
//TEST:
app.post("/users/role/", (req, res) => {
  // Logic to assign a role to a user
  updateUser(req.params.id, {password:req.body.newrole}, store)
  res.json({ message: `Role assigned to user ID: ${req.params.id}` });
});
//TEST:
app.get("/users/role/", async (req, res) => {
  // Logic to get the role of a user
  const tmp = await loadUser(req.params.id, store);
  res.json({ message: `Role for user ID: ${req.params.id}`, role: tmp.data?.typeofuser });
});
app.post("/users/friends/request/", async (req, res) => {
  const userId = req.query.id || req.body.userId;
  const friendId = req.query.friendId || req.body.friendId;
  if (!userId || !friendId) {
    return res.status(400).json({ message: "Missing userId or friendId" });
  }
  const result = await addFriend(userId, friendId, store);
  res.json(result);
});
app.get("/users/friends/", async (req, res) => {
  const id = req.query.id;
  if (!id) {
    return res.status(400).json({ message: "Missing user id. Use ?id=USER_ID" });
  }
  const result = await getFriends(id, store);
  res.json(result);
});
//TODO:
app.get("/users/friends/requests/", (req, res) => {
  // Logic to get pending friend requests for a user
  res.json({
    message: `Pending friend requests for user ID: ${req.params.id}`,
  });
});
//TODO:
app.post("/users/friends/accept/", (req, res) => {
  // Logic to accept a friend request
  res.json({
    message: `Friend request accepted for user ID: ${req.params.id}`,
  });
});
//TODO:
app.post("/users/friends/reject/", (req, res) => {
  // Logic to reject a friend request
  res.json({
    message: `Friend request rejected for user ID: ${req.params.id}`,
  });
});
//TEST:
app.get(["/users/courses", "/users/courses/"], async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) {
    return res.status(400).json({
      message: "Missing studentId. Use /users/courses/ or /users/courses?studentId=USER_ID",
    });
  }

  const tmp = await getEnrolledClasses(neo4jDriver, id);
  res.json({
    message: `Courses for user ID: ${id}`,
    classes: tmp
  });
});

//TEST:
app.get("/users/courses/", async (req, res) => {
  const id = req.params.studentId;
  const tmp = await getEnrolledClasses(neo4jDriver, id);
  res.json({
    message: `Courses for user ID: ${id}`,
    classes: tmp
  });
});

//TEST: upgrade: add course data and firends
app.get("/users/details/", async (req, res) => {
  const id = req.params.userId;
  const tmp = await loadUser(id, store);
  const tmpClss = await getEnrolledClasses(neo4jDriver, id);
  // Logic to get user details
  res.json({ message: `User details for user ID: ${id}`, data: tmp.data, clases: tmpClss });
});

//login logout
const safeGetDeviceInfo = (request) => {
  try {
    return getDeviceInfo(request);
  } catch {
    return undefined;
  }
};

//DONE:
const handleLogin = async (req, res) => {
  let msg = null;
  const cookieToken = req.cookies?.accessToken;
  const bodyToken = req.body.token;
  const incomingToken = bodyToken || cookieToken;
  if (incomingToken) {
    //validate token on redis here
    const token = await RDclient.get(incomingToken);
    if (token) {
      const tokenData = JSON.parse(token);
      if (tokenData.login) {
        RDclient.expire(incomingToken, 60 * 60); // Refresh token expiration 1 hr
        const cookieOpts = { httpOnly: false, sameSite: 'strict', maxAge: 3600000 };
        res.cookie('accessToken', incomingToken, { ...cookieOpts, httpOnly: true });
        if (tokenData.user) {
          res.cookie('sessionUser', JSON.stringify(tokenData.user), cookieOpts);
        }
        msg = { success: true, message: `Token valid, welcome back!`, user: tokenData.user };
      }
    }
    if (!msg) msg = { success: false, message: 'Session expired, please log in again' };
  } else {
    //no hay token, validar credenciales6

    const token = crypto
      .createHash("sha256")
      .update(req.body.username)
      .digest("hex");
    //validar que no haya lockout
    let tocheck = await RDclient.get(token);
    if (tocheck) {
      tocheck = JSON.parse(tocheck);
      if (tocheck.lockout) {
        return res.json({
          success: false,
          message: "Account locked due to too many failed login attempts",
        });
        // Note: userId not available before ValidateUser; skipping access log here
      }
    }
    //no hay lockout, validar login
    msg = await ValidateUser(req.body, store);

    //usuario no encontrado
    if (msg.success === false && !msg.user) {
      return res.json({ success: false, message: "Invalid username or password" });
    }

    //malas creds - usuario existe pero password incorrecto
    if (msg.success === false && msg.user && msg.uid) {
      //usuario existe pero password es incorrecto si no exixte pues no hacemos nada
      //increment failed login attempts on redis here and check if it reaches the lockout threshold
      const value = await RDclient.get(token);
      if (value != null) {
        const data = JSON.parse(value);
        data.attempts += 1;
        if (data.attempts >= 5) {
          RDclient.set(
            token,
            JSON.stringify({
              lastLogin: new Date(),
              attempts: data.attempts,
              lockout: true,
              login: false,
            }),
            { EX: 60 * 60 },
          ); // Lock account for 1 hour
          await createAccessLog({ ip: req.ip, userId: msg.uid, device: safeGetDeviceInfo(req), action: 'login', successful: false });
          return res.json({
            success: false,
            message: "Account locked due to too many failed login attempts",
          });
          //lockout
        }
        RDclient.set(
          token,
          JSON.stringify({
            lastLogin: new Date(),
            attempts: data.attempts,
            lockout: false,
            login: false,
          }),
          { EX: 60 * 60 },
        ); // Update failed attempts with expiration of 1 hour
        await createAccessLog({ ip: req.ip, userId: msg.uid, device: safeGetDeviceInfo(req), action: 'login', successful: false });
        return res.json({
          success: false,
          message: "Invalid username or password",
        });
      } else {
        RDclient.set(
          token,
          JSON.stringify({
            lastLogin: new Date(),
            attempts: 1,
            lockout: false,
            login: false,
          }),
          { EX: 60 * 60 },
        );
        await createAccessLog({ ip: req.ip, userId: msg.uid, device: safeGetDeviceInfo(req), action: 'login', successful: false });
        return res.json({
          success: false,
          message: "Invalid username or password",
        });
      }
    }
    //creds validas
    else {
      await RDclient.set(
        token,
        JSON.stringify({
          lastLogin: new Date(),
          attempts: 0,
          lockout: false,
          token: token,
          login: true,
          user: msg.user,
        }),
        { EX: 60 * 60 },
      ); // Set token with expiration of 1 hour
      msg.token = token;
      const cookieOpts = { httpOnly: false, sameSite: 'strict', maxAge: 3600000 };
      res.cookie('accessToken', token, { ...cookieOpts, httpOnly: true });
      if (msg.user) {
        res.cookie('sessionUser', JSON.stringify(msg.user), cookieOpts);
      }
      await createAccessLog({ ip: req.ip, userId: msg.uid, device: safeGetDeviceInfo(req), action: 'login', successful: true });
    }
  }
  res.json(msg);
};

app.get("/login", handleLogin);
app.post("/login", handleLogin);

//DONE:
const handleLogout = async (req, res) => {
  // Logic for user logout
  const token = req.body.token || req.cookies?.accessToken;
  res.clearCookie('accessToken', { sameSite: 'strict' });
  res.clearCookie('sessionUser', { sameSite: 'strict' });
  if (token) {
    //invalidate token on redis here
    const tokenData = await RDclient.get(token);
    const userId = tokenData ? JSON.parse(tokenData)?.user?.id : undefined;
    await createAccessLog({ ip: req.ip, userId, device: safeGetDeviceInfo(req), action: 'logout', successful: true });
    RDclient.del(token);
    res.json({ success: true, message: "Logout successful" });
  } else {
    res.json({ success: true, message: "Logout successful" });
  }
};

app.get("/logout", handleLogout);
app.post("/logout", handleLogout);

// cursos
//DONE, si crea:
app.post("/courses/create", async (req, res) => {
  const classData = req.body.class;
  if (!classData?.classCode) {
    return res.status(400).json({ message: "Missing class data or classCode" });
  }

  const created = await createClass(neo4jDriver, classData, req.body.creatorId);
  res.json({ message: "Course created successfully", course: created });
});
//DONE:
app.post("/courses/section/", async (req, res) => {
  const parentId = req.params.classCode || req.body.classCode;
  const { sectionId, description, isClassParent = true } = req.body;

  if (!sectionId || !description) {
    return res.status(400).json({ message: "Missing sectionId or description" });
  }

  await addSection(neo4jDriver, parentId, sectionId, description, isClassParent);
  res.json({ message: "Section added successfully", sectionId, parentId, isClassParent });
});

app.post("/courses/section/:classCode", async (req, res) => {
  const classCode = req.params.classCode;
  const { sectionId, description, parentId } = req.body;

  if (!classCode || !sectionId || !description) {
    return res.status(400).json({ message: "Missing classCode, sectionId or description" });
  }

  if (parentId) {
    await addSection(neo4jDriver, parentId, sectionId, description, false);
    return res.json({ message: "Subsection added successfully", sectionId, parentId, isClassParent: false });
  }

  await addSection(neo4jDriver, classCode, sectionId, description, true);
  res.json({ message: "Section added successfully", sectionId, parentId: classCode, isClassParent: true });
});
//DONE:
app.put("/courses/section/", async (req, res) => {
  const sectionId = req.params.sectionId || req.params.classCode || req.body.sectionId;
  const { description } = req.body;

  if (!sectionId || !description) {
    return res.status(400).json({ message: "Missing sectionId or description" });
  }

  await updateSection(neo4jDriver, sectionId, description);
  res.json({ message: "Section updated successfully", sectionId });
});

app.put("/courses/section/:sectionId", async (req, res) => {
  const { sectionId } = req.params;
  const { description } = req.body;

  if (!sectionId || !description) {
    return res.status(400).json({ message: "Missing sectionId or description" });
  }

  await updateSection(neo4jDriver, sectionId, description);
  res.json({ message: "Section updated successfully", sectionId });
});

app.delete("/courses/section/:sectionId", async (req, res) => {
  const { sectionId } = req.params;
  if (!sectionId) {
    return res.status(400).json({ message: "Missing sectionId" });
  }

  const deleted = await deleteSection(neo4jDriver, sectionId);
  if (!deleted) {
    return res.status(404).json({ message: "Section not found" });
  }

  res.json({ message: "Section deleted successfully", sectionId });
});

function parseSectionDescription(rawDescription) {
  if (typeof rawDescription !== "string") {
    return {};
  }

  try {
    return JSON.parse(rawDescription);
  } catch {
    return {};
  }
}

app.post("/courses/section/:sectionId/resources", async (req, res) => {
  const { sectionId } = req.params;
  const resourceInput = req.body || {};

  if (!sectionId) {
    return res.status(400).json({ message: "Missing sectionId" });
  }

  if (!resourceInput.title || !resourceInput.type) {
    return res.status(400).json({ message: "Missing resource title or type" });
  }

  const section = await getSectionById(neo4jDriver, sectionId);
  if (!section) {
    return res.status(404).json({ message: "Section not found" });
  }

  const parsed = parseSectionDescription(section.description);
  const resources = Array.isArray(parsed.resources) ? parsed.resources : [];
  const resource = {
    id: resourceInput.id || `res_${Date.now()}`,
    type: resourceInput.type,
    title: resourceInput.title,
    text: resourceInput.text || "",
    url: resourceInput.url || "",
    fileData: resourceInput.fileData || "",
  };

  const nextDescription = JSON.stringify({
    ...parsed,
    resources: [...resources, resource],
  });

  await updateSection(neo4jDriver, sectionId, nextDescription);
  res.json({ message: "Resource added successfully", sectionId, resource });
});

app.put("/courses/section/:sectionId/resources/:resourceId", async (req, res) => {
  const { sectionId, resourceId } = req.params;
  const updates = req.body || {};

  if (!sectionId || !resourceId) {
    return res.status(400).json({ message: "Missing sectionId or resourceId" });
  }

  const section = await getSectionById(neo4jDriver, sectionId);
  if (!section) {
    return res.status(404).json({ message: "Section not found" });
  }

  const parsed = parseSectionDescription(section.description);
  const resources = Array.isArray(parsed.resources) ? parsed.resources : [];
  const index = resources.findIndex((resource) => String(resource.id) === String(resourceId));

  if (index < 0) {
    return res.status(404).json({ message: "Resource not found" });
  }

  const updatedResource = {
    ...resources[index],
    ...updates,
    id: resources[index].id,
  };

  resources[index] = updatedResource;

  const nextDescription = JSON.stringify({
    ...parsed,
    resources,
  });

  await updateSection(neo4jDriver, sectionId, nextDescription);
  res.json({ message: "Resource updated successfully", sectionId, resource: updatedResource });
});

app.delete("/courses/section/:sectionId/resources/:resourceId", async (req, res) => {
  const { sectionId, resourceId } = req.params;

  if (!sectionId || !resourceId) {
    return res.status(400).json({ message: "Missing sectionId or resourceId" });
  }

  const section = await getSectionById(neo4jDriver, sectionId);
  if (!section) {
    return res.status(404).json({ message: "Section not found" });
  }

  const parsed = parseSectionDescription(section.description);
  const resources = Array.isArray(parsed.resources) ? parsed.resources : [];
  const filteredResources = resources.filter((resource) => String(resource.id) !== String(resourceId));

  if (filteredResources.length === resources.length) {
    return res.status(404).json({ message: "Resource not found" });
  }

  const nextDescription = JSON.stringify({
    ...parsed,
    resources: filteredResources,
  });

  await updateSection(neo4jDriver, sectionId, nextDescription);
  res.json({ message: "Resource deleted successfully", sectionId, resourceId });
});
//DONE:
app.post("/courses/evaluation/", async (req, res) => {
  const classCode = req.params.classCode || req.body.classCode;
  const { evalId, name, type, content } = req.body;

  if (!evalId || !name || !type || content == null) {
    return res.status(400).json({ message: "Missing evaluation fields (evalId, name, type, content)" });
  }

  const normalizedContent = typeof content === "string" ? content : JSON.stringify(content);
  await addEvaluation(neo4jDriver, classCode, evalId, name, type, normalizedContent);
  res.json({ message: "Evaluation added successfully", classCode, evalId });
});

app.post("/courses/evaluation/:classCode", async (req, res) => {
  const classCode = req.params.classCode;
  const { evalId, name, type, content } = req.body;

  if (!evalId || !name || !type || content == null) {
    return res.status(400).json({ message: "Missing evaluation fields (evalId, name, type, content)" });
  }

  const normalizedContent = typeof content === "string" ? content : JSON.stringify(content);
  await addEvaluation(neo4jDriver, classCode, evalId, name, type, normalizedContent);
  res.json({ message: "Evaluation added successfully", classCode, evalId });
});

app.put("/courses/evaluation/:classCode/:evalId", async (req, res) => {
  const { classCode, evalId } = req.params;
  const updates = {
    name: req.body.name,
    type: req.body.type,
    content: req.body.content == null
      ? undefined
      : (typeof req.body.content === "string" ? req.body.content : JSON.stringify(req.body.content)),
  };

  const updated = await updateEvaluation(neo4jDriver, classCode, evalId, updates);
  if (!updated) {
    return res.status(404).json({ message: "Evaluation not found" });
  }

  res.json({ message: "Evaluation updated successfully", evaluation: updated });
});

app.delete("/courses/evaluation/:classCode/:evalId", async (req, res) => {
  const { classCode, evalId } = req.params;
  const deleted = await deleteEvaluation(neo4jDriver, classCode, evalId);
  if (!deleted) {
    return res.status(404).json({ message: "Evaluation not found" });
  }

  res.json({ message: "Evaluation deleted successfully", classCode, evalId });
});
//TODO:
app.put("/courses/status/", (req, res) => {
  // Logic to update the status of a course
  res.json({
    message: `Course status updated for course ID: ${req.params.id}`,
  });
});

app.put("/courses/status/:classCode", async (req, res) => {
  const { classCode } = req.params;
  const { isPublished } = req.body || {};

  if (typeof isPublished !== "boolean") {
    return res.status(400).json({ message: "Missing boolean isPublished" });
  }

  const updated = await setClassPublishedState(neo4jDriver, classCode, isPublished);
  if (!updated) {
    return res.status(404).json({ message: "Class not found" });
  }

  res.json({ message: "Course status updated successfully", course: updated });
});
//DONE:
app.post("/courses/students/", async (req, res) => {
  const classCode = req.params.classCode;
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: "Missing studentId" });
  }

  await addStudent(neo4jDriver, classCode, studentId);
  res.json({ message: "Student added successfully", classCode, studentId });
});
//DONE:
app.get("/courses/students/", async (req, res) => {
  const classCode = req.params.classCode;
  const students = await getStudents(neo4jDriver, classCode);
  res.json({ message: `Students enrolled in course ${classCode}`, students });
});
//DONE:
app.get("/courses/mine", async (req, res) => {
  const id = req.query.id || req.body.id;
  if (!id) {
    return res.status(400).json({
      message: "Missing user ID. Use /courses/mine?id=USER_ID",
    });
  }

  const classes = await getCreatedClasses(neo4jDriver, id);
  const classesWithUsername = await Promise.all(
    classes.map(async (course) => {
      if (course?.creatorUsername || !course?.creatorId) return course;
      const owner = await loadUser(course.creatorId, store);
      if (owner?.data?.username) {
        return { ...course, creatorUsername: owner.data.username };
      }
      return course;
    }),
  );
  res.json({
    message: `Courses created by user ${id}`,
    classes: classesWithUsername,
  });
});
//DONE:
app.post("/courses/clone/", async (req, res) => {
  const sourceClassCode = req.params.sourceClassCode;
  const newClassCode = req.body.newClassCode || `${sourceClassCode}-clone`;
  const creatorId = req.body.creatorId || req.body.id || null;

  if (!newClassCode) {
    return res.status(400).json({ message: "Missing newClassCode for cloned course" });
  }

  const cloned = await cloneClass(neo4jDriver, sourceClassCode, newClassCode, creatorId);
  res.json({ message: "Course cloned successfully", course: cloned });
});

app.post("/courses/clone/:sourceClassCode", async (req, res) => {
  const { sourceClassCode } = req.params;
  const newClassCode = req.body.newClassCode;
  const creatorId = req.body.creatorId || req.body.id || null;

  if (!sourceClassCode || !newClassCode) {
    return res.status(400).json({ message: "Missing sourceClassCode or newClassCode" });
  }

  const overrides = {
    name: req.body.name,
    description: req.body.description,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    fotoPath: req.body.fotoPath,
  };

  const cloned = await cloneClass(neo4jDriver, sourceClassCode, newClassCode, creatorId, overrides);
  if (!cloned) {
    return res.status(404).json({ message: "Source class not found" });
  }

  res.json({ message: "Course cloned successfully", course: cloned });
});

app.put("/courses/:classCode", async (req, res) => {
  const { classCode } = req.params;
  const updates = {
    name: req.body.name,
    description: req.body.description,
    startDate: req.body.startDate,
    endDate: req.body.endDate,
    fotoPath: req.body.fotoPath,
  };

  const updated = await updateClass(neo4jDriver, classCode, updates);
  if (!updated) {
    return res.status(404).json({ message: "Class not found" });
  }

  res.json({ message: "Course updated successfully", course: updated });
});

app.delete("/courses/:classCode", async (req, res) => {
  const { classCode } = req.params;
  const deleted = await deleteClass(neo4jDriver, classCode);

  if (!deleted) {
    return res.status(404).json({ message: "Class not found" });
  }

  res.json({ message: "Course deleted successfully", classCode });
});
//DONE: list all courses (must be before /:classCode)
app.get("/courses", async (req, res) => {
  const classes = await getAllClasses(neo4jDriver);
  const classesWithUsername = await Promise.all(
    classes.map(async (course) => {
      if (course?.creatorUsername || !course?.creatorId) return course;
      const owner = await loadUser(course.creatorId, store);
      if (owner?.data?.username) {
        return { ...course, creatorUsername: owner.data.username };
      }
      return course;
    }),
  );
  res.json({ message: "All available courses", classes: classesWithUsername });
});

//DONE: enrolled courses (must be before /:classCode)
app.get("/courses/enrolled", async (req, res) => {
  const studentId = req.query.id || req.body.id;
  const username = req.query.username || req.body.username;

  if (!studentId && !username) {
    return res.status(400).json({ message: "Missing student identifier. Use /courses/enrolled?id=USER_ID or username=USERNAME" });
  }

  const courses = await getEnrolledClasses(neo4jDriver, studentId, username);
  res.json({ message: `Courses enrolled by student ${studentId || username}`, courses });
});

//DONE: enroll in a course (must be before /:classCode)
app.post("/courses/enroll/", async (req, res) => {
  const classCode = req.params.classCode || req.body.classCode;
  const studentId = req.body.studentId || req.body.username;

  if (!studentId || !classCode) {
    return res.status(400).json({ message: "Missing studentId/username or classCode" });
  }

  await addStudent(neo4jDriver, classCode, studentId);
  res.json({ message: "Student enrolled successfully", classCode, studentId });
});

app.post("/courses/enroll/:classCode", async (req, res) => {
  const classCode = req.params.classCode;
  const studentId = req.body.studentId || req.body.username;

  if (!studentId || !classCode) {
    return res.status(400).json({ message: "Missing studentId/username or classCode" });
  }

  await addStudent(neo4jDriver, classCode, studentId);
  res.json({ message: "Student enrolled successfully", classCode, studentId });
});

//DONE: course detail by code (dynamic param — must come LAST among /courses/* GETs)
app.get("/courses/:classCode", async (req, res) => {
  const classCode = req.params.classCode;
  const details = await getClassDetails(neo4jDriver, classCode);
  if (!details) {
    return res.status(404).json({ message: `Class not found: ${classCode}` });
  }
  if (details.class?.creatorId && !details.class?.creatorUsername) {
    const owner = await loadUser(details.class.creatorId, store);
    if (owner?.data?.username) {
      details.class.creatorUsername = owner.data.username;
    }
  }
  res.json({ message: `Class details for ${classCode}`, details });
});
//DONE:
app.get("/courses/evaluations/", async (req, res) => {
  const classCode = req.params.classCode || req.query.classCode;
  if (!classCode) {
    return res.status(400).json({ message: "Missing classCode" });
  }
  const evaluations = await getEvaluations(neo4jDriver, classCode);
  res.json({ message: `Evaluations for course ${classCode}`, evaluations });
});

app.get("/courses/evaluations/:classCode", async (req, res) => {
  const classCode = req.params.classCode;
  const evaluations = await getEvaluations(neo4jDriver, classCode);
  res.json({ message: `Evaluations for course ${classCode}`, evaluations });
});

function getGradeKey(classCode, evalId, userId) {
  return `grades:${classCode}:${evalId}:${userId}`;
}

app.post("/courses/submit/:classCode/:evalId", async (req, res) => {
  const { classCode, evalId } = req.params;
  const {
    userId,
    username,
    assessmentTitle,
    score,
    correctAnswers,
    totalQuestions,
    questionResults,
  } = req.body || {};

  if (!classCode || !evalId || !userId) {
    return res.status(400).json({ message: "Missing classCode, evalId or userId" });
  }

  if (score == null || correctAnswers == null || totalQuestions == null) {
    return res.status(400).json({ message: "Missing grade payload fields" });
  }

  const key = getGradeKey(classCode, evalId, userId);
  const alreadySubmitted = await RDclient.get(key);
  if (alreadySubmitted) {
    return res.status(409).json({
      message: "Assessment already submitted",
      result: JSON.parse(alreadySubmitted),
    });
  }

  const result = {
    id: crypto.randomUUID(),
    courseId: classCode,
    assessmentId: evalId,
    userId: String(userId),
    username: username || String(userId),
    assessmentTitle: assessmentTitle || evalId,
    score,
    correctAnswers,
    totalQuestions,
    questionResults: Array.isArray(questionResults) ? questionResults : [],
    submittedAt: new Date().toISOString(),
  };

  await RDclient.set(key, JSON.stringify(result));
  await RDclient.sAdd(`grades:index:${classCode}:eval:${evalId}:users`, String(userId));
  await RDclient.sAdd(`grades:index:${classCode}:user:${userId}:evals`, String(evalId));
  await RDclient.sAdd(`grades:index:${classCode}:evals`, String(evalId));

  res.json({ message: "Evaluation submitted successfully", result });
});

app.get("/courses/grades/:classCode/:evalId", async (req, res) => {
  const { classCode, evalId } = req.params;
  const userId = req.query.userId;

  if (!classCode || !evalId) {
    return res.status(400).json({ message: "Missing classCode or evalId" });
  }

  if (userId) {
    const key = getGradeKey(classCode, evalId, userId);
    const saved = await RDclient.get(key);
    return res.json({
      message: `Grade for ${classCode}/${evalId}/${userId}`,
      result: saved ? JSON.parse(saved) : null,
    });
  }

  const userIds = await RDclient.sMembers(`grades:index:${classCode}:eval:${evalId}:users`);
  const results = [];
  for (const uid of userIds) {
    const key = getGradeKey(classCode, evalId, uid);
    const saved = await RDclient.get(key);
    if (saved) {
      results.push(JSON.parse(saved));
    }
  }

  res.json({
    message: `Grades for assessment ${evalId} in class ${classCode}`,
    results,
  });
});

app.get("/courses/grades/:classCode", async (req, res) => {
  const { classCode } = req.params;
  const userId = req.query.userId;

  if (!classCode) {
    return res.status(400).json({ message: "Missing classCode" });
  }

  if (userId) {
    const evalIds = await RDclient.sMembers(`grades:index:${classCode}:user:${userId}:evals`);
    const results = [];

    for (const evalId of evalIds) {
      const key = getGradeKey(classCode, evalId, userId);
      const saved = await RDclient.get(key);
      if (saved) {
        results.push(JSON.parse(saved));
      }
    }

    return res.json({
      message: `Grades for user ${userId} in class ${classCode}`,
      results,
    });
  }

  const evalIds = await RDclient.sMembers(`grades:index:${classCode}:evals`);
  const results = [];

  for (const evalId of evalIds) {
    const userIds = await RDclient.sMembers(`grades:index:${classCode}:eval:${evalId}:users`);
    for (const uid of userIds) {
      const key = getGradeKey(classCode, evalId, uid);
      const saved = await RDclient.get(key);
      if (saved) {
        results.push(JSON.parse(saved));
      }
    }
  }

  res.json({ message: `All grades for class ${classCode}`, results });
});

//messages
app.post("/messages/send/", async (req, res) => {
  const cookieToken = req.cookies?.accessToken;
  let senderIdFromToken = null;
  if (cookieToken && RDclient) {
    try {
      const raw = await RDclient.get(cookieToken);
      if (raw) senderIdFromToken = JSON.parse(raw)?.user?.id || null;
    } catch { /* ignore */ }
  }

  const fromUserId = req.query.id || req.body.fromUserId || senderIdFromToken;
  const toUserId   = req.body.toUserId || req.body.recipientId;
  const content    = req.body.content;

  if (!fromUserId || !toUserId || !content) {
    return res.status(400).json({ success: false, message: "Missing fromUserId, toUserId or content" });
  }

  try {
    const msg = await createMessage({ fromUserId, toUserId, content });
    return res.json({ success: true, message: "Message sent successfully", data: msg });
  } catch (err) {
    console.error("messages/send error:", err);
    return res.status(500).json({ success: false, message: "Failed to send message" });
  }
});

app.get("/messages/inbox/", async (req, res) => {
  const userId = req.query.id || req.body.id;
  if (!userId) {
    return res.status(400).json({ success: false, message: "Missing user id. Use ?id=USER_ID" });
  }

  try {
    const messages = await getInboxMessages(userId);
    return res.json({ success: true, messages });
  } catch (err) {
    console.error("messages/inbox error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch inbox" });
  }
});

app.post("/messages/conversation/", async (req, res) => {
  const userId      = req.query.id || req.body.userId;
  const otherUserId = req.body.otherUserId || (Array.isArray(req.body.participantIds) ? req.body.participantIds.find((p) => p !== userId) : null);

  if (!userId || !otherUserId) {
    return res.status(400).json({ success: false, message: "Missing userId or otherUserId" });
  }

  try {
    const messages = await getConversationMessages(userId, otherUserId);
    return res.json({ success: true, messages });
  } catch (err) {
    console.error("messages/conversation error:", err);
    return res.status(500).json({ success: false, message: "Failed to fetch conversation" });
  }
});

app.post("/test", async (req, res) => {
  await sendSampleData(neo4jDriver);
});

app.listen(PORT, async () => {
  console.log(`Server is running on port http://localhost:${PORT}`);

  const redisUrl = process.env.REDIS_URL || process.env.Redis_URL || "redis://localhost:6379";
  const redisDb = process.env.REDIS_DB || process.env.Redis_DB || "0";
  const neo4jUrl = process.env.NEO4J_URL || process.env.neo4j_URL || "bolt://localhost:7687";

  store  = await RDBinitializeStore(
    process.env.RAVENDB_URL || "http://localhost:8080",
    process.env.RAVENDB_DB || "test",
  );
  console.log("RavenDB store initialized");

  RDclient = await RedisinitializeStore(
    redisUrl,
    redisDb,
  );
  console.log("Redis client initialized");

  neo4jDriver = connectToNeo4j(
    neo4jUrl,
    // process.env.NEO4J_USER || "neo4j",
    // process.env.NEO4J_PASSWORD || "password"
  );
  console.log("Neo4j driver initialized");

  try {
    await initializeMongo();
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Failed to initialize MongoDB:", error.message);
  }

  //await sendSampleData(neo4jDriver);
});
