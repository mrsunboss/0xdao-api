const fs = require("fs");

const readData = (fileName) => {
  const stringifiedData = fs.readFileSync(`./data/${fileName}.json`);
  return JSON.parse(stringifiedData);
};

module.exports = readData;
