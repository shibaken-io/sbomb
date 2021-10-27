// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract StakingReward is Context, Initializable {
    address public stakedToken;
    address public rewardToken;
    address public devWallet;
    uint256 public stakedSum;

    uint256 private globalCoefficient;
    uint256 private startProcess;
    uint256 private lastUpdate;
    uint256 private tokenRate;
    uint256 private amountOfHolders;

    uint256 private constant THREE_PERCENTS = 3;
    uint256 private constant HUNDRED_PERCENTS = 100;

    uint256 private constant MULTIPLIER = 10**18;
    uint256 private constant LOCK_UP_PERIOD = 60 * 60 * 24 * 30;
    uint256 private constant YEAR = 60 * 60 * 24 * 30 * 12;
    address private constant DEAD_WALLET =
        0x000000000000000000000000000000000000dEaD;

    mapping(address => UserInfo) private users;

    struct UserInfo {
        uint256 amount;
        uint256 start;
        uint256 globalCoefficientMinus;
        uint256 assignedReward;
        // uint256 unwantedReward; // amount of rewards which user should not get next time
    }

    event DepositTokenForUser(
        address investor,
        uint256 amountStaked,
        uint256 start
    );

    event ClaimForUser(address investor, uint256 amountRewarded);

    event WithdrawForUser(
        address investor,
        uint256 amountStaked,
        uint256 feeTodev,
        uint256 feeToDead
    );

    modifier contractWasInitiated() {
        require(tokenRate > 0, "Staking: not init");

        _;
    }

    /**
     * @param _stakedToken token for staking
     * @param _rewardToken token for rewarding
     * @param _devWallet address for devWallet
     * @param _period duration of staking process
     */
    function initStaking(
        address _stakedToken,
        address _rewardToken,
        address _devWallet,
        uint256 _period
    ) external initializer {
        require(
            _rewardToken != address(0) &&
                _stakedToken != address(0) &&
                _period > 0 &&
                _devWallet != address(0),
            "Staking: Uncorrect data for init"
        );

        uint256 balance = IERC20(_rewardToken).balanceOf(address(this));
        require(balance > 0, "Staking: Uncorrect data for init");

        rewardToken = _rewardToken;
        stakedToken = _stakedToken;
        devWallet = _devWallet;
        tokenRate = (balance * MULTIPLIER) / _period;
    }

    /**
     * @param _amount tokens for depositing
     */
    function deposit(uint256 _amount) external contractWasInitiated {
        require(_amount > 0, "Staking: amount == 0");

        if (startProcess == 0) startProcess = block.timestamp;
        else {
            require(
                block.timestamp - startProcess < YEAR,
                "Staking: out of time"
            );
        }

        address investor = _msgSender();
        
        if (users[investor].amount == 0) amountOfHolders += 1;
        
        calculateRewards(investor, _amount, 0);
        
        if (users[investor].start == 0) users[investor].start = block.timestamp;
         
        require(
            IERC20(stakedToken).transferFrom(investor, address(this), _amount),
            "Staking: deposited !transfer"
        );

        emit DepositTokenForUser(investor, _amount, users[investor].start);
    }

    /**
     * @param _investor address of user
     * @return amount of tokens in stake
     * @return start is when user staked first time
     */
    function getUserInfo(address _investor)
        external
        view
        returns (
            uint256 amount,
            uint256 start,
            uint256 globalCoefficientMinus,
            uint256 assignedReward
        )
    {
        amount = users[_investor].amount;
        start = users[_investor].start;
        globalCoefficientMinus = users[_investor].globalCoefficientMinus;
        assignedReward = users[_investor].assignedReward;
    }

    function getPoolInfo()
        external
        view
        returns (
            address _stakedToken,
            address _devWallet,
            uint256 _globalCoefficient,
            uint256 _lastUpdate,
            uint256 _tokenRate,
            uint256 _stakedSum
        )
    {
        _stakedToken = stakedToken;
        _devWallet = devWallet;
        _globalCoefficient = globalCoefficient;
        _lastUpdate = lastUpdate;
        _tokenRate = tokenRate;
        _stakedSum = stakedSum;
    }

    function nextReward(address investor)
        external
        view
        returns (uint256 rewards)
    {
        UserInfo memory _user = users[investor];

        uint256 stamp;

        if (block.timestamp - startProcess < YEAR) {
            stamp = block.timestamp;
        } else {
            stamp = startProcess + YEAR;
        }

        if (lastUpdate != 0) {
            rewards = _user.assignedReward;
            if (stakedSum != 0)
                rewards =
                    rewards +
                    ((_user.amount * tokenRate * (stamp - lastUpdate)) *
                        MULTIPLIER) /
                    stakedSum;
            rewards =
                rewards +
                (_user.amount *
                    tokenRate *
                    (globalCoefficient - _user.globalCoefficientMinus));
        }
        rewards = rewards / (MULTIPLIER * MULTIPLIER);
    }

    /**
     * @param _amount tokens for withdrawing
     */
    function withdraw(uint256 _amount) public contractWasInitiated {
        address investor = _msgSender();
        UserInfo memory _user = users[investor];

        require(_user.amount > 0, "Staking: _user.amount > 0");
        require(_amount > 0, "Staking: amount > 0");
        require(_user.amount >= _amount, "Staking: _user.amount >= amount");

        calculateRewards(investor, 0, _amount);

        uint256 toDead;
        uint256 toDev;
        if (block.timestamp - _user.start < LOCK_UP_PERIOD) {
            toDead = (_amount * THREE_PERCENTS) / HUNDRED_PERCENTS;
            toDev = (_amount * THREE_PERCENTS) / HUNDRED_PERCENTS;
            _amount -= toDead;
            _amount -= toDev;
        }

        if (toDead > 0) {
            require(
                IERC20(stakedToken).transfer(DEAD_WALLET, toDead),
                "Staking: !transfer"
            );
        }

        if (toDev > 0) {
            require(
                IERC20(stakedToken).transfer(devWallet, toDev),
                "Staking: !transfer"
            );
        }

        require(
            IERC20(stakedToken).transfer(investor, _amount),
            "Staking: !transfer"
        );

        emit WithdrawForUser(investor, _amount, toDev, toDead);
    }

    function claim() public contractWasInitiated {
        address investor = _msgSender();
        UserInfo memory _user = users[investor];

        calculateRewards(investor, 0, 0);

        uint256 rewards = users[investor].assignedReward;
        users[investor].assignedReward = 0;
        rewards = rewards / (MULTIPLIER * MULTIPLIER);

        if (block.timestamp - startProcess >= YEAR ){
            if (_user.amount > 0) {
                withdraw(_user.amount);
            }
            amountOfHolders -= 1;
        }
        if( amountOfHolders == 0){
            rewards = IERC20(rewardToken).balanceOf(address(this));
        }

        require(rewards > 0, "Staking: rewards != 0");
        
        require(
            IERC20(rewardToken).transfer(investor, rewards),
            "Staking: reward !transfer"
        );

        emit ClaimForUser(investor, rewards);
    }

    function calculateRewards(
        address _investor,
        uint256 _increaseAmount,
        uint256 _decreaseAmount
    ) private contractWasInitiated {
        uint256 stamp;
        if (block.timestamp - startProcess < YEAR) {
            stamp = block.timestamp;
        } else {
            stamp = startProcess + YEAR;
        }

        UserInfo memory _user = users[_investor];

        if (lastUpdate != 0) {
            if (stakedSum != 0)
                users[_investor].assignedReward =
                    _user.assignedReward +
                    ((_user.amount * tokenRate * (stamp - lastUpdate)) *
                        MULTIPLIER) /
                    stakedSum;

            users[_investor].assignedReward =
                users[_investor].assignedReward +
                (_user.amount * tokenRate * globalCoefficient);
            users[_investor].assignedReward =
                users[_investor].assignedReward -
                (_user.amount * tokenRate * _user.globalCoefficientMinus);

            if (stakedSum != 0)
                users[_investor].globalCoefficientMinus =
                    ((stamp - lastUpdate) * MULTIPLIER) /
                    stakedSum +
                    globalCoefficient;
        }

        if (_increaseAmount > 0) {
            if (lastUpdate != 0 && stakedSum != 0)
                globalCoefficient +=
                    ((stamp - lastUpdate) * MULTIPLIER) /
                    stakedSum;
            stakedSum += _increaseAmount;
            lastUpdate = block.timestamp;
            users[_investor].amount = _user.amount + _increaseAmount;
        }

        if (_decreaseAmount > 0) {
            if (lastUpdate != 0)
                globalCoefficient +=
                    ((stamp - lastUpdate) * MULTIPLIER) /
                    stakedSum;
            stakedSum -= _decreaseAmount;
            lastUpdate = stamp;
            users[_investor].amount = _user.amount - _decreaseAmount;
        }
    }
}
