// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/Context.sol";

contract StakingReward is Context, Initializable{
    
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

    event DepositTokenForUser(
        address investor,
        uint256 amountStaked,
        uint256 start
    );

    event ClaimForUser(
        address investor,
        uint256 amountRewarded
    );

    event WithdrawForUser(
        address investor,
        uint256 amountStaked,
        uint256 amountRewarded,
        uint256 feeTodev,
        uint256 feeToDead
    );

    modifier contractWasInitiated() {
        require(token_speed > 0, "Staking: not init");

        _;
    }

    /**
     * @param _stakedToken token for staking
     * @param _rewardToken token for rewarding
     * @param _devWallet address for devWallet
     * @param _period duration of staking process 
     */
    function initStaking(address _stakedToken,
        address _rewardToken,
        address _devWallet,
        uint256 _period) external initializer 
    {  
        
        require(
            _rewardToken != address(0) &&
            _stakedToken != address(0) &&
            _period > 0 &&
            _devWallet != address(0),
            "Staking: Uncorrect data for init"
        );

        uint256 balance = IERC20(_rewardToken).balanceOf(address(this));
        require(
            balance > 0 ,
            "Staking: Uncorrect data for init"
        );

        rewardToken = _rewardToken;
        stakedToken = _stakedToken;
        devWallet = _devWallet;
        token_speed = balance * DECIMAL / _period;

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
        UserInfo memory _user = users[investor];

        if (lastUpdate != 0) {
            globalKoeff +=
                (token_speed * (block.timestamp - lastUpdate)) /
                stakedSum;

            users[investor].unwantedReward =
                _user.unwantedReward +
                _amount * globalKoeff;
        }

        stakedSum += _amount;
        lastUpdate = block.timestamp;
        users[investor].amount = _user.amount + _amount;

        if (_user.start == 0) users[investor].start = block.timestamp;

        require(
            IERC20(stakedToken).transferFrom(investor, address(this), _amount),
            "Staking: deposited !transfer"
        );

        emit DepositTokenForUser( investor, _amount, users[investor].start);

    }

    /**
     * @param _investor address of user
     * @return amount of tokens in stake
     * @return start is when user staked first time
     */
    function getUserInfo(address _investor) external view returns (uint256 amount, uint256 start)
    {
        amount = users[_investor].amount;
        start = users[_investor].start;
    }

    
    function getPoolInfo() external view returns (
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

    /**
     * @param _amount tokens for withdrawing
    */
    function withdraw(uint256 _amount) public contractWasInitiated {
        
        address investor = _msgSender();
        UserInfo memory _user = users[investor];

        require(_user.amount > 0, "Staking: _user.amount > 0");
        require(_amount > 0, "Staking: amount > 0");
        require(_user.amount >= _amount, "Staking: _user.amount >= amount");

        uint256 rewards = calculateRewards(investor)/DECIMAL;
        
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
            ((_user.amount - _amount) * globalKoeff);
        lastUpdate = stamp;
        
        uint256 toDead;
        uint256 toDev;
        if (block.timestamp - _user.start < LOCK_UP_PERIOD) {
            toDead = (_amount * 3) / 100;
            toDev = (_amount * 3) / 100;
            _amount -= toDead;
            _amount -= toDev;
        }

        transferTokens(stakedToken, DEAD_WALLET, toDead);
        transferTokens(stakedToken, devWallet, toDev);
        transferTokens(rewardToken, investor, rewards);
        transferTokens(stakedToken, investor, _amount);

        emit WithdrawForUser( investor, _amount, rewards, toDev, toDead);
    }

    /**
     * @param _investor address of user
     * @return rewards for user
    */
    function calculateRewards(address _investor)
        public
        view
        contractWasInitiated
    returns (uint256 rewards) {
        
        uint256 stamp;
        if (block.timestamp - startProcess < YEAR) {
            stamp = block.timestamp;
        } else {
            stamp = startProcess + YEAR;
        }

        UserInfo memory _user = users[_investor];

        rewards = ((token_speed * _user.amount * (stamp - lastUpdate))/stakedSum +
            (globalKoeff * _user.amount)); 
        rewards = rewards - _user.unwantedReward;

    }

    function claim() public contractWasInitiated {
        
        address investor = _msgSender();
        UserInfo memory _user = users[investor];

        require(_user.amount > 0, "Staking: deposit == 0");

        uint256 rewards = calculateRewards(investor);
        
        require(rewards > 0, 'Staking: rewards != 0');

        users[investor].unwantedReward = _user.unwantedReward + rewards;
        rewards = rewards/DECIMAL;

        if (block.timestamp - startProcess >= YEAR) {
            withdraw(_user.amount);
        } 

        transferTokens(rewardToken, investor, rewards);

        emit ClaimForUser(investor, rewards);
    }

    function transferTokens(address _token, address _investor, uint256 _amount) private {
        
        if( _amount > 0 ) {
            require(
                IERC20(_token).transfer(_investor, _amount),
                "Staking: reward !transfer"
            );
        }

    }

}
