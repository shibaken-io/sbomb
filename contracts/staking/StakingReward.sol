// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract StakingReward is Context, Ownable, Initializable {
    address public stakedToken;
    address public rewardToken;
    address public devWallet;
    uint256 public stakedSum;

    uint256 private globalCoefficient;
    uint256 private startProcess;
    uint256 private lastUpdate;
    uint256 private tokenRate;
    uint256 private holdersAmount;
    uint256 private campaignDuration;

    uint256 private constant percentToDev = 3;
    uint256 private constant percentToDead = 3;
    uint256 private constant PERCENT_BASE = 100;

    uint256 private constant MULTIPLIER = 10**20;
    uint256 private constant LOCK_UP_PERIOD = 60 * 60 * 24 * 30;
    uint256 private constant YEAR = 60 * 60 * 24 * 30 * 12;
    address private constant DEAD_WALLET =
        0x000000000000000000000000000000000000dEaD;

    mapping(address => UserInfo) private users;

    struct UserInfo {
        uint256 amount;
        uint256 start;
        uint256 globalCoefficientMinus;
        int256 assignedReward;
    }

    event DepositTokenForUser(
        address investor,
        uint256 amountStaked,
        uint256 start
    );

    event ClaimForUser(address investor, uint256 amountRewarded);

    event WithdrawForUser(address investor, uint256 amountStaked);

    event OwnerGotTokens(address to, uint256 amount);

    event EmergencyExit(uint256 amount);

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
        campaignDuration = _period;
    }

    /**
     * @param _amount tokens for depositing
     */
    function deposit(uint256 _amount) external contractWasInitiated {
        require(_amount > 0, "Staking: amount == 0");

        if (startProcess == 0) startProcess = block.timestamp;
        else {
            require(
                block.timestamp - startProcess < campaignDuration,
                "Staking: out of time"
            );
        }

        uint256 amountBefore = IERC20(stakedToken).balanceOf(address(this));
        address investor = _msgSender();

        if (users[investor].amount == 0) {
            holdersAmount += 1;
            if (users[investor].start == 0)
                users[investor].start = block.timestamp;
        }

        require(
            IERC20(stakedToken).transferFrom(investor, address(this), _amount),
            "Staking: deposited !transfer"
        );

        _amount = IERC20(stakedToken).balanceOf(address(this)) - amountBefore;
        updateVars(investor, int256(_amount));

        emit DepositTokenForUser(investor, _amount, users[investor].start);
    }

    /**
     * @param _amount tokens for withdrawing
     */
    function withdraw(uint256 _amount) external contractWasInitiated {
        address investor = _msgSender();
        UserInfo memory _user = users[investor];

        require(_amount > 0, "Staking: amount > 0");
        require(_user.amount >= _amount, "Staking: _user.amount >= amount");

        updateVars(investor, (-1) * int256(_amount));

        if (block.timestamp - _user.start < LOCK_UP_PERIOD) {
            uint256 toDead;
            uint256 toDev;
            toDead = (_amount * percentToDead) / PERCENT_BASE;
            toDev = (_amount * percentToDev) / PERCENT_BASE;
            _amount -= toDead;
            _amount -= toDev;

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
        }

        require(
            IERC20(stakedToken).transfer(investor, _amount),
            "Staking: !transfer"
        );

        if (users[investor].amount == 0) {
            if (getReward(investor) > 0) claim();
            if (block.timestamp - startProcess <= campaignDuration)
                holdersAmount -= 1;
        }

        if (
            stakedSum == 0 && block.timestamp - startProcess < campaignDuration
        ) {
            campaignDuration =
                campaignDuration -
                (block.timestamp - startProcess);
            startProcess = 0;
        }

        emit WithdrawForUser(investor, _amount);
    }

    function claim() public contractWasInitiated {
        address investor = _msgSender();
        UserInfo memory _user = users[investor];

        uint256 multiplier = MULTIPLIER;
        int256 rewards = calculateReward(investor);

        require(rewards > 0, "Staking: rewards != 0");

        uint256 amountForTransfer;

        if (block.timestamp - startProcess <= campaignDuration)
            amountForTransfer = uint256(
                rewards / int256(multiplier * multiplier)
            );
        else {
            holdersAmount -= 1;
            if (holdersAmount == 0) {
                amountForTransfer = IERC20(rewardToken).balanceOf(
                    address(this)
                );
            } else {
                amountForTransfer = uint256(
                    rewards / int256(multiplier * multiplier)
                );
            }
        }

        require(
            IERC20(rewardToken).transfer(investor, amountForTransfer),
            "Staking: reward !transfer"
        );
        users[investor].assignedReward = _user.assignedReward - rewards;
        emit ClaimForUser(investor, amountForTransfer);
    }

    /**
     * @param _investor address of user
     * @return rewards next rewards for investor
     */
    function getReward(address _investor) public view returns (int256 rewards) {
        uint256 multiplier = MULTIPLIER;
        rewards = calculateReward(_investor);
        rewards = (rewards / int256(multiplier * multiplier));
    }

    /**
     * @param _to user for transfering
     */
    function getTokensForOwner(address _to) external onlyOwner {
        uint256 balance = IERC20(stakedToken).balanceOf(address(this));
        require(balance > stakedSum, "Staking:balance <= stakedSum");
        uint256 amount = balance - stakedSum;
        if (amount > 0) {
            require(
                IERC20(stakedToken).transfer(_to, amount),
                "Staking: !transfer"
            );
        }
        emit OwnerGotTokens(_to, amount);
    }

    function emergencyExit() external onlyOwner {
        uint256 amount = IERC20(rewardToken).balanceOf(address(this));
        if (amount > 0) {
            require(
                IERC20(rewardToken).transfer(owner(), amount),
                "Staking: !transfer"
            );
        }
        emit EmergencyExit(amount);
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
            int256 assignedReward
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
            uint256 _stakedSum,
            uint256 _holdersAmount
        )
    {
        _stakedToken = stakedToken;
        _devWallet = devWallet;
        _globalCoefficient = globalCoefficient;
        _lastUpdate = lastUpdate;
        _tokenRate = tokenRate;
        _stakedSum = stakedSum;
        _holdersAmount = holdersAmount;
    }

    function calculateReward(address investor)
        internal
        view
        returns (int256 rewards)
    {
        UserInfo memory _user = users[investor];
        uint256 stamp = getStamp();
        if (stakedSum != 0)
            rewards = int256(
                (_user.amount * tokenRate * (stamp - lastUpdate) * MULTIPLIER) /
                    stakedSum
            );
        rewards =
            rewards +
            _user.assignedReward +
            int256(
                _user.amount *
                    tokenRate *
                    (globalCoefficient - _user.globalCoefficientMinus)
            );
    }

    function updateVars(address investor, int256 _amount) private {
        uint256 stamp = getStamp();
        users[investor].assignedReward = calculateReward(investor);
        if (stakedSum != 0)
            globalCoefficient +=
                ((stamp - lastUpdate) * MULTIPLIER) /
                stakedSum;
        users[investor].globalCoefficientMinus = globalCoefficient;
        users[investor].amount = uint256(
            int256(users[investor].amount) + _amount
        );
        stakedSum = uint256(int256(stakedSum) + _amount);
        lastUpdate = stamp;
    }

    function getStamp() private view returns (uint256 stamp) {
        if (block.timestamp - startProcess < campaignDuration) {
            stamp = block.timestamp;
        } else {
            stamp = startProcess + campaignDuration;
        }
    }
}
