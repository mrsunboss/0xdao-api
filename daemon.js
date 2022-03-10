require("dotenv").config();
const Web3 = require("web3");
const BigNumber = require("bignumber.js");
const oxLensAbi = require("./abi/oxLens.json");
const solidlyLensAbi = require("./abi/solidlyLens.json");
const erc20Abi = require("./abi/erc20.json");
const gaugeAbi = require("./abi/gauge.json");
const bribeAbi = require("./abi/bribe.json");
const sanitize = require("./utils/sanitize.js");
const getPrices = require("./utils/prices.js");
const saveData = require("./utils/saveData.js");
const readData = require("./utils/readData.js");
const stakingRewardsData = require("./utils/stakingRewards.js");
const { setFlagsFromString } = require("v8");

const topLevelData = require("./daemon_overview.js");

const oxDaoVoter = "0xDA0027f2368bA3cb65a494B1fc7EA7Fd05AB42DD";
const solidexVoter = "0x26E1A0d851CF28E697870e1b7F053B605C8b060F";
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

    let poolPrice = new BigNumber(newPool.totalTvlUsd)
      .div(new BigNumber(pool.totalSupply).div(10 ** 18))
      .toFixed();
    if (isNaN(poolPrice)) {
      poolPrice = "0";
    }
    newPool.poolPrice = poolPrice;

    return newPool;
  });

const injectBoost = async (pools) => {
  await Promise.all(
    pools.map(async (pool) => {
      const gauge = new web3.eth.Contract(gaugeAbi, pool.poolData.gaugeAddress);
      const balanceOfOxDao = await gauge.methods.balanceOf(oxDaoVoter).call();
      const balanceOfSolidex = await gauge.methods
        .balanceOf(solidexVoter)
        .call();
      const derivedBalanceOfOxDao = await gauge.methods
        .derivedBalance(oxDaoVoter)
        .call();
      const derivedBalanceOfSolidex = await gauge.methods
        .derivedBalance(solidexVoter)
        .call();
      let solidexBoost =
        2.5 *
        (1 /
          new BigNumber(balanceOfSolidex)
            .div(derivedBalanceOfSolidex)
            .toNumber());
      if (isNaN(solidexBoost)) {
        solidexBoost = 0;
      }

      let oxDaoBoost =
        2.5 *
        (1 /
          new BigNumber(balanceOfOxDao).div(derivedBalanceOfOxDao).toNumber());
      if (isNaN(oxDaoBoost)) {
        oxDaoBoost = 0;
      }
      if (isNaN(solidexBoost)) {
        solidexBoost = 0;
      }
      if (oxDaoBoost === 0) {
        oxDaoBoost = 2.5;
      }
      if (solidexBoost === 0) {
        solidexBoost = 2.5;
      }

      pool.boostOxDao = oxDaoBoost;
      pool.boostSolidex = solidexBoost;
      return pool;
    })
  );
  return pools;
};

const injectApy = async (pools) =>
  pools.forEach(async (pool) => {
    const poolPrice = pool.poolPrice;
    const staking = new web3.eth.Contract(erc20Abi, pool.stakingAddress);
    const totalSupply = await staking.methods.totalSupply().call();
    pool.rewardTokens.forEach((token) => {
      const rewardRate = token.rewardRate;
      const secondsPerYear = 31622400;
      const priceObj = prices[token.id.toLowerCase()];
      const tokenPrice = priceObj ? priceObj.usd : 0;
      const apr = new BigNumber(secondsPerYear)
        .times(rewardRate)
        .times(tokenPrice)
        .div(
          new BigNumber(poolPrice)
            .div(10 ** 18)
            .times(new BigNumber(totalSupply).div(10 ** 18))
            .times(tokenPrice)
        );
      console.log(apr.toFixed());
    });

    return pools;
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
    .catch((err) => {
      setError;
      console.log("dog", err);
    });
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
  //   const poolsWithTimestampTvlAndApy = await injectApy(poolsWithTimestampAndTvl);
  const poolsWithTimestampTvlApyAndBoost = await injectBoost(
    poolsWithTimestampAndTvl
  );

  let totalTvl = new BigNumber(0);
  poolsWithTimestampAndTvl.forEach((pool) => {
    totalTvl = totalTvl.plus(isNaN(pool.totalTvlUsd) ? 0 : pool.totalTvlUsd);
  });

  const tld = await topLevelData(poolsWithTimestampTvlApyAndBoost);

  saveData("oxPools.json", poolsWithTimestampTvlApyAndBoost);
  saveData("protocol.json", tld);
  console.log(`Saved ${pools.length} pools`);
  console.log("Total TVL:", totalTvl.toFixed());

  const sortedTvl = poolsWithTimestampTvlApyAndBoost.sort((a, b) => {
    console.log(a.totalTvlUsd);
    return new BigNumber(b.totalTvlUsd).gt(a.totalTvlUsd);
  });

  console.log(JSON.stringify(sortedTvl, null, 2));
  return poolsWithTimestampTvlApyAndBoost;
};

const bribes = async (oxPools) => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  const newData = {};
  for (let i = 0; i < oxPools.length; i++) {
    const pool = oxPools[i];
    const bribeAddress = pool.poolData.bribeAddress;
    const bribe = new web3.eth.Contract(bribeAbi, bribeAddress);
    const bribeTokensAddresses = pool.poolData.bribeTokensAddresses;

    const bribes = [];
    let bribeTotalUsd = new BigNumber(0);

    for (let c = 0; c < bribeTokensAddresses.length; c++) {
      const bribeTokenAddress = bribeTokensAddresses[c];
      const left = await bribe.methods.left(bribeTokenAddress).call();
      if (left !== "0") {
        const bribeToken = new web3.eth.Contract(erc20Abi, bribeTokenAddress);
        const decimals = await bribeToken.methods.decimals().call();
        const priceObject = prices[bribeTokenAddress.toLowerCase()];
        const price = (priceObject && priceObject.usd) || 0;
        const amount = new BigNumber(left).div(10 ** decimals).toFixed();
        const amountUsd = new BigNumber(amount).times(price).toFixed();
        bribeTotalUsd = bribeTotalUsd.plus(amountUsd);
        const bribeData = {
          bribeTokenAddress,
          amount,
          amountUsd,
          price,
        };
        bribes.push(bribeData);
      }
    }
    newData[pool.id] = {
      oxPoolAddress: pool.id,
      solidPoolAddress: pool.poolData.id,
      bribeAddress,
      bribeTokensAddresses,
      bribes,
      bribeTotalUsd: bribeTotalUsd.toNumber(),
    };
  }

  const vals = Object.values(newData);

  const sorted = vals.sort((a, b) => {
    return b.bribeTotalUsd - a.bribeTotalUsd;
  });

  console.log(JSON.stringify(sorted, null, 2));
};

const main = async () => {
  web3 = new Web3(new Web3.providers.HttpProvider(providerUrl));
  oxLens = new web3.eth.Contract(oxLensAbi, oxLensAddress);
  solidlyLens = new web3.eth.Contract(solidlyLensAbi, solidlyLensAddress);

  //   let bribes = readData("bribes").slice(0, 30);
  //   let total = new BigNumber(0);
  //   bribes.forEach((bribe) => {
  //     total = total.plus(bribe.bribeTotalUsd);
  //   });
  //   total = total.toNumber();
  //   const bal = 3324266648558889203877993;
  //   bribes = bribes.map((bribe) => {
  //     const percent = new BigNumber(bribe.bribeTotalUsd).div(total).toNumber();
  //     return {
  //       ...bribe,
  //       percent: percent,
  //       vote: new BigNumber(percent).times(bal).toFixed(0),
  //     };
  //   });
  //   const pools = bribes.map((bribe) => bribe.solidPoolAddress);
  //   const votes = bribes.map((bribe) => bribe.vote);
  //   //   console.log(pools, ",", votes);
  //   console.log(JSON.stringify(bribes, null, 2));

  //   await setPrices(pools);
  //   await bribes(pools);

  //   const oxSolidRewardsPoolAddress =
  //     "0xDA0067ec0925eBD6D583553139587522310Bec60";
  //   await stakingRewardsData(oxLens, [oxSolidRewardsPoolAddress]);
  const pools = await fetchOxPools();
  //   const br = await bribes(pools);
  //   console.log(br);
};

main();
