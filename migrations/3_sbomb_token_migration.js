const sBombToken = artifacts.require("sBombToken");

require('dotenv').config();

const {
    SHIBAKEN, 
    DEX_ROUTER, 
    TIME_BOMB_CONTRACT, 
    TEAM_WALLET
} = process.env;


module.exports = async function(deployer, network, accounts) {
    let shibakenToken;
    let timeBombContarct;
    let teamWallet;
    let dexRouter;

    if(network == "develop" || network == "test"){
        return;
    }
    else {
        shibakenToken = SHIBAKEN;
        timeBombContarct = TIME_BOMB_CONTRACT;
        teamWallet = TEAM_WALLET;
        dexRouter = DEX_ROUTER;
    }

    await deployer.deploy(sBombToken, shibakenToken, dexRouter);
    let sBombTokenInst = await sBombToken.deployed();
    console.log("sBomb Token address: ", sBombTokenInst.address);

    await sBombTokenInst.setTimeBombContarct(timeBombContarct);
    await sBombTokenInst.changeTeamWallet(teamWallet);
};