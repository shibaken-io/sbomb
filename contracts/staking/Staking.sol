// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract Staking is ReentrancyGuard {

    struct UserInfo {
        uint256 amount; // amount of staked tokens
        uint256 rewardGot; // not actual only for formuls
    }

    mapping(address => UserInfo) user;
    
    address public rewardToken;
    address public stakedToken;
    
    uint256 public staked; 
    uint256 private globalKoeff;
    uint256 private lastDeposit;
    uint256 private N;

    uint256 decimal = 10**18;

    function init(address stToken, address rewToken) external {
        rewardToken = rewToken;
        stakedToken = stToken;
        N = IERC20(rewardToken).balanceOf(address(this))/(60*60*24*30*12);
    } 

    function getUserInfo(address investor) external view returns( uint256 amount, uint256 rewardGot){
        amount = user[investor].amount;
        rewardGot = user[investor].rewardGot;
    }

    function getGlobal() external view returns(uint256 amount){
        amount = globalKoeff;
    }

    function deposit(uint256 amount) external nonReentrant {
        address investor = msg.sender;
        
        require(amount > 0, "Staking: it is not allowed to stake zero tokens");
        
        staked += amount;
        
        if( lastDeposit != 0) {
            globalKoeff += decimal*N*(block.timestamp - lastDeposit)/staked;
            user[investor].rewardGot += amount*globalKoeff/decimal;
        }
        
        lastDeposit = block.timestamp;
        user[investor].amount += amount;

        require(
                IERC20(stakedToken).transferFrom(
                investor,
                address(this),
                amount
            ),
            "Staking: deposited tokens didn`t transfer"
        );

    }

    function claim() public nonReentrant {
       
        address investor = msg.sender;
        UserInfo memory _user = user[investor];
    
        uint256 rewardsGot = _user.rewardGot;
        uint256 rewards = (N*_user.amount*(block.timestamp - lastDeposit))/staked;
        rewards = rewards + globalKoeff*_user.amount/decimal;
        rewards = rewards - rewardsGot;
        user[investor].rewardGot = rewardsGot + rewards;

        require(
            IERC20(rewardToken).transfer(investor, rewards),
            "Staking: reward didn`t transfer"
        );

    }

    function withdraw(uint256 amount) external nonReentrant {
        address investor = msg.sender;
        
        require(amount > 0, "Staking: it is not allowed to remove zero tokens");

        staked -= amount;
        globalKoeff += decimal*N*(block.timestamp - lastDeposit)/staked;
        user[investor].amount -= amount;
        user[investor].rewardGot = user[investor].amount*N*(block.timestamp - lastDeposit)/staked; 
        lastDeposit = block.timestamp; //lastUpdate

        require(
                IERC20(stakedToken).transfer(investor, amount),
                "Staking: removed tokens didn`t transfer"
        );
    }
}