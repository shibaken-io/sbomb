// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TimeBombGasTwo is AccessControl, VRFConsumerBase, ReentrancyGuard {

    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");

    uint256 public txInit = 2;
    uint256 public validAmount;

    struct queue {
        mapping (address => bool) registered;
        address[] users;
        uint256 txLeft;
        uint256 amount;
        address winner;
    }
    mapping (uint256 => queue) public allQueues;
    uint256 public currentQueue;
    uint256 public totalFinished;
    uint256[] private requireRandomness;

    bytes32 private keyHash;
    uint256 private fee;

    constructor(address _VRFCoordinator, address _LINK_ADDRESS, bytes32 _keyHash, uint256 _fee, uint256 _validAmount) 
        VRFConsumerBase(_VRFCoordinator, _LINK_ADDRESS) {
            keyHash = _keyHash;
            fee = _fee;
            validAmount = _validAmount;
            _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
            allQueues[0].txLeft = 2;
    }

    function setValidAmount(uint256 _validAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        validAmount = _validAmount;
    }

    function setTxInit(uint256 _txInit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        txInit = _txInit;
    }

    function register(address account) external payable onlyRole(REGISTER_ROLE) nonReentrant {
        uint256 _currentQueue = currentQueue;
        uint256 _amount = allQueues[_currentQueue].amount + msg.value;
        allQueues[_currentQueue].amount = _amount;
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
                payable(winner).transfer(_amount);
                allQueues[_currentQueue].winner = winner;
                totalFinished++;
            }
            else if (len == 0) {
                allQueues[_currentQueue + 1].amount = _amount;
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
        payable(winner).transfer(allQueues[ID].amount);
        requireRandomness.pop();
        allQueues[ID].winner = winner;
    }
}