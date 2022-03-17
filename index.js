require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
app.use(cors());
const port = process.env.PORT || 8080;
const readData = require("./utils/readData.js");

app.get("/pools", (req, res) => {
  const data = readData("pools");
  res.send(data);
});

app.get("/protocol", (req, res) => {
  const data = readData("protocol");
  res.send(data);
});

app.get("/bribes", (req, res) => {
  const data = readData("bribes");
  res.send(data);
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
