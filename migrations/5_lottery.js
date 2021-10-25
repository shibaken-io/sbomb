const BN = require('bn.js');

require('dotenv').config();

const {
    VRF_COORDINATOR,
    LINK_ADDRESS,
    KEY_HASH,
    FEE,
    VALID_AMOUNT
} = process.env;

const Lottery = artifacts.require("Lottery");

const debug = "true";

const ZERO = new BN(0);
const ONE = new BN(1);
const TWO = new BN(2);
const THREE = new BN(3);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports = async function (deployer, network) {
    if (network == "test" || network == "development")
        return;

    await deployer.deploy(
        Lottery, VRF_COORDINATOR, LINK_ADDRESS, KEY_HASH, FEE, VALID_AMOUNT
    );
    let LotteryInst = await Lottery.deployed();
    console.log("Lottery =", LotteryInst.address);
};