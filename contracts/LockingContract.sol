pragma solidity ^0.4.19;
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/token/ERC20/StandardToken.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';

contract LockingContract is Ownable {
  using SafeMath for uint256;

  StandardToken public tokenContract;
  mapping(address => uint256) tokens;
  uint256 totalTokens;
  uint256 public unlockTime;

  function isLocked() public view returns(bool) {
    return now < unlockTime;
  }

  modifier onlyWhenUnlocked() {
    require(!isLocked());
    _;
  }

  modifier onlyWhenLocked() {
    require(isLocked());
    _;
  }

  function LockingContract(StandardToken _tokenContract, uint256 _lockingDuration) public {
    require(_lockingDuration > 0);
    unlockTime = now.add(_lockingDuration);
    tokenContract = _tokenContract;
  }

  function balanceOf(address _owner) public view returns (uint256 balance) {
    return tokens[_owner];
  }

  // Should only be done from another contract.
  // To ensure that the LockingContract can release all noted tokens later,
  // one should mint/transfer tokens to the LockingContract's account prior to noting
  function noteTokens(address _beneficiary, uint256 _tokenAmount) external onlyOwner onlyWhenLocked {
    uint256 tokenBalance = tokenContract.balanceOf(this);
    require(tokenBalance == totalTokens.add(_tokenAmount));

    tokens[_beneficiary] = tokens[_beneficiary].add(_tokenAmount);
    totalTokens = totalTokens.add(_tokenAmount);
  }

  function releaseTokens(address _beneficiary) public onlyWhenUnlocked {
    uint256 amount = tokens[_beneficiary];
    tokens[_beneficiary] = 0;
    tokenContract.transfer(_beneficiary, amount);
    totalTokens = totalTokens.sub(amount);
  }

  function reduceLockingTime(uint256 _newUnlockTime) public onlyOwner onlyWhenLocked {
    require(_newUnlockTime >= now);
    require(_newUnlockTime < unlockTime);
    unlockTime = _newUnlockTime;
  }
}