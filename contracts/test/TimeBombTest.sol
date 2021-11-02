// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TimeBombTest is AccessControl, VRFConsumerBase, ReentrancyGuard {

    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");

    uint256 public txInit = 10;
    uint256 public validAmount;
    IERC20 public immutable sBomb;

    struct queue {
        mapping (address => bool) registered;
        address[] users;
        uint256 txLeft;
        uint256 ETHAmount;
        uint256 sBombAmount;
        address winner;
    }
    mapping (uint256 => queue) public allQueues;
    uint256 public currentQueue;
    uint256 public totalFinished;
    uint256[] private requireRandomness;

    bytes32 private keyHash;
    uint256 private fee;

    constructor(address _VRFCoordinator, address _LINK_ADDRESS, bytes32 _keyHash, uint256 _fee, uint256 _validAmount, address _sBomb) 
        VRFConsumerBase(_VRFCoordinator, _LINK_ADDRESS) {
            keyHash = _keyHash;
            fee = _fee;
            validAmount = _validAmount;
            sBomb = IERC20(_sBomb);
            _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
            allQueues[0].txLeft = 10;
    }

    function setValidAmount(uint256 _validAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        validAmount = _validAmount;
    }

    function setTxInit(uint256 _txInit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        txInit = _txInit;
    }

    function register(address account, uint256 _sBombAmount) external payable onlyRole(REGISTER_ROLE) nonReentrant {
        uint256 _currentQueue = currentQueue;
        uint256 _ETHAmount = allQueues[_currentQueue].ETHAmount + msg.value;
        _sBombAmount += allQueues[_currentQueue].sBombAmount;
        allQueues[_currentQueue].ETHAmount = _ETHAmount;
        allQueues[_currentQueue].sBombAmount = _sBombAmount;
        if (msg.value >= validAmount && !allQueues[_currentQueue].registered[account]) {
            allQueues[_currentQueue].users.push(account);
            allQueues[_currentQueue].registered[account] = true;
        }
        uint256 len = allQueues[_currentQueue].users.length;
        uint256 _txLeft = allQueues[_currentQueue].txLeft;
        if (_txLeft == 1) {
            allQueues[_currentQueue + 1].txLeft = txInit;
            currentQueue++;
            if (len == 1) {
                address winner = allQueues[_currentQueue].users[0];
                payable(winner).transfer(_ETHAmount);
                sBomb.transfer(winner, _sBombAmount);
                allQueues[_currentQueue].winner = winner;
                totalFinished++;
            }
            else if (len == 0) {
                allQueues[_currentQueue + 1].ETHAmount = _ETHAmount;
                allQueues[_currentQueue + 1].sBombAmount = _sBombAmount;
                totalFinished++;
            }
            else {
                requireRandomness.push(_currentQueue);
            }
        }
        else {
            allQueues[_currentQueue].txLeft--;
        }
        if (currentQueue > totalFinished && LINK.balanceOf(address(this)) >= fee) {
            requestRandomness(keyHash, fee);
            totalFinished++;
        }
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override {
        uint256 ID = requireRandomness[requireRandomness.length - 1];
        address winner = allQueues[ID].users[randomness % allQueues[ID].users.length];
        payable(winner).transfer(allQueues[ID].ETHAmount);
        sBomb.transfer(winner, allQueues[ID].sBombAmount);
        requireRandomness.pop();
        allQueues[ID].winner = winner;
    }
}