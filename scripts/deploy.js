/* eslint-disable */
var Web3 = require('web3');
var thinkCoinJson = require('../build/contracts/ThinkCoin.json');
var crowdsaleJson = require('../build/contracts/Crowdsale.json');

var tokenAddress = '';
var crowdsaleAddress = '';
var proposer = '0x0';

var args = process.argv.slice(2);
if (args.length < 2 || args[0] != '--port') {
  console.log('Please specify an http provider port (-- port)')
  process.exit(1);
}
var port = args[1];
var web3 = new Web3(new Web3.providers.HttpProvider(`http://localhost:${port}`));
var gas = 3900000;
var tokenCap = web3.utils.toWei('500000000');
var lockingPeriod = 60*60*24*30*3; // 3M
var saleCap = web3.utils.toWei('300000000');
var saleStartTime = 1522713600; // 04/03/2018 @ 12:00am (UTC)
var saleEndTime = 1525089600; // 04/30/2018 @ 12:00pm (UTC)

function handleError(err) {
  console.error(err.toString());
  process.exit(1);
}

function transferOwnership(owner, tokenContract, crowdsaleContract) {
  console.log('Token address: ' + tokenContract.options.address);
  console.log('Crowdsale address: ' + crowdsaleContract.options.address);
  console.log('transferring token ownership... (check metamask / parity chrome extension)');
  tokenContract.methods.transferOwnership(crowdsaleContract.options.address)
  .send({from: owner, gas: gas})
  .then(() => {
    console.log('Done.');
    process.exit(0);
  }).catch(err => handleError(err));
}

function deployCrowdsale(owner, tokenContract) {
  console.log('Token address: ' + tokenContract.options.address);
  console.log('deploying crowdsale... (check metamask / parity chrome extension)');
  var crowdsaleContract = new web3.eth.Contract(crowdsaleJson.abi);
  var constructorArgs = [
    tokenContract.options.address,
    lockingPeriod,
    proposer, // proposer
    owner, // approver
    saleCap,
    saleStartTime,
    saleEndTime
  ];
  crowdsaleContract.deploy({
    data: crowdsaleJson.bytecode, arguments: constructorArgs
  })
  .send({from: owner, gas: gas})
  .then(result => console.log('deployed crowdsale: ' + result.options.address))
  .catch(err => handleError(err));
}

function deployToken(owner) {
  console.log('deploying token... (check metamask / parity chrome extension)');
  var tokenContract = new web3.eth.Contract(thinkCoinJson.abi);
  tokenContract.deploy({
    data: thinkCoinJson.bytecode, arguments: [tokenCap]
  })
  .send({from: owner, gas: gas})
  .then(result => console.log('deployed token: ' + result.options.address))
  .catch(err => handleError(err));
};

web3.eth.getAccounts().then((accounts) => {
  if (!accounts || accounts.length < 1) {
    console.error('Default account not detected');
    process.exit(1);
  }
  console.log('Using account: ' + accounts[0]);
  var tokenContract = new web3.eth.Contract(thinkCoinJson.abi);
  var crowdsaleContract = new web3.eth.Contract(crowdsaleJson.abi);
  tokenContract.options.address = tokenAddress;
  crowdsaleContract.options.address = crowdsaleAddress;
  if (tokenAddress && crowdsaleAddress) {
    transferOwnership(accounts[0], tokenContract, crowdsaleContract)
  }
  if (tokenAddress && !crowdsaleAddress) {
    deployCrowdsale(accounts[0], tokenContract)
  }
  if (!tokenAddress && !crowdsaleAddress) {
    deployToken(accounts[0]);
  }
});

/* eslint-enable */
