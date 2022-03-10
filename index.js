require("dotenv").config();
const express = require("express");
const app = express();
const port = process.env.PORT || 8080;
const readData = require("./utils/readData.js");

app.get("/pools", (req, res) => {
  const data = readData("oxPools");
  res.send(data);
});

app.get("/protocol", (req, res) => {
  const data = readData("protocol");
  res.send(data);
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
