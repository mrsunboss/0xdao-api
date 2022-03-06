const axios = require("axios");

const getPrices = async (tokensAddresses) => {
  const url = `https://api.coingecko.com/api/v3/simple/token_price/fantom?contract_addresses=${tokensAddresses.join()}&vs_currencies=usd`;
  const prices = (await axios.get(url)).data;
  return prices;
};

module.exports = getPrices;
