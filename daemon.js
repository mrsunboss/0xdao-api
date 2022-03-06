require("dotenv").config();
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const oxLensAbi = require("./abi/oxLens.json");
const solidlyLensAbi = require("./abi/solidlyLens.json");
const sanitize = require("./utils/sanitize.js");
const getPrices = require("./utils/prices.js");
const saveData = require("./utils/saveData.js");
const stakingRewardsData = require("./utils/stakingRewards.js");

const providerUrl =
  process.env.WEB3_PROVIDER_URL || "https://rpc.ankr.com/fantom";
const oxLensAddress = "0xDA00137c79B30bfE06d04733349d98Cf06320e69";
const solidlyLensAddress = "0xDA0024F99A9889E8F48930614c27Ba41DD447c45";

let web3, oxLens, solidlyLens, error, prices;

const setError = () => {
  error = true;
};

const injectTimestamp = (pools) => {
  const timestamp = Math.floor(Date.now() / 1000);
  return pools.map((pool) => {
    pool.updated = timestamp;
    return pool;
  });
};

const injectTvl = (pools) =>
  pools.map((pool) => {
    const newPool = pool;
    const poolData = pool.poolData;
    const price0Object = prices[poolData.token0Address.toLowerCase()];
    const price0 = price0Object ? price0Object.usd : 0;
    const price1Object = prices[poolData.token1Address.toLowerCase()];
    const price1 = price1Object ? price1Object.usd : 0;
    const reserve0Normalized = new BigNumber(poolData.token0Reserve)
      .div(10 ** poolData.token0Decimals)
      .toFixed();
    const reserve1Normalized = new BigNumber(poolData.token1Reserve)
      .div(10 ** poolData.token1Decimals)
      .toFixed();
    const reserve0Usd = new BigNumber(reserve0Normalized)
      .times(price0)
      .toFixed();
    const reserve1Usd = new BigNumber(reserve1Normalized)
      .times(price1)
      .toFixed();
    const totalTvlUsd = new BigNumber(reserve0Usd).plus(reserve1Usd).toFixed();
    newPool.poolData = {
      ...pool.poolData,
      reserve0Normalized,
      reserve1Normalized,
      reserve0Usd,
      reserve1Usd,
      price0Usd: price0,
      price1Usd: price1,
      totalTvlUsd,
    };

    const tvlUsd = new BigNumber(pool.totalSupply)
      .times(totalTvlUsd)
      .div(pool.poolData.totalSupply);
    newPool.totalTvlUsd = tvlUsd.toFixed();
    return newPool;
  });

const injectApy = (pools) =>
  pools.map((pool) => {
    const poolPrice = new BigNumber(pool.totalTvlUsd).div(
      new BigNumber(pool.poolData.totalSupply).div(10 ** 18)
    );
    return {
      ...pool,
    };
  });

const getTokensAddresses = (pools) => {
  const tokensMapping = {};
  pools.forEach((pool) => {
    tokensMapping[pool.poolData.token0Address] = true;
    tokensMapping[pool.poolData.token1Address] = true;
    pool.poolData.bribeTokensAddresses.forEach((bribeTokenAddress) => {
      tokensMapping[bribeTokenAddress] = true;
    });
  });
  return Object.keys(tokensMapping);
};

const setPrices = async (pools) => {
  const tokensAddresses = getTokensAddresses(pools);
  prices = await getPrices(tokensAddresses);
};

const fetchOxPools = async () => {
  const oxPoolsAddresses = await oxLens.methods
    .oxPoolsAddresses()
    .call()
    .catch(setError);
  const pageSize = 50;
  const poolsMap = {};
  let currentPage = 0;
  const addPools = (pools, reservesData, stakingData) => {
    pools.forEach((pool, index) => {
      const solidlyPoolAddress = pool.poolData.id;
      const reserveData = reservesData.find(
        (data) => data.id === solidlyPoolAddress
      );
      const newPool = pool;
      newPool.poolData = {
        ...pool.poolData,
        ...reserveData,
      };
      newPool.rewardTokens = stakingData[index];
      poolsMap[pool.id] = newPool;
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

    const solidlyPoolsAddresses = poolsData.map((pool) => pool.poolData.id);
    const reservesData = await solidlyLens.methods
      .poolsReservesInfo(solidlyPoolsAddresses)
      .call()
      .catch(setError);

    const stakingAddresses = poolsData.map((pool) => pool.stakingAddress);
    const stakingData = await oxLens.methods
      .rewardTokensDatas(stakingAddresses)
      .call()
      .catch(setError);

    addPools(
      sanitize(poolsData),
      sanitize(reservesData),
      sanitize(stakingData)
    );
  }
  let pools = Object.values(poolsMap);
  if (error) {
    console.log("Error reading oxPools");
    return;
  }
  await setPrices(pools);
  const poolsWithTimestamp = injectTimestamp(pools);
  const poolsWithTimestampAndTvl = injectTvl(poolsWithTimestamp);
  const poolsWithTimestampTvlAndApy = injectApy(poolsWithTimestampAndTvl);

  let totalTvl = new BigNumber(0);
  poolsWithTimestampAndTvl.forEach((pool) => {
    totalTvl = totalTvl.plus(isNaN(pool.totalTvlUsd) ? 0 : pool.totalTvlUsd);
  });

  saveData("oxPools.json", poolsWithTimestampTvlAndApy);
  console.log(`Saved ${pools.length} pools`);
  console.log("Total TVL:", totalTvl.toFixed());

  return poolsWithTimestampTvlAndApy;
};

const main = async () => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  oxLens = new web3.eth.Contract(oxLensAbi, oxLensAddress);
  solidlyLens = new web3.eth.Contract(solidlyLensAbi, solidlyLensAddress);

  //   const oxSolidRewardsPoolAddress =
  //     "0xDA0067ec0925eBD6D583553139587522310Bec60";
  //   await stakingRewardsData(oxLens, [oxSolidRewardsPoolAddress]);
  const pools = await fetchOxPools();
};

main();
