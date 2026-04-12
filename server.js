import express from 'express';
import dotenv from 'dotenv';
import redis from 'redis';
import ravendb  from 'ravendb';
import neo4j from 'neo4j-driver';
import mongodb from 'mongodb';

//funcioines externas
import { CreateUser,
         initializeStore ,
         searchUser
      } from './users.js';



dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  // Send a JSON response with a json
  res.json({  message: `Hello World! app is running in port: ${PORT}`,
              timestamp: new Date().toISOString(),
              methods: {users: ['POST /users/create', 'GET /users/reset:id', 'PUT /users/update/password/:id', 'GET /users/:id', 'GET /users', 'GET /users/log/:id', 'POST /users/role/:id', 'GET /users/role/:id', 'POST users/friends/request/:id', 'GET users/friends/', 'GET users/friends/requests/:id', 'POST users/friends/accept/:id', 'POST users/friends/reject/:id', 'GET users/courses/:id', 'GET users/details/:id'],
                        login: ['GET /login', 'GET /logout'],
                        courses: ['POST /courses/create', 'POST /courses/section/:id', 'PUT /courses/section/:id', 'POST /courses/evaluation/:id', 'PUT /courses/status/:id', 'GET /courses/students/:id', 'GET /courses/mine', 'POST /courses/clone/:id', 'GET /courses/:id', 'GET /courses', 'POST /courses/enroll/:id', 'GET /courses/enrolled', 'GET /courses/evaluations/:id', 'POST /courses/submit/:id', 'GET /courses/grades/:id'],
                        messages: ['POST /messages/send/:id', 'GET /messages/inbox/:id', 'POST /messages/conversation/:id']
                      }
   });
  // Send a plain text response

//startupo fucntion to check if all db are up and setup correctlly
});
app.post('/startup', async (req, res) => {
  await initializeStore(process.env.RAVENDB_URL, process.env.RAVENDB_DB);
  res.json({ message: 'Startup completed'});
});




//------------------------------------------------------------------------------------------------------------------------------------------------
// usuarios
app.get('/test', async (req, res) => {
    const data = await searchUser(req.body? req.body : null);
    res.json({ message: 'User search completed',
                data: data  
     });

});

app.post('/users/create', async (req, res) => {
  const data = await CreateUser(req.body);
  res.json({ message: 'User created successfully',
              data: data  
   });
});
app.get('/users/reset:id', (req, res) => { 
  // Logic to reset user password
  res.json({ message: 'Password reset successful' });
});
app.put('/users/update/password/:id', (req, res) => {
  // Logic to update user information
  res.json({ message: 'User updated successfully' });
});
app.get('/users/:id', (req, res) => {
  // Logic to get user details by ID
  res.json({ message: `User details for ID: ${req.params.id}` });
});
app.get('/users', (req, res) => {
  // Logic to get all users
  res.json({ message: 'List of all users' });
});
app.get('/users/log/:id', (req, res) => {
  // Logic to get user login history
  res.json({ message: `Login history for user ID: ${req.params.id}` });
});
app.post('/users/role/:id', (req, res) => {
  // Logic to assign a role to a user
  res.json({ message: `Role assigned to user ID: ${req.params.id}` });
});
app.get('/users/role/:id', (req, res) => {
  // Logic to get the role of a user
  res.json({ message: `Role for user ID: ${req.params.id}` });
});
app.post('users/friends/request/:id', (req, res) => {
  // Logic to send a friend request
  res.json({ message: `Friend request sent to user ID: ${req.params.id}` });
});
app.get('users/friends/', (req, res) => {
  // Logic to get the friends list of a user
  res.json({ message: `Friends list for user ID: ${req.params.id}` });
});
app.get('users/friends/requests/:id', (req, res) => {
  // Logic to get pending friend requests for a user
  res.json({ message: `Pending friend requests for user ID: ${req.params.id}` });
});
app.post('users/friends/accept/:id', (req, res) => {
  // Logic to accept a friend request
  res.json({ message: `Friend request accepted for user ID: ${req.params.id}` });
});
app.post('users/friends/reject/:id', (req, res) => {
  // Logic to reject a friend request
  res.json({ message: `Friend request rejected for user ID: ${req.params.id}` });
});
app.get('users/courses/:id', (req, res) => {
  // Logic to get courses for a user
  res.json({ message: `Courses for user ID: ${req.params.id}` });
});
app.get('users/details/:id', (req, res) => {
  // Logic to get user details
  res.json({ message: `User details for user ID: ${req.params.id}` });
});

//login logout
app.get('/login', (req, res) => {
  // Logic for user login, intentos fallidos y bloqueo de cuenta 
  res.json({ message: 'Login successful' });
});
app.get('/logout', (req, res) => {  // Logic for user logout
  res.json({ message: 'Logout successful' });
});



// cursos
app.post('/courses/create', (req, res) => {
  // Logic to create a new course
  res.json({ message: 'Course created successfully' });
});
app.post('/courses/section/:id', (req, res) => {
  // Logic to add a new section to a course
  res.json({ message: `Section added to course ID: ${req.params.id}` });
});
app.put('/courses/section/:id', (req, res) => {
  // Logic to update a section in a course
  res.json({ message: `Section updated in course ID: ${req.params.id}` });
});
app.post('/courses/evaluation/:id', (req, res) => {
  // Logic to add a new evaluation to a course
  res.json({ message: `Evaluation added to course ID: ${req.params.id}` });
});
app.put('/courses/status/:id', (req, res) => {
  // Logic to update the status of a course
  res.json({ message: `Course status updated for course ID: ${req.params.id}` });
});
app.get('/courses/students/:id', (req, res) => {
  // Logic to get students enrolled in a course
  res.json({ message: `Students enrolled in course ID: ${req.params.id}` });
});
app.get('/courses/mine', (req, res) => {
  // Logic to get courses created by the logged-in user
  res.json({ message: 'List of courses created by the logged-in user' });
});
app.post('/courses/clone/:id', (req, res) => {
  // Logic to clone a course
  res.json({ message: `Course cloned from course ID: ${req.params.id}` });
});
app.get('/courses/:id', (req, res) => {
  // Logic to get course details by ID
  res.json({ message: `Course details for ID: ${req.params.id}` });
});
app.get('/courses', (req, res) => {
  // Logic to get all courses
  res.json({ message: 'List of all courses' });
});
app.post('/courses/enroll/:id', (req, res) => {
  // Logic to enroll a student in a course
  res.json({ message: `Enrolled in course ID: ${req.params.id}` });
});
app.get('/courses/enrolled', (req, res) => {
  // Logic to get courses the logged-in user is enrolled in
  res.json({ message: 'List of courses the logged-in user is enrolled in' });
});
app.get('/courses/evaluations/:id', (req, res) => {
  // Logic to get evaluations for a course
  res.json({ message: `Evaluations for course ID: ${req.params.id}` });
});
app.post('/courses/submit/:id', (req, res) => {
  // Logic to submit an evaluation for a course
  res.json({ message: `Evaluation submitted for course ID: ${req.params.id}` });
});
app.get('/courses/grades/:id', (req, res) => {
  // Logic to get grades for a course
  res.json({ message: `Grades for course ID: ${req.params.id}` });
});





//messages
app.post('/messages/send/:id', (req, res) => {
  // Logic to send a message
  res.json({ message: 'Message sent successfully' });
});
app.get('/messages/inbox/:id', (req, res) => {
  // Logic to get inbox messages for a user
  res.json({ message: `Inbox messages for user ID: ${req.params.id}` });
});
app.post('/messages/conversation/:id', (req, res) => {
  // Logic to start a new conversation
  res.json({ message: `New conversation started for user ID: ${req.params.id}` });
});




app.listen(PORT, async () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
  await initializeStore(process.env.RAVENDB_URL, process.env.RAVENDB_DB);
});