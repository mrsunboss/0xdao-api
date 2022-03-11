require("dotenv").config();
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const erc20Abi = require("./abi/erc20.json");
const readData = require("./utils/readData.js");
const secondsPerYear = 31622400;

const providerUrl =
  process.env.WEB3_PROVIDER_URL || "https://rpc.ankr.com/fantom";

const oxdAddress = "0xc5A9848b9d145965d821AaeC8fA32aaEE026492d";
const solidAddress = "0x888EF71766ca594DED1F0FA3AE64eD2941740A20";
let web3, totalWeight, weightsByPool;

const getPrice = (tokenAddress) => {
  if (tokenAddress === oxdAddress) {
    return protocol.oxdPrice;
  } else if (tokenAddress === solidAddress) {
    return protocol.solidPrice;
  }
  return 0;
};

const getApr = (pool) => {
  console.log(pool.poolData.symbol, `(${pool.id})`);
  let totalApr = new BigNumber(0);

  if (pool.totalTvlUsd === "0") {
    pool.totalApr = "N/A";
    pool.oxdApr = "N/A";
    pool.solidApr = "N/A";
    return pool;
  }

  pool.rewardTokens.forEach((token) => {
    const rewardRate = token.rewardRate;

    const tokenPrice = getPrice(token.id);
    const valuePerYear = new BigNumber(secondsPerYear)
      .times(rewardRate)
      .times(tokenPrice)
      .div(10 ** 18);

    const apr = new BigNumber(valuePerYear)
      .div(pool.totalTvlUsd)
      .times(100)
      .toFixed(2);
    console.log("rewards $", valuePerYear.toFixed());
    console.log("APR", apr);
    if (token.id === solidAddress) {
      pool.aprSolid = apr;
    } else if (token.id === oxdAddress) {
      pool.aprOxd = apr;
    }
    totalApr = totalApr.plus(apr);
  });
  totalApr = totalApr.toFixed(2);
  if (
    pool.id === "0x12EE63e73d6BC0327439cdF700ab40849e8e4284" ||
    pool.id === "0xAf059909235c8F8168bE38cB86717134B9050384" ||
    pool.id === "0xA3668B13D1064E79B6fFA438f28a3665Bb41D8eF" ||
    pool.id === "0x8F42e0cd7176Ef472E402Bab0e4bca234a3693C3"
  ) {
    pool.aprSolid = "N/A";
    pool.aprOxd = "N/A";
    pool.totalApr = "N/A";
  }
  pool.totalApr = totalApr;
  console.log("TVL", pool.totalTvlUsd);
  console.log("Total APR", totalApr);
  console.log("price0", prices[pool.poolData.token0Address.toLowerCase()]);
  console.log("price1", prices[pool.poolData.token1Address.toLowerCase()]);
  console.log();
  return pool;
};

const injectApr = async (pools) => {
  protocol = readData("protocol");
  prices = readData("prices");
  const newPools = pools.map((pool) => getApr(pool));
  return newPools;
};

const calculateApr = async () => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  prices = readData("prices");
  protocol = readData("protocol");
  const pools = readData("oxPools");
  const poolsWithApr = await injectApr(pools, protocol);
  console.log(poolsWithApr);
  return poolsWithApr;
};

// calculateApr();

module.exports = injectApr;
