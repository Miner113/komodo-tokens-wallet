// ref: https://github.com/pbca26/agama-wallet-lib/blob/master/src/utils.js#L131
const convertExponentialToDecimal = (exponentialNumber, returnAsString) => {
  // sanity check - is it exponential number
  const str = exponentialNumber.toString();
  if (str.indexOf('e') !== -1) {
    const exponent = parseInt(str.split('-')[1], 10);
    // Unfortunately I can not return 1e-8 as 0.00000001, because even if I call parseFloat() on it,
    // it will still return the exponential representation
    // So I have to use .toFixed()
    const result = returnAsString ? exponentialNumber.toFixed(exponent).toString() : exponentialNumber.toFixed(exponent);
    return result;
  } else {
    return returnAsString ? exponentialNumber.toString() : exponentialNumber;
  }
}

// ref: https://github.com/pbca26/agama-wallet-lib/blob/master/src/utils.js#L147
const fromSats = value => convertExponentialToDecimal(Number(Number(value * 0.00000001).toFixed(8)));

// ref: https://github.com/pbca26/agama-wallet-lib/blob/master/src/utils.js#L149
const toSats = value => Number((Number(value).toFixed(8) * 100000000).toFixed(0));

// ref: https://github.com/pbca26/agama-wallet-lib/blob/master/src/utils.js#L117
const getMaxSpendNormalUtxos = (utxos = [], fee = 10000) => {
  const normalUtxos = utxos;
  let maxSpend = -1 * fee;
  
  for (let i = 0; i < normalUtxos.length; i++) {
    maxSpend += Number(normalUtxos[i].satoshis);
  }

  return maxSpend < 0 ? 0 : maxSpend;
};

module.exports = {
  fromSats,
  toSats,
  getMaxSpendNormalUtxos,
  convertExponentialToDecimal,
};