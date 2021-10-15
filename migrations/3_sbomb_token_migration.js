const TestToken = artifacts.require("TestToken");
const sBombToken = artifacts.require("sBombToken");

require('dotenv').config();

const {
    SHIBAKEN, 
    DEX_ROUTER, 
    LOTTERY_CONTRACT, 
    TEAM_WALLET
} = process.env;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports = async function(deployer, network, accounts) {
    let shibakenToken;
    let lotteryContract;
    let teamWallet;
    let dexRouter;

    if(network == "develop" || network == "test"){
        shibakenToken = await TestToken.deployed();
        shibakenToken = shibakenToken.address;
        lotteryContract = accounts[1];
        teamWallet = accounts[2];
        dexRouter = ZERO_ADDRESS;
    }
    else {
        shibakenToken = SHIBAKEN;
        lotteryContract = LOTTERY_CONTRACT;
        teamWallet = TEAM_WALLET;
        dexRouter = DEX_ROUTER;
    }

    const sBombTokenInst = await deployer.deploy(sBombToken, shibakenToken, dexRouter);
    console.log("sBomb Token address: ", sBombTokenInst.address);

    await sBombTokenInst.setLotteryContarct(lotteryContract);
    await sBombTokenInst.changeTeamWallet(teamWallet);
};