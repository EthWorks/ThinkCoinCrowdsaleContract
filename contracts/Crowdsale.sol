pragma solidity ^0.4.19;
import 'zeppelin-solidity/contracts/ownership/Ownable.sol';
import 'zeppelin-solidity/contracts/lifecycle/Pausable.sol';
import 'zeppelin-solidity/contracts/math/SafeMath.sol';
import './ThinkCoin.sol';
import './LockingContract.sol';

contract Crowdsale is Ownable, Pausable {
  using SafeMath for uint256;

  event MintProposed(address indexed _beneficiary, uint256 _tokenAmount);
  event MintLockedProposed(address indexed _beneficiary, uint256 _tokenAmount);
  event MintApproved(address indexed _beneficiary, uint256 _tokenAmount);
  event MintLockedApproved(address indexed _beneficiary, uint256 _tokenAmount);
  event MintedAllocation(address indexed _beneficiary, uint256 _tokenAmount);
  event MinterChanged(address _newMinter);
  event ApproverChanged(address _newApprover);

  ThinkCoin public thinkCoin;
  LockingContract public lockingContract;
  address public minter; // proposes mintages of tokens
  address public approver; // approves proposed mintages
  mapping(address => uint256) public mintProposals;
  mapping(address => uint256) public mintLockedProposals;
  uint256 public saleCap;
  uint256 public saleStartTime;
  uint256 public saleEndTime;

  function Crowdsale(ThinkCoin _thinkCoin,
                     uint256 _lockingPeriod,
                     address _minter,
                     address _approver,
                     uint256 _saleCap,
                     uint256 _saleStartTime,
                     uint256 _saleEndTime
                     ) public {
    require(_saleCap > 0);
    require(_saleStartTime < _saleEndTime);
    require(_saleEndTime > now);
    require(_lockingPeriod > 0);

    thinkCoin = _thinkCoin;
    lockingContract = new LockingContract(thinkCoin, saleEndTime + _lockingPeriod);    
    minter = _minter;
    approver = _approver;
    saleCap = _saleCap;
    saleStartTime = _saleStartTime;
    saleEndTime = _saleEndTime;
  }

  modifier saleStarted() {
    require(now >= saleStartTime);
    _;
  }

  modifier saleNotEnded() {
    require(now < saleEndTime);
    _;
  }

  modifier saleEnded() {
    require(now >= saleEndTime);
    _;
  }

  modifier onlyMinter() {
    require(msg.sender == minter);
    _;
  }

  modifier onlyApprover() {
    require(msg.sender == approver);
    _;
  }

  function exceedsSaleCap(uint256 _additionalAmount) internal view returns(bool) {
    uint256 totalSupply = thinkCoin.totalSupply();
    return totalSupply.add(_additionalAmount) > saleCap;
  }

  modifier notExceedingSaleCap(uint256 _amount) {
    require(!exceedsSaleCap(_amount));
    _;
  }

  function proposeMint(address _beneficiary, uint256 _tokenAmount) public onlyMinter saleStarted saleNotEnded
                                                                          notExceedingSaleCap(_tokenAmount) {
    require(_tokenAmount > 0);
    require(mintProposals[_beneficiary] == 0);
    mintProposals[_beneficiary] = _tokenAmount;
    MintProposed(_beneficiary, _tokenAmount);
  }

  function proposeMintLocked(address _beneficiary, uint256 _tokenAmount) public onlyMinter saleStarted saleNotEnded
                                                                         notExceedingSaleCap(_tokenAmount) {
    require(_tokenAmount > 0);
    require(mintLockedProposals[_beneficiary] == 0);
    mintLockedProposals[_beneficiary] = _tokenAmount;
    MintLockedProposed(_beneficiary, _tokenAmount);
  }

  function approveMint(address _beneficiary, uint256 _tokenAmount) public onlyApprover saleStarted
                                                                   notExceedingSaleCap(_tokenAmount) {
    require(_tokenAmount > 0);
    require(mintProposals[_beneficiary] == _tokenAmount);
    mintProposals[_beneficiary] = 0;
    thinkCoin.mint(_beneficiary, _tokenAmount);
    MintApproved(_beneficiary, _tokenAmount);
  }

  function approveMintLocked(address _beneficiary, uint256 _tokenAmount) public onlyApprover saleStarted
                                                                         notExceedingSaleCap(_tokenAmount) {
    require(_tokenAmount > 0);
    require(mintLockedProposals[_beneficiary] == _tokenAmount);
    mintLockedProposals[_beneficiary] = 0;
    thinkCoin.mint(lockingContract, _tokenAmount);
    lockingContract.noteTokens(_beneficiary, _tokenAmount);
    MintLockedApproved(_beneficiary, _tokenAmount);
  }

  function mintAllocation(address _beneficiary, uint256 _tokenAmount) public onlyOwner saleEnded {
    require(_tokenAmount > 0);
    thinkCoin.mint(_beneficiary, _tokenAmount);
    MintedAllocation(_beneficiary, _tokenAmount);
  }

  function finishMinting() public onlyOwner saleEnded {
    require(thinkCoin.totalSupply() == thinkCoin.cap());
    thinkCoin.finishMinting();
    giveUpTokenOwnership();
  }

  function giveUpTokenOwnership() public onlyOwner saleEnded {
    thinkCoin.transferOwnership(msg.sender);
  }

  function changeMinter(address _newMinter) public onlyOwner {
    minter = _newMinter;
    MinterChanged(_newMinter);
  }

  function changeApprover(address _newApprover) public onlyOwner {
    approver = _newApprover;
    ApproverChanged(_newApprover);
  }

  function() public payable {
    revert();
  }
}