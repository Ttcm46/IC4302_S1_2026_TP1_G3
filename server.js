import express, { json } from "express";
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
} from "./users.js";
import { RedisinitializeStore } from "./redisStore.js";
import {
  connectToNeo4j,
  createClass,
  addEvaluation,
  addStudent,
  addSection,
  updateSection,
  cloneClass,
  getClassDetails,
  getEvaluations,
  getStudents,
  getSections,
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
app.use(express.json());

app.get("/", (req, res) => {
  // Send a JSON response with a json
  res.json({
    message: `Hello World! app is running in port: ${PORT}`,
    timestamp: new Date().toISOString(),
    methods: {
      users: [
        "POST /users/create",
        "GET /users/reset:id",
        "PUT /users/update/password/:id",
        "GET /users/:id",
        "GET /users",
        "GET /users/log/:id",
        "POST /users/role/:id",
        "GET /users/role/:id",
        "POST users/friends/request/:id",
        "GET users/friends/",
        "GET users/friends/requests/:id",
        "POST users/friends/accept/:id",
        "POST users/friends/reject/:id",
        "GET users/courses/:id",
        "GET users/details/:id",
      ],
      login: ["GET /login", "GET /logout"],
      courses: [
        "POST /courses/create",
        "POST /courses/section/:id",
        "PUT /courses/section/:id",
        "POST /courses/evaluation/:id",
        "PUT /courses/status/:id",
        "GET /courses/students/:id",
        "GET /courses/mine",
        "POST /courses/clone/:id",
        "GET /courses/:id",
        "GET /courses",
        "POST /courses/enroll/:id",
        "GET /courses/enrolled",
        "GET /courses/evaluations/:id",
        "POST /courses/submit/:id",
        "GET /courses/grades/:id",
      ],
      messages: [
        "POST /messages/send/:id",
        "GET /messages/inbox/:id",
        "POST /messages/conversation/:id",
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
  updateUser(req.params.id, {password:req.body.newpassword}, store);
  res.json({ message: "Password updated successfully" });
});

//DONE:
app.get("/users", async (req, res) => {
  if (req.body && req.body.type == "id") {
    const data = await searchUserById(req.body.id, store);
    res.json({ message: "User search completed", data: data });
  } else {
    const data = await searchUser(req.body);
    res.json({ message: "User search completed", data: data });
  }
});
//TODO:
app.get("/users/log/:id", (req, res) => {
  // Logic to get user login history
  res.json({ message: `Login history for user ID: ${req.params.id}` });
});
//TEST:
app.post("/users/role/:id", (req, res) => {
  // Logic to assign a role to a user
  updateUser(req.params.id, {password:req.body.newrole}, store)
  res.json({ message: `Role assigned to user ID: ${req.params.id}` });
});
//TEST:
app.get("/users/role/:id", async (req, res) => {
  // Logic to get the role of a user
  const tmp = await loadUser(req.params.id, store);
  res.json({ message: `Role for user ID: ${req.params.id}`, role: tmp.data?.typeofuser });
});
//TODO:
app.post("/users/friends/request/:id", (req, res) => {
  // Logic to send a friend request
  res.json({ message: `Friend request sent to user ID: ${req.params.id}` });
});
//TODO:
app.get("/users/friends/", (req, res) => {
  // Logic to get the friends list of a user
  res.json({ message: `Friends list for user ID: ${req.params.id}` });
});
//TODO:
app.get("/users/friends/requests/:id", (req, res) => {
  // Logic to get pending friend requests for a user
  res.json({
    message: `Pending friend requests for user ID: ${req.params.id}`,
  });
});
//TODO:
app.post("/users/friends/accept/:id", (req, res) => {
  // Logic to accept a friend request
  res.json({
    message: `Friend request accepted for user ID: ${req.params.id}`,
  });
});
//TODO:
app.post("/users/friends/reject/:id", (req, res) => {
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
      message: "Missing user ID. Use /users/courses/:id or /users/courses?id=USER_ID",
    });
  }

  const tmp = await getEnrolledClasses(neo4jDriver, id);
  res.json({
    message: `Courses for user ID: ${id}`,
    classes: tmp
  });
});

//TEST:
app.get("/users/courses/:id", async (req, res) => {
  const id = req.params.id;
  const tmp = await getEnrolledClasses(neo4jDriver, id);
  res.json({
    message: `Courses for user ID: ${id}`,
    classes: tmp
  });
});

//TEST: upgrade: add course data and firends
app.get("/users/details/:id", async (req, res) => {
  const id = req.params.id;
  const tmp = await loadUser(id, store);
  const tmpClss = await getEnrolledClasses(neo4jDriver, id);
  // Logic to get user details
  res.json({ message: `User details for user ID: ${id}`, data: tmp.data, clases: tmpClss });
});

//login logout
//DONE:
app.get("/login", async (req, res) => {
  let msg = null;
  if (req.body.token) {
    //validate token on redis here
    const token = await RDclient.get(req.body.token);
    if (token && JSON.parse(token).login) {
      RDclient.expire(req.body.token, 60 * 60); // Refresh token expiration 1 hr
      msg = { success: true, message: `Token valid, welcome back!` };
    }
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
      }
    }
    //no hay lockout, validar login
    msg = await ValidateUser(req.body, store);

    //malas creds
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
        }),
        { EX: 60 * 60 },
      ); // Set token with expiration of 1 hour
      msg.token = token;
    }
  }
  res.json(msg);
});

//DONE:
app.get("/logout", (req, res) => {
  // Logic for user logout
  if (req.body.token) {
    //invalidate token on redis here
    RDclient.del(req.body.token);
    res.json({ success: true, message: "Logout successful" });
  } else {
    res.json({ success: false, message: "No token provided" });
  }
});

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
app.post("/courses/section/:id", async (req, res) => {
  const parentId = req.params.id;
  const { sectionId, description, isClassParent = true } = req.body;

  if (!sectionId || !description) {
    return res.status(400).json({ message: "Missing sectionId or description" });
  }

  await addSection(neo4jDriver, parentId, sectionId, description, isClassParent);
  res.json({ message: "Section added successfully", sectionId, parentId, isClassParent });
});
//DONE:
app.put("/courses/section/:id", async (req, res) => {
  const sectionId = req.params.id;
  const { description } = req.body;

  if (!description) {
    return res.status(400).json({ message: "Missing section description" });
  }

  await updateSection(neo4jDriver, sectionId, description);
  res.json({ message: "Section updated successfully", sectionId });
});
//DONE:
app.post("/courses/evaluation/:id", async (req, res) => {
  const classCode = req.params.id;
  const { evalId, name, type, content } = req.body;

  if (!evalId || !name || !type || content == null) {
    return res.status(400).json({ message: "Missing evaluation fields (evalId, name, type, content)" });
  }

  const normalizedContent = typeof content === "string" ? content : JSON.stringify(content);
  await addEvaluation(neo4jDriver, classCode, evalId, name, type, normalizedContent);
  res.json({ message: "Evaluation added successfully", classCode, evalId });
});
//TODO:
app.put("/courses/status/:id", (req, res) => {
  // Logic to update the status of a course
  res.json({
    message: `Course status updated for course ID: ${req.params.id}`,
  });
});
//DONE:
app.post("/courses/students/:id", async (req, res) => {
  const classCode = req.params.id;
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: "Missing studentId" });
  }

  await addStudent(neo4jDriver, classCode, studentId);
  res.json({ message: "Student added successfully", classCode, studentId });
});
//DONE:
app.get("/courses/students/:id", async (req, res) => {
  const classCode = req.params.id;
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
  res.json({
    message: `Courses created by user ${id}`,
    classes,
  });
});
//DONE:
app.post("/courses/clone/:id", async (req, res) => {
  const sourceClassCode = req.params.id;
  const newClassCode = req.body.newClassCode || `${sourceClassCode}-clone`;
  const creatorId = req.body.creatorId || req.body.id || null;

  if (!newClassCode) {
    return res.status(400).json({ message: "Missing newClassCode for cloned course" });
  }

  const cloned = await cloneClass(neo4jDriver, sourceClassCode, newClassCode, creatorId);
  res.json({ message: "Course cloned successfully", course: cloned });
});
//DONE:
app.get("/courses/:id", async (req, res) => {
  const classCode = req.params.id;
  const details = await getClassDetails(neo4jDriver, classCode);
  if (!details) {
    return res.status(404).json({ message: `Class not found: ${classCode}` });
  }
  res.json({ message: `Class details for ${classCode}`, details });
});
//DONE:
app.get("/courses", async (req, res) => {
  const classes = await getAllClasses(neo4jDriver);
  res.json({ message: "All available courses", classes });
});
//DONE:
app.post("/courses/enroll/:id", async (req, res) => {
  const classCode = req.params.id;
  const { studentId } = req.body;

  if (!studentId) {
    return res.status(400).json({ message: "Missing studentId" });
  }

  await addStudent(neo4jDriver, classCode, studentId);
  res.json({ message: "Student enrolled successfully", classCode, studentId });
});
//DONE:
app.get("/courses/enrolled", async (req, res) => {
  const studentId = req.query.id || req.body.id;
  if (!studentId) {
    return res.status(400).json({ message: "Missing student ID. Use /courses/enrolled?id=STUDENT_ID" });
  }

  const courses = await getEnrolledClasses(neo4jDriver, studentId);
  res.json({ message: `Courses enrolled by student ${studentId}`, courses });
});
//DONE:
app.get("/courses/evaluations/:id", async (req, res) => {
  const classCode = req.params.id;
  const evaluations = await getEvaluations(neo4jDriver, classCode);
  res.json({ message: `Evaluations for course ${classCode}`, evaluations });
});
//TODO:
app.post("/courses/submit/:id", (req, res) => {
  // Logic to submit an evaluation for a course
  res.json({ message: `Evaluation submitted for course ID: ${req.params.id}` });
});
//TODO:
app.get("/courses/grades/:id", (req, res) => {
  // Logic to get grades for a course
  res.json({ message: `Grades for course ID: ${req.params.id}` });
});

//messages
//TODO:
app.post("/messages/send/:id", (req, res) => {
  // Logic to send a message
  res.json({ message: "Message sent successfully" });
});
//TODO:
app.get("/messages/inbox/:id", (req, res) => {
  // Logic to get inbox messages for a user
  res.json({ message: `Inbox messages for user ID: ${req.params.id}` });
});
//TODO:
app.post("/messages/conversation/:id", (req, res) => {
  // Logic to start a new conversation
  res.json({
    message: `New conversation started for user ID: ${req.params.id}`,
  });
});

app.post("/test", async (req, res) => {
  await sendSampleData(neo4jDriver);
});

app.listen(PORT, async () => {
  console.log(`Server is running on port http://localhost:${PORT}`);

  store  = await RDBinitializeStore(
    process.env.RAVENDB_URL || "http://localhost:8080",
    process.env.RAVENDB_DB || "test",
  );
  console.log("RavenDB store initialized");

  RDclient = await RedisinitializeStore(
    process.env.REDIS_URL || "http://localhost:6379",
    process.env.REDIS_DB || "0",
  );
  console.log("Redis client initialized");

  neo4jDriver = connectToNeo4j(
    process.env.NEO4J_URL || "bolt://localhost:7687",
    // process.env.NEO4J_USER || "neo4j",
    // process.env.NEO4J_PASSWORD || "password"
  );
  console.log("Neo4j driver initialized");

  //await sendSampleData(neo4jDriver);
});
