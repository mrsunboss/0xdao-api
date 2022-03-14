require("dotenv").config();
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const erc20Abi = require("./abi/erc20.json");
const readData = require("./utils/readData.js");

const providerUrl =
  process.env.WEB3_PROVIDER_URL || "https://rpc.ankr.com/fantom";

let web3;

const fees = async () => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  prices = readData("prices");
  const oxPools = readData("oxPools");
  let totalFees = new BigNumber(0);
  const fees = [];
  for (let i = 0; i < oxPools.length; i++) {
    const pool = oxPools[i];
    const feeAddress = pool.poolData.fees;
    const token0 = new web3.eth.Contract(erc20Abi, pool.poolData.token0Address);
    const token1 = new web3.eth.Contract(erc20Abi, pool.poolData.token1Address);
    const token0Balance = new BigNumber(
      await token0.methods.balanceOf(feeAddress).call()
    )
      .div(10 ** pool.poolData.token0Decimals)
      .toFixed();
    const token1Balance = new BigNumber(
      await token1.methods.balanceOf(feeAddress).call()
    )
      .div(10 ** pool.poolData.token1Decimals)
      .toFixed();
    const price0 =
      (prices[pool.poolData.token0Address.toLowerCase()] &&
        prices[pool.poolData.token0Address.toLowerCase()].usd) ||
      0;
    const price1 =
      (prices[pool.poolData.token1Address.toLowerCase()] &&
        prices[pool.poolData.token1Address.toLowerCase()].usd) ||
      0;

    const token0FeeValue = new BigNumber(token0Balance).times(price0).toFixed();
    const token1FeeeValue = new BigNumber(token1Balance)
      .times(price1)
      .toFixed();
    const feeTotal = new BigNumber(token0FeeValue)
      .plus(token1FeeeValue)
      .toFixed(0);
    totalFees = totalFees.plus(feeTotal);
    const feeObject = {
      poolAddress: pool.poolData.id,
      fee: feeTotal,
    };
    console.log(feeObject);
    fees.push(feeObject);
  }

  const sortedFees = fees.sort((a, b) => {
    return b.fee - a.fee;
  });
  console.log(sortedFees);
  console.log("total fees:", totalFees.toFixed());
  return sortedFees;
};

module.exports = fees;
