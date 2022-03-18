const fs = require("fs");

const readData = async (fileName) => {
  if(!fs.existsSync(`./data/${fileName}.json`)) {
    const emptyData = {}
    console.log("File not found");
    await fs.writeFileSync(`./data/${fileName}.json`, JSON.stringify(emptyData));
    return emptyData
  }
  else {
    const stringifiedData = fs.readFileSync(`./data/${fileName}.json`);
    return JSON.parse(stringifiedData);
  }
};

module.exports = readData;
