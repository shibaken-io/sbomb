// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBase.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TimeBombGas is AccessControl, VRFConsumerBase, ReentrancyGuard {

    bytes32 public constant REGISTER_ROLE = keccak256("REGISTER_ROLE");
    IERC20 public immutable sBomb;

    uint256 public txInit = 300;
    uint256 public validAmount;

    uint256 public currentQueue = type(uint256).max - 1;
    uint256 public totalFinished = type(uint256).max - 1;

    uint256[] private requireRandomness;

    bytes32 private keyHash;
    uint256 private fee;

    mapping (uint256 => Queue) public allQueues;

    struct Queue {
        mapping (address => bool) registered;
        address[] users;
        uint256 txLeft;
        uint256 ETHAmount;
        uint256 sBombAmount;
        address winner;
    }

    constructor(address _VRFCoordinator, address _LINK_ADDRESS, bytes32 _keyHash, uint256 _fee, uint256 _validAmount, address _sBomb) 
        VRFConsumerBase(_VRFCoordinator, _LINK_ADDRESS) {
            keyHash = _keyHash;
            fee = _fee;
            validAmount = _validAmount;
            sBomb = IERC20(_sBomb);
            _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
            _setupRole(REGISTER_ROLE, _sBomb);
            allQueues[type(uint256).max - 1].txLeft = 300;
    }

    function setValidAmount(uint256 _validAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        validAmount = _validAmount;
    }

    function setTxInit(uint256 _txInit) external onlyRole(DEFAULT_ADMIN_ROLE) {
        txInit = _txInit;
    }

    function withdrawLINK(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        LINK.transfer(_msgSender(), amount);
    }

    function register(address account, uint256 _sBombAmount) external payable onlyRole(REGISTER_ROLE) nonReentrant {
        uint256 _currentQueue = currentQueue;
        Queue storage queue = allQueues[_currentQueue];
        uint256 _ETHAmount = queue.ETHAmount + msg.value;
        _sBombAmount += queue.sBombAmount;
        queue.ETHAmount = _ETHAmount;
        queue.sBombAmount = _sBombAmount;
        if (msg.value >= validAmount && !queue.registered[account]) {
            queue.users.push(account);
            queue.registered[account] = true;
        }
        uint256 len = queue.users.length;
        uint256 _txLeft = queue.txLeft;
        if (_txLeft == 1) {
            allQueues[_currentQueue + 1].txLeft = txInit;
            currentQueue++;
            if (len == 1) {
                address winner = queue.users[0];
                payable(winner).transfer(_ETHAmount);
                sBomb.transfer(winner, _sBombAmount);
                queue.winner = winner;
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
            queue.txLeft--;
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