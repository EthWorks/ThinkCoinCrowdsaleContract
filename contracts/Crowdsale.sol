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
  event ProposerChanged(address _newProposer);
  event ApproverChanged(address _newApprover);

  ThinkCoin public token;
  LockingContract public lockingContract;
  address public proposer; // proposes mintages of tokens
  address public approver; // approves proposed mintages
  mapping(address => uint256) public mintProposals;
  mapping(address => uint256) public mintLockedProposals;
  uint256 public proposedTotal = 0;
  uint256 public saleCap;
  uint256 public saleStartTime;
  uint256 public saleEndTime;

  function Crowdsale(ThinkCoin _token,
                     uint256 _lockingPeriod,
                     address _proposer,
                     address _approver,
                     uint256 _saleCap,
                     uint256 _saleStartTime,
                     uint256 _saleEndTime
                     ) public {
    require(_saleCap > 0);
    require(_saleStartTime < _saleEndTime);
    require(_saleEndTime > now);
    require(_lockingPeriod > 0);
    require(_proposer != _approver);
    require(_saleStartTime >= now);
    require(_saleCap <= _token.cap());
    require(address(_token) != 0x0);

    token = _token;
    lockingContract = new LockingContract(token, _lockingPeriod);    
    proposer = _proposer;
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

  modifier onlyProposer() {
    require(msg.sender == proposer);
    _;
  }

  modifier onlyApprover() {
    require(msg.sender == approver);
    _;
  }

  function exceedsSaleCap(uint256 _additionalAmount) internal view returns(bool) {
    uint256 totalSupply = token.totalSupply();
    return totalSupply.add(_additionalAmount) > saleCap;
  }

  modifier notExceedingSaleCap(uint256 _amount) {
    require(!exceedsSaleCap(_amount));
    _;
  }

  function proposeMint(address _beneficiary, uint256 _tokenAmount) public onlyProposer saleStarted saleNotEnded
                                                                          notExceedingSaleCap(proposedTotal.add(_tokenAmount)) {
    require(_tokenAmount > 0);
    require(mintProposals[_beneficiary] == 0);
    proposedTotal = proposedTotal.add(_tokenAmount);
    mintProposals[_beneficiary] = _tokenAmount;
    MintProposed(_beneficiary, _tokenAmount);
  }

  function proposeMintLocked(address _beneficiary, uint256 _tokenAmount) public onlyProposer saleStarted saleNotEnded
                                                                         notExceedingSaleCap(proposedTotal.add(_tokenAmount)) {
    require(_tokenAmount > 0);
    require(mintLockedProposals[_beneficiary] == 0);
    proposedTotal = proposedTotal.add(_tokenAmount);
    mintLockedProposals[_beneficiary] = _tokenAmount;
    MintLockedProposed(_beneficiary, _tokenAmount);
  }

  function clearProposal(address _beneficiary) public onlyApprover {
    proposedTotal = proposedTotal.sub(mintProposals[_beneficiary]);
    mintProposals[_beneficiary] = 0;
  }

  function clearProposalLocked(address _beneficiary) public onlyApprover {
    proposedTotal = proposedTotal.sub(mintLockedProposals[_beneficiary]);
    mintLockedProposals[_beneficiary] = 0;
  }

  function approveMint(address _beneficiary, uint256 _tokenAmount) public onlyApprover saleStarted
                                                                   notExceedingSaleCap(_tokenAmount) {
    require(_tokenAmount > 0);
    require(mintProposals[_beneficiary] == _tokenAmount);
    mintProposals[_beneficiary] = 0;
    token.mint(_beneficiary, _tokenAmount);
    MintApproved(_beneficiary, _tokenAmount);
  }

  function approveMintLocked(address _beneficiary, uint256 _tokenAmount) public onlyApprover saleStarted
                                                                         notExceedingSaleCap(_tokenAmount) {
    require(_tokenAmount > 0);
    require(mintLockedProposals[_beneficiary] == _tokenAmount);
    mintLockedProposals[_beneficiary] = 0;
    token.mint(lockingContract, _tokenAmount);
    lockingContract.noteTokens(_beneficiary, _tokenAmount);
    MintLockedApproved(_beneficiary, _tokenAmount);
  }

  function mintAllocation(address _beneficiary, uint256 _tokenAmount) public onlyOwner saleEnded {
    require(_tokenAmount > 0);
    token.mint(_beneficiary, _tokenAmount);
    MintedAllocation(_beneficiary, _tokenAmount);
  }

  function finishMinting() public onlyOwner saleEnded {
    require(proposedTotal == 0);
    token.finishMinting();
    transferTokenOwnership();
  }

  function transferTokenOwnership() public onlyOwner saleEnded {
    token.transferOwnership(msg.sender);
  }

  function changeProposer(address _newProposer) public onlyOwner {
    require(_newProposer != approver);
    proposer = _newProposer;
    ProposerChanged(_newProposer);
  }

  function changeApprover(address _newApprover) public onlyOwner {
    require(_newApprover != proposer);
    approver = _newApprover;
    ApproverChanged(_newApprover);
  }
}
