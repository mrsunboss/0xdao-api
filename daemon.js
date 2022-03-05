require("dotenv").config();
var Web3 = require("web3");
const oxLensAbi = require("./abi/oxLens.json");
const sanitize = require("./utils/sanitize.js");
const saveData = require("./utils/saveData.js");
// import solidlyLensAbi from "abi/solidlyLens.json"

const providerUrl =
  process.env.WEB3_PROVIDER_URL || "https://rpc.ankr.com/fantom";
const oxLensAddress = "0xDA00137c79B30bfE06d04733349d98Cf06320e69";

let web3, oxLens, error;

const setError = () => {
  error = true;
};

const fetchOxPools = async () => {
  const oxPoolsAddresses = await oxLens.methods
    .oxPoolsAddresses()
    .call()
    .catch(setError);
  const pageSize = 50;
  const poolsMap = {};
  let currentPage = 0;
  const addPools = (pools) => {
    pools.forEach((pool) => {
      poolsMap[pool.id] = pool;
    });
  };
  while (true) {
    const start = currentPage * pageSize;
    const end = start + pageSize;
    const addresses = oxPoolsAddresses.slice(start, end);
    if (addresses.length === 0) {
      break;
    }
    currentPage += 1;
    const poolsData = await oxLens.methods
      .oxPoolsData(addresses)
      .call()
      .catch(setError);
    addPools(poolsData);
  }
  let pools = Object.values(poolsMap);
  if (error) {
    console.log("Error reading oxPools");
    return;
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const sanitizedPools = sanitize(pools);
  const sanitizedPoolsWithTimestamp = sanitizedPools.map((pool) => {
    pool.updated = timestamp;
    return pool;
  });
  saveData("oxPools.json", sanitizedPoolsWithTimestamp);
  console.log(`Saved ${pools.length} pools`);
};

const main = async () => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  oxLens = new web3.eth.Contract(oxLensAbi, oxLensAddress);
  await fetchOxPools();
};

main();
