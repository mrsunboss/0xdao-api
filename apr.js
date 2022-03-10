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

let web3;

const getPrice = (tokenAddress) => {
  if (tokenAddress === oxdAddress) {
    return protocol.oxdPrice;
  } else if (tokenAddress === solidAddress) {
    return protocol.solidPrice;
  }
  return 0;
};

const getApr = async (pool) => {
  const poolPrice = pool.poolPrice;
  const staking = new web3.eth.Contract(erc20Abi, pool.stakingAddress);
  const totalSupply = await staking.methods.totalSupply().call();
  console.log("Pool", pool);
  pool.rewardTokens.forEach((token) => {
    const rewardRate = token.rewardRate;
    const tokenPrice = getPrice(token.id);
    const apr = new BigNumber(secondsPerYear)
      .times(rewardRate)
      .times(tokenPrice)
      .div(
        new BigNumber(poolPrice)
          .div(10 ** 18)
          .times(new BigNumber(totalSupply).div(10 ** 18))
          .times(tokenPrice)
      );
    console.log("APR", apr.toFixed());
    return apr.toFixed();
  });
};

const injectApr = async (pools) => {
  const newPools = pools;
  for (let poolIndex = 0; poolIndex < pools.length; poolIndex++) {
    const pool = pools[poolIndex];
    newPools[poolIndex].apr = await getApr(pool);
  }
  return newPools;
};

const setup = () => {};

const calculateApr = async () => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  protocol = readData("protocol");
  const pools = readData("oxPools");
  const poolsWithApr = await injectApr(pools);
  console.log("zz", poolsWithApr);
  return poolsWithApr;
};

calculateApr();
