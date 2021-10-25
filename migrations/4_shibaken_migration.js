const Shibaken = artifacts.require("ShibaKen");

require('dotenv').config();

const {
    RECIPIENT
} = process.env;

module.exports = async (deployer, network, accounts) => {
    await deployer.deploy(Shibaken);
    let shibakenInstance = await Shibaken.deployed();

    console.log("ShibaKen token address: ", shibakenInstance.address);

    let recipient;

    if(network == "test" || network == "develop"){
        recipient = RECIPIENT;
    }
    else {
        recipient = accounts[0];
    }
    
    await shibakenInstance.initialize(recipient);
  };