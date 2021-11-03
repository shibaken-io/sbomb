const {
  BN
} = require('@openzeppelin/test-helpers');

const YEAR = new BN((60 * 60 * 24 * 30 * 12).toString())
const REWARDS = new BN((60 * 60 * 24 * 30 * 12 * 10 ** 18).toString())
const Staking = artifacts.require("StakingReward");
const TestToken = artifacts.require("TestToken");

module.exports = async function (deployer, network, accounts) {
  deployer.deploy(TestToken, 'TEST_reward', 'T_r', {from:accounts[0]})
  let reward = await TestToken.deployed()
  deployer.deploy(TestToken, 'TEST_staked', 'T_s', {from:accounts[0]})
  let staked = await TestToken.deployed()

  //await reward.approve(Staking.address, REWARDS, {from: owner})
        
  deployer.deploy(Staking);
};
