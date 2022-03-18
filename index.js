require("dotenv").config();
const cors = require("cors");
const express = require("express");
const app = express();
app.use(cors());
const port = process.env.PORT || 8080;
const readData = require("./utils/readData.js");

app.get("/pools", async(req, res) => {
  const data = await readData("pools");
  res.send(data);
});

app.get("/protocol",async (req, res) => {
  const data = await readData("protocol");
  res.send(data);
});

app.get("/bribes", async(req, res) => {
  const data = await readData("bribes");
  res.send(data);
});

app.listen(port, () => {
  console.log(`Server started on port ${port}`);
});
