import {createWeb3, deployContract, expectThrow, latestTime, durationInit, increaseTimeTo} from '../testUtils.js';
import crowdsaleJson from '../../build/contracts/Crowdsale.json';
import tokenJson from '../../build/contracts/ThinkCoin.json';
import lockingJson from '../../build/contracts/LockingContract.json';
import chai from 'chai';
import bnChai from 'bn-chai';

const {expect} = chai;
const web3 = createWeb3();
chai.use(bnChai(web3.utils.BN));

describe('Crowdsale', () => {
  const {BN} = web3.utils;
  const duration = durationInit(web3);
  let tokenContract;
  let tokenDeployer;
  let tokenContractAddress;
  let saleContract;
  let saleOwner;
  let saleContractAddress;
  let lockingContract;
  let accounts;
  let minter;
  let approver;
  let altMinter;
  let altApprover;
  let lockedContributor;
  let contributor;
  const tokenCap = new BN(web3.utils.toWei('500000000'));
  const saleCap = new BN(web3.utils.toWei('225000000'));
  const lockingPeriod = duration.days(30).mul(new BN(3));
  let saleStartTime;
  let saleEndTime;

  before(async () => {
    accounts = await web3.eth.getAccounts();
    [, tokenDeployer, saleOwner, minter, approver, altMinter, altApprover, lockedContributor, contributor] = accounts;
  });

  const deployContracts = async () => {
    // token contract
    tokenContract = await deployContract(web3, tokenJson, tokenDeployer, [tokenCap]);
    tokenContractAddress = tokenContract.options.address;

    // dates and times
    const now = new BN(await latestTime(web3));
    saleStartTime = now.add(duration.days(1));
    saleEndTime = saleStartTime.add(duration.weeks(1));

    // crowdsale contract
    const saleArgs = [
      tokenContractAddress,
      lockingPeriod,
      minter,
      approver,
      saleCap,
      saleStartTime,
      saleEndTime
    ];
    saleContract = await deployContract(web3, crowdsaleJson, saleOwner, saleArgs);
    saleContractAddress = saleContract.options.address;

    // Locking contract
    const lockingContractAddress = await saleContract.methods.lockingContract().call({from: saleOwner});
    lockingContract = await new web3.eth.Contract(lockingJson.abi, lockingContractAddress);
  };

  beforeEach(async () => {
    await deployContracts();
    await tokenContract.methods.transferOwnership(saleContractAddress).send({from: tokenDeployer});
  });

  it('should be properly deployed', async () => {
    const actualCap = new BN(await tokenContract.methods.cap().call({from: tokenDeployer}));
    expect(tokenCap).to.be.eq.BN(actualCap);
    const actualTokenAddress = await saleContract.methods.token().call({from: saleOwner});
    expect(actualTokenAddress).to.be.equal(tokenContractAddress);
    const actualTokenOwner = await tokenContract.methods.owner().call({from: tokenDeployer});
    expect(actualTokenOwner).to.be.equal(saleContractAddress);
  });

  const advanceToSaleStarted = async () => increaseTimeTo(web3, saleStartTime.add(duration.hours(12)));
  const advanceToSaleEnded = async () => increaseTimeTo(web3, saleEndTime.add(duration.hours(12)));

  const lockedBalanceOf = async (client) =>
    lockingContract.methods.balanceOf(client).call({from: saleOwner});
    
  const mintingFinished = async () => tokenContract.methods.mintingFinished().call({from: tokenDeployer});
  const balanceOf = async (client) => tokenContract.methods.balanceOf(client).call({from: saleOwner});
  const changeMinter = async (newMinter, from) => saleContract.methods.changeMinter(newMinter).send({from});
  const changeApprover = async (newApprover, from) => saleContract.methods.changeApprover(newApprover).send({from});
  const transferTokenOwnership = async (from) => saleContract.methods.transferTokenOwnership().send({from});

  const proposeMint = async (beneficiary, tokenAmount, from) =>
    saleContract.methods.proposeMint(beneficiary, tokenAmount).send({from});

  const proposeMintLocked = async (beneficiary, tokenAmount, from) =>
    saleContract.methods.proposeMintLocked(beneficiary, tokenAmount).send({from});

  const approveMint = async (beneficiary, tokenAmount, from) =>
    saleContract.methods.approveMint(beneficiary, tokenAmount).send({from});

  const approveMintLocked = async (beneficiary, tokenAmount, from) =>
    saleContract.methods.approveMintLocked(beneficiary, tokenAmount).send({from});

  const mintAllocation = async (beneficiary, tokenAmount, from) =>
    saleContract.methods.mintAllocation(beneficiary, tokenAmount).send({from});

  const finishMinting = async (from) =>
    saleContract.methods.finishMinting().send({from});

  const getMintProposal = async (beneficiary) =>
    saleContract.methods.mintProposals(beneficiary).call({from: saleOwner});

  const getMintLockedProposal = async (beneficiary) =>
    saleContract.methods.mintLockedProposals(beneficiary).call({from: saleOwner});

  describe('Changing owner, minter and approver', async () => {
    const testShouldChangeMinter = async (from = saleOwner) => {
      await changeMinter(altMinter, from);
      const actualMinter = await saleContract.methods.minter().call();
      expect(actualMinter).to.be.equal(altMinter);
    };

    const testShouldNotChangeMinter = async (from = saleOwner) => {
      await expectThrow(changeMinter(altMinter, from));
      const actualMinter = await saleContract.methods.minter().call();
      expect(actualMinter).to.be.equal(minter);
    };

    const testShouldChangeApprover = async (from = saleOwner) => {
      await changeApprover(altApprover, from);
      const actualApprover = await saleContract.methods.approver().call();
      expect(actualApprover).to.be.equal(altApprover);
    };

    const testShouldNotChangeApprover = async (from = saleOwner) => {
      await expectThrow(changeApprover(altApprover, from));
      const actualApprover = await saleContract.methods.approver().call();
      expect(actualApprover).to.be.equal(approver);
    };

    const testShouldTransferTokenOwnership = async (from = saleOwner) => {
      await transferTokenOwnership(from);
      const actualOwner = await tokenContract.methods.owner().call();
      expect(actualOwner).to.be.equal(from);
    };

    const testShouldNotTransferTokenOwnership = async (from = saleOwner) => {
      await expectThrow(transferTokenOwnership(from));
      const actualOwner = await tokenContract.methods.owner().call();
      expect(actualOwner).to.be.equal(saleContractAddress);
    };

    describe('Before crowdsale starts', async () => {
      it('should be possible to change minter by the owner',
        async () => testShouldChangeMinter());

      it('should not be possible to change minter by a third party',
        async () => testShouldNotChangeMinter(contributor));

      it('should be possible to change approver by the owner',
        async () => testShouldChangeApprover());

      it('should not be possible to change approver by a third party',
        async () => testShouldNotChangeApprover(contributor));

      it('should not be possible to transfer token ownership',
        async () => testShouldNotTransferTokenOwnership(saleOwner));
    });

    describe('Crowdsale started', async () => {
      beforeEach(advanceToSaleStarted);

      it('should be possible to change minter by the owner',
        async () => testShouldChangeMinter());

      it('should not be possible to change minter by a third party',
        async () => testShouldNotChangeMinter(contributor));

      it('should be possible to change approver by the owner',
        async () => testShouldChangeApprover());

      it('should not be possible to change approver by a third party',
        async () => testShouldNotChangeApprover(contributor));

      it('should not be possible to transfer token ownership',
        async () => testShouldNotTransferTokenOwnership(saleOwner));
    });

    describe('Crowdsale ended', async () => {
      beforeEach(advanceToSaleEnded);

      it('should be possible to change minter by the owner',
        async () => testShouldChangeMinter());

      it('should not be possible to change minter by a third party',
        async () => testShouldNotChangeMinter(contributor));

      it('should be possible to change approver by the owner',
        async () => testShouldChangeApprover());

      it('should not be possible to change approver by a third party',
        async () => testShouldNotChangeApprover(contributor));

      it('should be possible to transfer token ownership',
        async () => testShouldTransferTokenOwnership(saleOwner));

      it('should not be possible to transfer token ownership by third party',
        async () => testShouldNotTransferTokenOwnership(contributor));
    });
  });

  describe('Proposing', async () => {
    const contributionAmount = new BN(web3.utils.toWei('1'));
    const differentAmount = new BN(web3.utils.toWei('0.5'));

    const testShouldProposeMint = async (beneficiary, tokenAmount, from) => {
      await proposeMint(beneficiary, tokenAmount, from);
      const proposal = await getMintProposal(beneficiary);
      expect(proposal).to.eq.BN(tokenAmount);
    };

    const testShouldNotProposeMint = async (beneficiary, tokenAmount, from) => {
      const initialProposal = new BN(await getMintProposal(beneficiary));
      await expectThrow(proposeMint(beneficiary, tokenAmount, from));
      const proposal = await getMintProposal(beneficiary);
      expect(proposal).to.eq.BN(initialProposal);
    };

    const testShouldProposeMintLocked = async (beneficiary, tokenAmount, from) => {
      await proposeMintLocked(beneficiary, tokenAmount, from);
      const proposal = await getMintLockedProposal(beneficiary);
      expect(proposal).to.eq.BN(tokenAmount);
    };

    const testShouldNotProposeMintLocked = async (beneficiary, tokenAmount, from) => {
      const initialProposal = new BN(await getMintLockedProposal(beneficiary));
      await expectThrow(proposeMintLocked(beneficiary, tokenAmount, from));
      const proposal = await getMintLockedProposal(beneficiary);
      expect(proposal).to.eq.BN(initialProposal);
    };

    describe('Before crowdsale starts', async () => {
      it('should not allow to propose mint',
        async () => testShouldNotProposeMint(contributor, contributionAmount, minter));

      it('should not allow to propose mint locked',
        async () => testShouldNotProposeMintLocked(contributor, contributionAmount, minter));
    });

    describe('Crowdsale started', async () => {
      beforeEach(advanceToSaleStarted);

      it('should allow to propose mint by minter',
        async () => testShouldProposeMint(contributor, contributionAmount, minter));

      it('should allow to propose mint locked tokens by minter',
        async () => testShouldProposeMintLocked(contributor, contributionAmount, minter));

      it('should not allow to propose mint by a third party',
        async () => testShouldNotProposeMint(contributor, contributionAmount, contributor));

      it('should not allow to propose mint locked by a third party',
        async () => testShouldNotProposeMintLocked(contributor, contributionAmount, contributor));

      it('should not allow to propose mint by approver',
        async () => testShouldNotProposeMint(contributor, contributionAmount, approver));

      it('should not allow to propose mint locked by approver',
        async () => testShouldNotProposeMintLocked(contributor, contributionAmount, approver));

      it('should allow to propose mint up to the sale cap',
        async () => testShouldProposeMint(contributor, saleCap, minter));

      it('should allow to propose mint locked up to the sale cap',
        async () => testShouldProposeMintLocked(contributor, saleCap, minter));

      it('should not allow to propose mint more than the sale cap',
        async () => testShouldNotProposeMint(contributor, saleCap.add(new BN('1')), minter));

      it('should not allow to propose mint locked more than the sale cap',
        async () => testShouldNotProposeMintLocked(contributor, saleCap.add(new BN('1')), minter));

      it('should not allow to propose mint twice for the same person', async () => {
        await testShouldProposeMint(contributor, contributionAmount, minter);
        await testShouldNotProposeMint(contributor, differentAmount, minter);
      });

      it('should not allow to propose mint locked twice for the same person', async () => {
        await testShouldProposeMintLocked(contributor, contributionAmount, minter);
        await testShouldNotProposeMintLocked(contributor, differentAmount, minter);
      });

      it('should allow to propose mint and propose mint locked for the same person', async () => {
        await testShouldProposeMintLocked(contributor, contributionAmount, minter);
        await testShouldProposeMint(contributor, differentAmount, minter);
      });
    });

    describe('Crowdsale ended', async () => {
      beforeEach(advanceToSaleEnded);

      it('should not allow to propose mint',
        async () => testShouldNotProposeMint(contributor, contributionAmount, minter));

      it('should not allow to propose mint locked',
        async () => testShouldNotProposeMintLocked(contributor, contributionAmount, minter));
    });
  });

  describe('Approving', async () => {
    const contributionAmount = new BN(web3.utils.toWei('1'));
    const lockedContributionAmount = new BN(web3.utils.toWei('2'));
    const differentAmount = new BN(web3.utils.toWei('0.5'));

    const testShouldApproveMint = async (beneficiary, tokenAmount, from) => {
      const initialBalance = new BN(await balanceOf(beneficiary));
      await approveMint(beneficiary, tokenAmount, from);
      const balance = new BN(await balanceOf(beneficiary));
      expect(balance.sub(initialBalance)).to.eq.BN(tokenAmount);
    };

    const testShouldNotApproveMint = async (beneficiary, tokenAmount, from) => {
      const initialBalance = new BN(await balanceOf(beneficiary));
      await expectThrow(approveMint(beneficiary, tokenAmount, from));
      const balance = await balanceOf(beneficiary);
      expect(balance).to.eq.BN(initialBalance);
    };

    const testShouldApproveMintLocked = async (beneficiary, tokenAmount, from) => {
      const initialBalance = new BN(await lockedBalanceOf(beneficiary));
      await approveMintLocked(beneficiary, tokenAmount, from);
      const balance = new BN(await lockedBalanceOf(beneficiary));
      expect(balance.sub(initialBalance)).to.eq.BN(tokenAmount);
    };

    const testShouldNotApproveMintLocked = async (beneficiary, tokenAmount, from) => {
      const initialBalance = new BN(await lockedBalanceOf(beneficiary));
      await expectThrow(approveMintLocked(beneficiary, tokenAmount, from));
      const balance = await lockedBalanceOf(beneficiary);
      expect(balance).to.eq.BN(initialBalance);
    };

    describe('Before crowdsale starts', async () => {
      it('should not allow to approve mint if not proposed',
        async () => testShouldNotApproveMint(contributor, contributionAmount, approver));

      it('should not allow to approve mint amount of zero',
        async () => testShouldNotApproveMint(contributor, new BN('0'), approver));

      it('should not allow to approve mint locked if not proposed',
        async () => testShouldNotApproveMintLocked(lockedContributor, lockedContributionAmount, approver));

      it('should not allow to approve mint locked amount of zero',
        async () => testShouldNotApproveMintLocked(lockedContributor, new BN('0'), approver));
    });

    describe('Crowdsale started', async () => {
      beforeEach(async () => {
        await advanceToSaleStarted();
        await proposeMintLocked(lockedContributor, lockedContributionAmount, minter);
        await proposeMint(contributor, contributionAmount, minter);
      });

      it('should allow to approve mint',
        async () => testShouldApproveMint(contributor, contributionAmount, approver));

      it('should allow to approve mint locked',
        async () => testShouldApproveMintLocked(lockedContributor, lockedContributionAmount, approver));

      it('should not allow to approve mint by a third party',
        async () => testShouldNotApproveMint(contributor, contributionAmount, contributor));

      it('should not allow to approve mint locked by a third party',
        async () => testShouldNotApproveMintLocked(lockedContributor, lockedContributionAmount, contributor));

      it('should not allow to approve mint by minter',
        async () => testShouldNotApproveMint(contributor, contributionAmount, minter));

      it('should not allow to approve mint locked by minter',
        async () => testShouldNotApproveMintLocked(lockedContributor, lockedContributionAmount, minter));

      it('should not allow to approve mint for a different amount than proposed',
        async () => testShouldNotApproveMint(contributor, differentAmount, approver));

      it('should not allow to approve mint locked for a different amount than proposed',
        async () => testShouldNotApproveMintLocked(lockedContributor, differentAmount, approver));

      it('should not allow to approve mint twice', async () => {
        await testShouldApproveMint(contributor, contributionAmount, approver);
        await testShouldNotApproveMint(contributor, contributionAmount, approver);
      });

      it('should not allow to approve mint locked twice', async () => {
        await testShouldApproveMintLocked(lockedContributor, lockedContributionAmount, approver);
        await testShouldNotApproveMintLocked(lockedContributor, lockedContributionAmount, approver);
      });
    });

    describe('Crowdsale ended', async () => {
      beforeEach(async () => {
        await advanceToSaleStarted();
        await proposeMintLocked(lockedContributor, lockedContributionAmount, minter);
        await proposeMint(contributor, contributionAmount, minter);
        await advanceToSaleEnded();
      });

      it('should allow to approve mint',
        async () => testShouldApproveMint(contributor, contributionAmount, approver));

      it('should allow to approve mint locked',
        async () => testShouldApproveMintLocked(lockedContributor, lockedContributionAmount, approver));
    });
  });

  describe('Minting allocations', async () => {
    const contributionAmount = new BN(web3.utils.toWei('1'));

    const testShouldMintAllocation = async (beneficiary, tokenAmount, from) => {
      const initialBalance = new BN(await balanceOf(beneficiary));
      await mintAllocation(beneficiary, tokenAmount, from);
      const balance = new BN(await balanceOf(beneficiary));
      expect(balance.sub(initialBalance)).to.eq.BN(tokenAmount);
    };

    const testShouldNotMintAllocation = async (beneficiary, tokenAmount, from) => {
      const initialBalance = new BN(await balanceOf(beneficiary));
      await expectThrow(mintAllocation(beneficiary, tokenAmount, from));
      const balance = await balanceOf(beneficiary);
      expect(balance).to.eq.BN(initialBalance);
    };

    describe('Before crowdsale starts', async () => {
      it('should not allow to mint allocation', 
        async () => testShouldNotMintAllocation(contributor, contributionAmount, saleOwner));
    });

    describe('Crowdsale started', async () => {
      beforeEach(advanceToSaleStarted);

      it('should not allow to mint allocation', 
        async () => testShouldNotMintAllocation(contributor, contributionAmount, saleOwner));
    });

    describe('Crowdsale ended', async () => {
      beforeEach(advanceToSaleEnded);

      it('should allow to mint allocation', 
        async () => testShouldMintAllocation(contributor, contributionAmount, saleOwner));

      it('should not allow to mint allocation by a third party', 
        async () => testShouldNotMintAllocation(contributor, contributionAmount, contributor));

      it('should not allow to mint allocation by minter', 
        async () => testShouldNotMintAllocation(contributor, contributionAmount, minter));

      it('should not allow to mint allocation by approver', 
        async () => testShouldNotMintAllocation(contributor, contributionAmount, approver));
    });
  });

  describe('Finishing minting', async () => {
    const testShouldFinishMinting = async (from) => {
      await finishMinting(from);
      expect(await mintingFinished()).to.be.true;
    };

    const testShouldNotFinishMinting = async (from) => {
      await expectThrow(finishMinting(from));
      expect(await mintingFinished()).to.be.false;
    };

    describe('Before crowdsale starts', async () => {
      it('should not allow to finish minting', 
        async () => testShouldNotFinishMinting(saleOwner));
    });

    describe('Crowdsale started', async () => {
      beforeEach(advanceToSaleStarted);

      it('should not allow to finish minting', 
        async () => testShouldNotFinishMinting(saleOwner));
    });

    describe('Crowdsale ended', async () => {
      beforeEach(advanceToSaleEnded);

      it('should allow to finish minting', 
        async () => testShouldFinishMinting(saleOwner));

      describe('Token cap reached', async () => {
        beforeEach(async () => {
          await mintAllocation(contributor, tokenCap, saleOwner);
        });

        it('should allow to finish minting', 
          async () => testShouldFinishMinting(saleOwner));

        it('should not allow to finish minting by a third party', 
          async () => testShouldNotFinishMinting(contributor));

        it('should not allow to finish minting by minter', 
          async () => testShouldNotFinishMinting(minter));

        it('should not allow to finish minting by approver', 
          async () => testShouldNotFinishMinting(approver));
      });
    });
  });
});
