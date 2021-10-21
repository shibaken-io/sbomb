const Staking = artifacts.require("Staking");
const TestToken = artifacts.require("TestToken");

module.exports = function (deployer, network, accounts) {
  deployer.deploy(TestToken, 'TEST_reward', 'T_r', {from:accounts[0]})
  deployer.deploy(TestToken, 'TEST_staked', 'T_s', {from:accounts[0]})
  deployer.deploy(Staking);
};
