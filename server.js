import express from 'express';
import dotenv from 'dotenv';
dotenv.config();

const PORT = process.env.PORT || 3000;
const app = express();

app.get('/', (req, res) => {
  // Send a JSON response with a json
  res.json({ message: `Hello World! app is running in port: ${PORT}` });

  // Send a plain text response
  // res.send(`Hello World! app is running in port: ${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});