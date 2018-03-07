/* eslint-disable */
var Web3 = require('web3');
var thinkCoinJson = require('../build/contracts/ThinkCoin.json');
var crowdsaleJson = require('../build/contracts/Crowdsale.json');

//var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:7545"));
var gas = 2900000;
var tokenCap = web3.utils.toWei('500000000');
var lockingPeriod = 60*60*24*30*3; // 3M
var saleCap = web3.utils.toWei('225000000');
var saleStartTime = 1522065600; // 03/26/2018 @ 12:00pm (UTC)
var saleEndTime = 1524830400; // 04/27/2018 @ 12:00pm (UTC)

function handleError(err) {
  console.error(err.toString());
  process.exit(1);
}

function transferOwnership(owner, tokenContract, crowdsaleContract) {
  console.log('transferring token ownership...');
  tokenContract.methods.transferOwnership(crowdsaleContract.options.address)
  .send({from: owner, gas: gas})
  .then(() => {
    console.log('Done. Crowdsale address: ' + crowdsaleContract.options.address);
    process.exit(0);
  }).catch(err => handleError(err));
}

function deployCrowdsale(owner, tokenContract) {
  console.log('deploying crowdsale...');
  var crowdsaleContract = new web3.eth.Contract(crowdsaleJson.abi);
  var constructorArgs = [
    tokenContract.options.address,
    lockingPeriod,
    owner, // minter
    owner, // approver
    saleCap,
    saleStartTime,
    saleEndTime
  ];
  crowdsaleContract.deploy({
    data: crowdsaleJson.bytecode, arguments: constructorArgs
  })
  .send({from: owner, gas: gas})
  .then(result => transferOwnership(owner, tokenContract, result))
  .catch(err => handleError(err));
}

function deployToken(owner) {
  console.log('deploying token...');
  var tokenContract = new web3.eth.Contract(thinkCoinJson.abi);
  tokenContract.deploy({
    data: thinkCoinJson.bytecode, arguments: [tokenCap]
  })
  .send({from: owner, gas: gas})
  .then(result => deployCrowdsale(owner, result))
  .catch(err => handleError(err));
};

web3.eth.getAccounts().then((accounts) => {
  if (!accounts || accounts.length < 1) {
    console.error('Default account not detected');
    process.exit(1);
  }
  deployToken(accounts[0]);
});

/* eslint-enable */
