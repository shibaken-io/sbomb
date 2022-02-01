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
        recipient = accounts[0];
    }
    else {
        recipient = RECIPIENT;
    }
    
    await shibakenInstance.initialize(recipient);
  };