// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "./interfaces/ITimeBomb.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract TimeBomb is ITimeBomb, AccessControl, VRFConsumerBase, ReentrancyGuard {

    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");

    uint256 public txInit = 500;
    uint256 public validAmount;

    struct queue {
        mapping (address => bool) registered;
        address[] users;
        uint256 txLeft;
        uint256 amount;
    }
    mapping (uint256 => queue) private allQueues;
    uint256 public currentQueue;
    uint256 public lastRequested;
    uint256 public lastFulfilled;
    address public lastWinner;

    bytes32 private keyHash;
    uint256 private fee;

    constructor(address _VRFCoordinator, address _LINK_ADDRESS, bytes32 _keyHash, uint256 _fee, uint256 _validAmount) 
        VRFConsumerBase(_VRFCoordinator, _LINK_ADDRESS) {
            keyHash = _keyHash;
            fee = _fee;
            validAmount = _validAmount;
            _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
            allQueues[0].txLeft = 500;
    }

    function setValidAmount(uint256 _validAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        validAmount = _validAmount;
    }

    function setTxInit(uint256 _txInit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        txInit = _txInit;
    }

    function register(address account) external payable onlyRole(REGISTER_ROLE) {
        uint256 _currentQueue = currentQueue;
        uint256 _amount = allQueues[_currentQueue].amount + msg.value;
        if (msg.value >= validAmount && !allQueues[_currentQueue].registered[account]) {
            allQueues[_currentQueue].users.push(account);
            allQueues[_currentQueue].registered[account] = true;
        }
        uint256 len = allQueues[_currentQueue].users.length;
        uint256 _txLeft = allQueues[_currentQueue].txLeft;
        if (_txLeft > 1 || len > 1) {
            allQueues[_currentQueue].amount = _amount;
        }
        else if (len == 1) {
            address winner = allQueues[_currentQueue].users[0];
            payable(winner).transfer(_amount);
            lastWinner = winner;
            lastRequested++;
            lastFulfilled++;
        }
        else {
            allQueues[_currentQueue + 1].amount = _amount;
            lastRequested++;
            lastFulfilled++;
        }
        if (_txLeft == 1) {
            allQueues[_currentQueue + 1].txLeft = txInit;
            currentQueue++;
        }
        else {
            allQueues[_currentQueue].txLeft--;
        }
        if (currentQueue > lastRequested && LINK.balanceOf(address(this)) >= fee) {
            requestRandomness(keyHash, fee);
            lastRequested++;
        }
    }

    function fulfillRandomness(bytes32 requestId, uint256 randomness) internal override nonReentrant {
        address winner = allQueues[lastFulfilled].users[randomness % allQueues[lastFulfilled].users.length];
        payable(winner).transfer(allQueues[lastFulfilled].amount);
        lastFulfilled++;
        lastWinner = winner;
    }
}