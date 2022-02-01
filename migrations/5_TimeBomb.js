const BN = require('bn.js');

require('dotenv').config();

const {
    VRF_COORDINATOR,
    LINK_ADDRESS,
    KEY_HASH,
    FEE,
    VALID_AMOUNT,
    SBOMB
} = process.env;

const TimeBomb = artifacts.require("TimeBomb");

const debug = "true";

const ZERO = new BN(0);
const ONE = new BN(1);
const TWO = new BN(2);
const THREE = new BN(3);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

module.exports = async function (deployer, network) {
    if (network == "test" || network == "development" || network == "develop")
        return;

    await deployer.deploy(
        TimeBomb, VRF_COORDINATOR, LINK_ADDRESS, KEY_HASH, FEE, VALID_AMOUNT, SBOMB
    );
    let TimeBombInst = await TimeBomb.deployed();
    console.log("TimeBomb =", TimeBombInst.address);
};