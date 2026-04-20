import express, { json } from "express";
import dotenv from "dotenv";
import crypto from "crypto";

//funcioines externas
import {
  CreateUser,
  RDBinitializeStore,
  searchUser,
  searchUserById,
  ValidateUser,
  getUser,
  updateUserPassword,
  loadUser
} from "./users.js";
import { RedisinitializeStore } from "./redisStore.js";
import { get } from "http";

dotenv.config();
//constantes de cleintes de acceso de BD para reciclarlos segun se necesite
let store = null;
let RDclient = null;

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

//DONEs: password reset
app.post("/users/reset", async (req, res) => {
  let tmp = await getUser(req.body.username, store);
    if (!tmp) {
      return res.json({ success: false, message: "User not found" });
    }
  tmp = await loadUser(tmp.data.id, store);
  const tmppass = crypto.createHash("sha256").update(req.body.username + new Date()).digest("hex").slice(0, 8);

  await updateUserPassword(tmp.data.id, tmppass, store);

  const result = await loadUser(req.body.username, store);
  RDclient.del(tmp.data.id); // Invalidate any existing sessions for the user
  
  res.json({ message: "Password reset successful, you temporal pass word is ", temporaryPassword: tmppass });
});
//TODO:

app.put("/users/update/password/:id", (req, res) => {
    updateUserPassword(req.params.id, req.body.newpassword, store);
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
-(
  //TODO:
  app.get("/users/log/:id", (req, res) => {
    // Logic to get user login history
    res.json({ message: `Login history for user ID: ${req.params.id}` });
  })
);
//TODO:
app.post("/users/role/:id", (req, res) => {
  // Logic to assign a role to a user
  res.json({ message: `Role assigned to user ID: ${req.params.id}` });
});
//TODO:
app.get("/users/role/:id", (req, res) => {
  // Logic to get the role of a user
  res.json({ message: `Role for user ID: ${req.params.id}` });
});
//TODO:
app.post("users/friends/request/:id", (req, res) => {
  // Logic to send a friend request
  res.json({ message: `Friend request sent to user ID: ${req.params.id}` });
});
//TODO:
app.get("users/friends/", (req, res) => {
  // Logic to get the friends list of a user
  res.json({ message: `Friends list for user ID: ${req.params.id}` });
});
//TODO:
app.get("users/friends/requests/:id", (req, res) => {
  // Logic to get pending friend requests for a user
  res.json({
    message: `Pending friend requests for user ID: ${req.params.id}`,
  });
});
//TODO:
app.post("users/friends/accept/:id", (req, res) => {
  // Logic to accept a friend request
  res.json({
    message: `Friend request accepted for user ID: ${req.params.id}`,
  });
});
//TODO:
app.post("users/friends/reject/:id", (req, res) => {
  // Logic to reject a friend request
  res.json({
    message: `Friend request rejected for user ID: ${req.params.id}`,
  });
});
//TODO:
app.get("users/courses/:id", (req, res) => {
  // Logic to get courses for a user
  res.json({ message: `Courses for user ID: ${req.params.id}` });
});
//TODO:
app.get("users/details/:id", (req, res) => {
  // Logic to get user details
  res.json({ message: `User details for user ID: ${req.params.id}` });
});
//TODO:

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
//TODO:
app.post("/courses/create", (req, res) => {
  // Logic to create a new course
  res.json({ message: "Course created successfully" });
});
//TODO:
app.post("/courses/section/:id", (req, res) => {
  // Logic to add a new section to a course
  res.json({ message: `Section added to course ID: ${req.params.id}` });
});
//TODO:
app.put("/courses/section/:id", (req, res) => {
  // Logic to update a section in a course
  res.json({ message: `Section updated in course ID: ${req.params.id}` });
});
//TODO:
app.post("/courses/evaluation/:id", (req, res) => {
  // Logic to add a new evaluation to a course
  res.json({ message: `Evaluation added to course ID: ${req.params.id}` });
});
//TODO:
app.put("/courses/status/:id", (req, res) => {
  // Logic to update the status of a course
  res.json({
    message: `Course status updated for course ID: ${req.params.id}`,
  });
});
//TODO:
app.get("/courses/students/:id", (req, res) => {
  // Logic to get students enrolled in a course
  res.json({ message: `Students enrolled in course ID: ${req.params.id}` });
});
//TODO:
app.get("/courses/mine", (req, res) => {
  // Logic to get courses created by the logged-in user
  res.json({ message: "List of courses created by the logged-in user" });
});
//TODO:
app.post("/courses/clone/:id", (req, res) => {
  // Logic to clone a course
  res.json({ message: `Course cloned from course ID: ${req.params.id}` });
});
//TODO:
app.get("/courses/:id", (req, res) => {
  // Logic to get course details by ID
  res.json({ message: `Course details for ID: ${req.params.id}` });
});
//TODO:
app.get("/courses", (req, res) => {
  // Logic to get all courses
  res.json({ message: "List of all courses" });
});
//TODO:
app.post("/courses/enroll/:id", (req, res) => {
  // Logic to enroll a student in a course
  res.json({ message: `Enrolled in course ID: ${req.params.id}` });
});
//TODO:
app.get("/courses/enrolled", (req, res) => {
  // Logic to get courses the logged-in user is enrolled in
  res.json({ message: "List of courses the logged-in user is enrolled in" });
});
//TODO:
app.get("/courses/evaluations/:id", (req, res) => {
  // Logic to get evaluations for a course
  res.json({ message: `Evaluations for course ID: ${req.params.id}` });
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
  const data = { msg: "This is a test value", timestamp: new Date() };
  const json = JSON.stringify(data);
  RDclient.set("test", JSON.stringify(data));
  const value = await RDclient.get("test");
  res.json({ message: "Test completed successfully", data: JSON.parse(value) });
});

app.listen(PORT, async () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
  let tmp = await RDBinitializeStore(
    process.env.RAVENDB_URL || "http://localhost:8080",
    process.env.RAVENDB_DB || "test",
  );
  store = tmp;
  console.log("RavenDB store initialized");
  tmp = await RedisinitializeStore(
    process.env.REDIS_URL || "http://localhost:6379",
    process.env.REDIS_DB || "0",
  );
  RDclient = tmp;
  console.log("Redis client initialized");
});
