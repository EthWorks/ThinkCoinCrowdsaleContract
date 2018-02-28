/* eslint-disable */
var crowdsaleJson = require('../build/contracts/Crowdsale.json');
var Web3 = require('web3');
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
var gas = 2100000;
var gasPrice = 2000000000;
var args = process.argv.slice(2);
var shouldEstimate = (args.length == 1) && args[0];
var thinkCoinContractAddress = '0x461571346df73ceeD5cE8bEB8786B480aa7f2494';
var lockingPeriod = 60*60*24*30*3; // 3M
var saleCap = web3.utils.toWei('225000000');
var saleStartTime = 1522065600; // 03/26/2018 @ 12:00pm (UTC)
var saleEndTime = 1524830400; // 04/27/2018 @ 12:00pm (UTC)



console.log('Getting default account...');
web3.eth.getAccounts().then((accounts) => {
  if (!accounts || accounts.length < 1) {
    console.error('Default account not detected');
    process.exit(1);
  }
  var owner = accounts[0];
  let contract = new web3.eth.Contract(crowdsaleJson.abi);
  var constructorArgs = [
    thinkCoinContractAddress,
    lockingPeriod,
    owner, // minter
    owner, // approver
    saleCap,
    saleStartTime,
    saleEndTime
  ];
  
  var contractDeploy = contract.deploy({
    data: crowdsaleJson.bytecode, arguments: constructorArgs,
    gasPrice: gasPrice
  });
  if (shouldEstimate) {
    console.log('Estimating...');
    
    contractDeploy.estimateGas(function(err, gas){
      if (err) {
        console.error(err.toString());
        process.exit(1);
      }
      console.log(gas);
      process.exit(0);
    });
  } else {
    console.log('Deploying... (check MetaMask / Parity)');
    contractDeploy.send({from: owner, gas: gas}).then((result) => {
      console.log('Contract deployed at address:');
      console.log(result.options.address);
      process.exit(0);
    }).catch((err) => {
      console.error(err.toString());
      process.exit(1);
    });
  }
  
}).catch((err) => {
  console.error(err.toString());
  process.exit(1);
});

/* eslint-enable */
