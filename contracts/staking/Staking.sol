// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Staking is Ownable, ReentrancyGuard {
    uint256 private constant DECIMAL = 10**18;
    uint256 private constant LOCK_UP = 60*60*24*30; 
    address private constant DEAD_WALLET = 0x000000000000000000000000000000000000dEaD;

    address public rewardToken;
    address public stakedToken;
    uint256 public staked;
    address public devWallet;

    uint256 private globalKoeff;
    uint256 private lastUpdate;
    uint256 private N;

    mapping(address => UserInfo) user;

    struct UserInfo {
        uint256 amount; // amount of staked tokens
        uint256 userArg;
        uint256 start;
    }

    modifier initiated() {
        require(
            N > 0 && stakedToken != address(0) && rewardToken != address(0),
            "Staking: Contract should be initiated"
        );

        _;
    }

    function getUserInfo(address investor)
        external
        view
        returns (uint256 amount)
    {
        amount = user[investor].amount;
    }

    function init(
        address stToken,
        address rewToken,
        address dWallet,
        uint256 period
    ) external onlyOwner {
        require(
            N == 0 || stakedToken == address(0) || rewardToken == address(0) || devWallet == address(0),
            "Staking: Contract was initiated"
        );
        require(
            stToken != address(0) && rewToken != address(0) && period > 0 && dWallet != address(0),
            "Staking: Uncorrect data for init"
        );
        rewardToken = rewToken;
        stakedToken = stToken;
        devWallet = dWallet;
        N = IERC20(rewardToken).balanceOf(address(this)) / period;
    }

    function deposit(uint256 amount) external initiated nonReentrant {
        require(amount > 0, "Staking: it is not allowed to stake zero tokens");
        address investor = msg.sender;
        UserInfo memory _user = user[investor];

        if (lastUpdate != 0) {
            globalKoeff +=
                (DECIMAL * N * (block.timestamp - lastUpdate)) /
                staked;
            user[investor].userArg =
                _user.userArg +
                (amount * globalKoeff) /
                DECIMAL;
        }
        staked += amount;
        lastUpdate = block.timestamp;
        user[investor].amount = _user.amount + amount;

        if (_user.start == 0) user[investor].start = block.timestamp;

        require(
            IERC20(stakedToken).transferFrom(investor, address(this), amount),
            "Staking: deposited tokens didn`t transfer"
        );
    }

    function calculateRewards(address investor)
        public
        view
        initiated
        returns (uint256 rewards)
    {
        UserInfo memory _user = user[investor];

        rewards =
            (N * _user.amount * (block.timestamp - lastUpdate)) /
            staked +
            (globalKoeff * _user.amount) /
            DECIMAL -
            _user.userArg;
    }

    function claim() public initiated nonReentrant {
        address investor = msg.sender;
        UserInfo memory _user = user[investor];

        require(_user.amount > 0, "Staking: User has no deposits");

        uint256 rewards = calculateRewards(investor);
        user[investor].userArg = _user.userArg + rewards;

        require(
            IERC20(rewardToken).transfer(investor, rewards),
            "Staking: reward didn`t transfer"
        );
    }

    function withdraw(uint256 amount) external initiated nonReentrant {
        address investor = msg.sender;
        UserInfo memory _user = user[investor];

        require(_user.amount > 0, "Staking: User has no deposits");
        require(amount > 0, "Staking: it is not allowed to remove zero tokens");
        require(
            _user.amount >= amount,
            "Staking: attemp to withdraw more than there is"
        );
        
        globalKoeff += (DECIMAL * N * (block.timestamp - lastUpdate)) / staked;
        staked -= amount;
        user[investor].amount = _user.amount - amount;
        user[investor].userArg =
            ((_user.amount - amount) * globalKoeff) /
            DECIMAL;
        lastUpdate = block.timestamp;
        
        uint256 feeToDeadWallet;
        uint256 feeToDevWallet;
        uint256 rewards = calculateRewards(investor);
        
        if(block.timestamp - _user.start < LOCK_UP) {
            feeToDeadWallet = amount*3/100;
            feeToDevWallet = amount*3/100;
            amount -= feeToDeadWallet;
            amount -= feeToDevWallet;
        }

        if(feeToDeadWallet != 0){
            require(
                IERC20(stakedToken).transfer(DEAD_WALLET, feeToDeadWallet),
                "Staking: fee tokens to dead_wallet didn`t transfer"
            );
        }
        if(feeToDevWallet != 0){
            require(
                IERC20(stakedToken).transfer(devWallet, feeToDevWallet),
                "Staking: fee tokens to devWallet didn`t transfer"
            );
        }
        require(
            IERC20(rewardToken).transfer(investor, rewards),
            "Staking: reward didn`t transfer"
        );
        require(
            IERC20(stakedToken).transfer(investor, amount),
            "Staking: removed tokens didn`t transfer"
        );
    }
}
