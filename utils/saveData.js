const fs = require("fs");

const saveData = (fileName, data) => {
  const jsonData = JSON.stringify(data);
  fs.writeFileSync(`./data/${fileName}`, jsonData);
};

module.exports = saveData;
