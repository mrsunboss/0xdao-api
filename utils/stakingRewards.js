const sanitize = require("./sanitize.js");
const getPrices = require("./prices.js");

const stakingRewardsData = async (oxLens, oxPoolsAddresses) => {
  // Fetch rewards data
  const rewardsDataMapping = {};
  for (
    let oxPoolIndex = 0;
    oxPoolIndex < oxPoolsAddresses.length;
    oxPoolIndex++
  ) {
    const oxPoolAddress = oxPoolsAddresses[oxPoolIndex];
    const rewardsData = await oxLens.methods
      .rewardTokensData(oxPoolAddress)
      .call();
    rewardsDataMapping[oxPoolAddress] = sanitize(rewardsData);
  }

  // Fetch tokens data
  const tokensMapping = {};
  Object.values(rewardsDataMapping).forEach((rewardData) => {
    Object.values(rewardData).forEach((rewardData) => {
      tokensMapping[rewardData.id] = true;
    });
  });
  const tokensAddresses = Object.keys(tokensMapping);

  console.log(await getPrices(tokensAddresses));
};

module.exports = stakingRewardsData;
