// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract StakingReward is Context {
    uint256 private constant DECIMAL = 10**18;
    uint256 private constant LOCK_UP_PERIOD = 60 * 60 * 24 * 30;
    uint256 private constant YEAR = 60 * 60 * 24 * 30 * 12;
    address private constant DEAD_WALLET =
        0x000000000000000000000000000000000000dEaD;

    address public stakedToken;
    address public rewardToken;
    address public devWallet;
    uint256 public stakedSum;

    uint256 private globalKoeff;
    uint256 private startProcess;
    uint256 private lastUpdate;
    uint256 private token_speed;

    mapping(address => UserInfo) private users;

    struct UserInfo {
        uint256 amount;
        uint256 start;
        uint256 unwantedReward; // amount of rewards which user should not get next time
    }

    constructor(
        address _stakedToken,
        address _rewardToken,
        address _devWallet,
        uint256 _amount,
        uint256 _period
    ) {
        require(
            _rewardToken != address(0) &&
                _stakedToken != address(0) &&
                _period > 0 &&
                _amount > 0 &&
                _devWallet != address(0),
            "Staking: Uncorrect data for init"
        );

        rewardToken = _rewardToken;
        stakedToken = _stakedToken;
        devWallet = _devWallet;
        token_speed = (_amount * DECIMAL) / _period;
    }

    function getUserInfo(address _investor)
        external
        view
        returns (uint256 amount, uint256 start)
    {
        amount = users[_investor].amount;
        start = users[_investor].start;
    }

    function getPoolInfo()
        external
        view
        returns (
            address _stakedToken,
            address _devWallet,
            uint256 _globalKoeff,
            uint256 _lastUpdate,
            uint256 _token_speed,
            uint256 _stakedSum
        )
    {
        _stakedToken = stakedToken;
        _devWallet = devWallet;
        _globalKoeff = globalKoeff;
        _lastUpdate = lastUpdate;
        _token_speed = token_speed;
        _stakedSum = stakedSum;
    }

    function deposit(uint256 _amount) external {
        require(_amount > 0, "Staking: ammount == 0");

        if (startProcess == 0) startProcess = block.timestamp;
        else {
            require(
                block.timestamp - startProcess < YEAR,
                "Staking: out of time"
            );
        }

        address investor = _msgSender();

        UserInfo memory _user = users[investor];

        if (lastUpdate != 0) {
            globalKoeff +=
                (token_speed * (block.timestamp - lastUpdate)) /
                stakedSum;

            users[investor].unwantedReward =
                _user.unwantedReward +
                ((_amount * globalKoeff) / DECIMAL);
        }

        stakedSum += _amount;
        lastUpdate = block.timestamp;
        users[investor].amount = _user.amount + _amount;

        if (_user.start == 0) users[investor].start = block.timestamp;

        require(
            IERC20(stakedToken).transferFrom(investor, address(this), _amount),
            "Staking: deposited !transfer"
        );
    }

    function withdraw(uint256 _amount) external {
        address investor = _msgSender();

        UserInfo memory _user = users[investor];

        require(_user.amount > 0, "Staking: _user.amount > 0");
        require(_amount > 0, "Staking: amount > 0");
        require(_user.amount >= _amount, "Staking: _user.amount >= amount");

        uint256 rewards = calculateRewards(investor);
        
        uint256 stamp;
       
        if (block.timestamp - startProcess < YEAR) {
            stamp = block.timestamp;
        } else {
            stamp = startProcess + YEAR;
        }
         
        globalKoeff +=
            (token_speed * (stamp - lastUpdate)) /
            stakedSum;
        stakedSum -= _amount;
        users[investor].amount = _user.amount - _amount;
        users[investor].unwantedReward =
            ((_user.amount - _amount) * globalKoeff) /
            DECIMAL;

       
        lastUpdate = stamp;
        

        uint256 toDead;
        uint256 toDev;
        if (block.timestamp - _user.start < LOCK_UP_PERIOD) {
            toDead = (_amount * 3) / 100;
            toDev = (_amount * 3) / 100;
            _amount -= toDead;
            _amount -= toDev;
        }

        if (toDead != 0) {
            require(
                IERC20(stakedToken).transfer(DEAD_WALLET, toDead),
                "Staking: fee !transfer"
            );
        }
        if (toDev != 0) {
            require(
                IERC20(stakedToken).transfer(devWallet, toDev),
                "Staking: fee !transfer"
            );
        }
        if (rewards != 0) {
            require(
                IERC20(rewardToken).transfer(investor, rewards),
                "Staking: reward !transfer"
            );
        }

        require(
            IERC20(stakedToken).transfer(investor, _amount),
            "Staking: removed  !transfer"
        );
    }

    function calculateRewards(address _investor)
        public
        view
        returns (uint256 rewards)
    {
        uint256 stamp;

        if (block.timestamp - startProcess < YEAR) {
            stamp = block.timestamp;
        } else {
            stamp = startProcess + YEAR;
        }

        UserInfo memory _user = users[_investor];
        uint256 time = (stamp - lastUpdate);
        rewards = (token_speed * _user.amount * time) /
            (DECIMAL * stakedSum) +
            (globalKoeff * _user.amount) /
            DECIMAL -
            _user.unwantedReward;
    }

    function claim() public {
        address investor = _msgSender();

        UserInfo memory _user = users[investor];

        require(_user.amount > 0, "Staking: deposit == 0");

        uint256 rewards = calculateRewards(investor);
        users[investor].unwantedReward = _user.unwantedReward + rewards;

        require(
            IERC20(rewardToken).transfer(investor, rewards),
            "Staking: reward !transfer"
        );
    }
}
