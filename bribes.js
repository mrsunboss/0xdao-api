require("dotenv").config();
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const oxLensAbi = require("./abi/oxLens.json");
const bribeAbi = require("./abi/bribe.json");
const sanitize = require("./utils/sanitize.js");
const getPrices = require("./utils/prices.js");
const readData = require("./utils/readData.js");

const providerUrl =
  process.env.WEB3_PROVIDER_URL || "https://rpc.ankr.com/fantom";
const oxLensAddress = "0xDA00137c79B30bfE06d04733349d98Cf06320e69";
const solidlyLensAddress = "0xDA0024F99A9889E8F48930614c27Ba41DD447c45";

let web3, oxLens, solidlyLens, error, prices;

const bribes = async () => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  oxLens = new web3.eth.Contract(oxLensAbi, oxLensAddress);
  //   solidlyLens = new web3.eth.Contract(solidlyLensAbi, solidlyLensAddress);
  const oxPools = readData("pools");
  const newData = {};
  for (let i = 0; i < oxPools.length; i++) {
    const pool = oxPools[i];
    const bribeAddress = pool.poolData.bribeAddress;
    const bribe = new web3.eth.Contract(bribeAbi, bribeAddress);
    const bribeTokensAddresses = pool.poolData.bribeTokensAddresses;

    const bribes = [];
    const bribeTotal = new BigNumber(0);

    for (let c = 0; c < bribeTokensAddresses.length; c++) {
      const bribeTokenAddress = bribeTokensAddresses[c];
      const left = await bribe.methods.left(bribeTokenAddress).call();
      if (left !== "0") {
      }
    }
    newData[pool.id] = {
      oxPoolAddress: pool.id,
      solidPoolAddress: pool.poolData.id,
      bribeAddress,
      bribeTokensAddresses,
    };
  }

  return newData;
};

bribes();
