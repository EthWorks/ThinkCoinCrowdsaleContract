pragma solidity ^0.4.19;
import './ExternalMinter.sol';
import './LockingContract.sol';

contract SelfMintingLockingContract is LockingContract {
  function SelfMintingLockingContract(ERC20 _tokenContract, uint256 _lockingDuration) LockingContract(_tokenContract, _lockingDuration) public {}

  // override
  function ensureTokensAvailable(uint256 _tokenAmount) private {
    uint256 initialTokenBalance = tokenContract.balanceOf(this);
    ExternalMinter(msg.sender).externalMint(this, _tokenAmount);
    uint256 tokenBalance = tokenContract.balanceOf(this);
    require(tokenBalance == initialTokenBalance.add(_tokenAmount));
  }
}
