pragma solidity ^0.4.19;
import 'zeppelin-solidity/contracts/token/ERC20/MintableToken.sol';

contract ThinkCoin is MintableToken {
  string public name = "ThinkCoin";
  string public symbol = "TCO";
  uint256 public cap;

  function ThinkCoin(uint256 _cap) public {
    require(_cap > 0);
    cap = _cap;
  }

  // override
  function mint(address _to, uint256 _amount) onlyOwner canMint public returns (bool) {
    require(totalSupply_.add(_amount) <= cap);
    return super.mint(_to, _amount);
  }

  // override
  function transfer(address _to, uint256 _value) public returns (bool) {
    require(mintingFinished == true);
    return super.transfer(_to, _value);
  }

  // override
  function transferFrom(address _from, address _to, uint256 _value) public returns (bool) {
    require(mintingFinished == true);
    return super.transferFrom(_from, _to, _value);
  }

  function() public payable {
    revert();
  }
}