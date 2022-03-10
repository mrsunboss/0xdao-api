require("dotenv").config();
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const oxLensAbi = require("./abi/oxLens.json");
const solidlyLensAbi = require("./abi/solidlyLens.json");
const erc20Abi = require("./abi/erc20.json");
const gaugeAbi = require("./abi/gauge.json");
const bribeAbi = require("./abi/bribe.json");
const veAbi = require("./abi/ve.json");
const routerAbi = require("./abi/router.json");
const sanitize = require("./utils/sanitize.js");
const getPrices = require("./utils/prices.js");
const saveData = require("./utils/saveData.js");
const readData = require("./utils/readData.js");
const stakingRewardsData = require("./utils/stakingRewards.js");
const { setFlagsFromString } = require("v8");

const providerUrl =
  process.env.WEB3_PROVIDER_URL || "https://rpc.ankr.com/fantom";
const oxLensAddress = "0xDA00137c79B30bfE06d04733349d98Cf06320e69";
const solidlyLensAddress = "0xDA0024F99A9889E8F48930614c27Ba41DD447c45";
const routerAddress = "0xa38cd27185a464914D3046f0AB9d43356B34829D";

let web3, oxLens, solidlyLens, error;

const setError = () => {
  error = true;
};

const topLevelData = async (pools) => {
  const veAddress = "0xcBd8fEa77c2452255f59743f55A3Ea9d83b3c72b";
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  oxLens = new web3.eth.Contract(oxLensAbi, oxLensAddress);
  solidlyLens = new web3.eth.Contract(solidlyLensAbi, solidlyLensAddress);
  const router = new web3.eth.Contract(routerAbi, routerAddress);
  const ve = new web3.eth.Contract(veAbi, veAddress);

  const vlOxdAddress = "0xDA00527EDAabCe6F97D89aDb10395f719E5559b9";
  const oxdAddress = "0xc5A9848b9d145965d821AaeC8fA32aaEE026492d";
  const wftmAddress = "0x21be370d5312f44cb42ce377bc9b8a0cef1a4c83";
  const usdcAddress = "0x04068da6c83afcfa0e13ba15a6696662335d5b75";
  const solidAddress = "0x888ef71766ca594ded1f0fa3ae64ed2941740a20";
  const oxSolidAddress = "0xDA0053F0bEfCbcaC208A3f867BB243716734D809";
  const oxd = new web3.eth.Contract(erc20Abi, oxdAddress);

  const lockedOxd = new BigNumber(
    await oxd.methods.balanceOf(vlOxdAddress).call()
  )
    .div(10 ** 18)
    .toFixed();

  const oxdTotalSupply = new BigNumber(await oxd.methods.totalSupply().call())
    .div(10 ** 18)
    .toFixed();

  const oxdPrice = new BigNumber(
    (
      await router.methods
        .getAmountsOut("1000000000000000000", [
          [oxdAddress, wftmAddress, false],
          [wftmAddress, usdcAddress, false],
        ])
        .call()
    )[2]
  )
    .div(10 ** 6)
    .toFixed();

  const oxdMarketCap = new BigNumber(oxdTotalSupply).times(oxdPrice).toFixed();

  const oxSolidPrice = new BigNumber(
    (
      await router.methods
        .getAmountsOut("1000000000000000000", [
          [oxSolidAddress, solidAddress, false],
          [solidAddress, wftmAddress, false],
          [wftmAddress, usdcAddress, false],
        ])
        .call()
    )[3]
  )
    .div(10 ** 6)
    .toFixed();

  const solidPrice = new BigNumber(
    (
      await router.methods
        .getAmountsOut("1000000000000000000", [
          [solidAddress, wftmAddress, false],
          [wftmAddress, usdcAddress, false],
        ])
        .call()
    )[2]
  )
    .div(10 ** 6)
    .toFixed();

  const lockedSolid = new BigNumber((await ve.methods.locked(2).call()).amount)
    .div(10 ** 18)
    .toFixed();

  let poolsTvl = new BigNumber(0);
  pools.forEach((pool) => {
    poolsTvl = poolsTvl.plus(isNaN(pool.totalTvlUsd) ? 0 : pool.totalTvlUsd);
  });
  poolsTvl = poolsTvl.toFixed();
  const lockedSolidTvl = new BigNumber(lockedSolid).times(solidPrice).toFixed();
  const totalTvl = new BigNumber(poolsTvl).plus(lockedSolidTvl).toFixed();

  const lockedOxdRatio = new BigNumber(lockedOxd).div(oxdTotalSupply).toFixed();

  const data = {
    oxdPrice,
    oxSolidPrice,
    lockedSolid,
    lockedSolidTvl,
    lockedOxd,
    lockedOxdRatio,
    solidPrice,
    oxdTotalSupply,
    oxdMarketCap,
    poolsTvl,
    totalTvl,
  };
  console.log(data);
  return data;
};

module.exports = topLevelData;
