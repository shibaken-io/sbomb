const { expect } = require('chai');
const { BN, expectEvent, expectRevert, makeInterfaceId, time } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { Contract } = require('web3-eth-contract');

//pancake artifacts
const WETH = artifacts.require('WETH');
let wethInst;
const PancakeFactory = artifacts.require('PancakeFactory');
let pancakeFactoryInstant;
const PancakeRouter = artifacts.require('PancakeRouter');
let pancakeRouterInstant;
const PancakePair = artifacts.require('PancakePair');
let pancakePairInstant;

const SBombToken = artifacts.require("sBombToken");
const TestToken = artifacts.require("TestToken");

const MINUS_ONE = new BN(-1);
const ZERO = new BN(0);
const ONE = new BN(1);
const TWO = new BN(2);
const THREE = new BN(3);
const FOUR = new BN(4);
const FIVE = new BN(5);
const SIX = new BN(6);
const SEVEN = new BN(7);
const EIGHT = new BN(8);
const NINE = new BN(9);
const TEN = new BN(10);
const ONE_HUNDRED = new BN(100);
const ONE_THOUSAND = new BN(1000);

const DAY = new BN(86400);
const MINUTE = new BN(60);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

const DECIMALS = new BN(18);
const ONE_TOKEN = TEN.pow(DECIMALS);
const ONE_HALF_TOKEN = ONE_TOKEN.div(TWO);
const TWO_TOKEN = ONE_TOKEN.mul(TWO);
const THREE_TOKENS = ONE_TOKEN.mul(THREE);
const TEN_TOKENS = ONE_TOKEN.mul(TEN);
const FIFTY_TOKEN = ONE_TOKEN.mul(FIVE).mul(TEN);
const FIVE_TOKENS = ONE_TOKEN.mul(FIVE);
const SIX_TOKENS = ONE_TOKEN.mul(SIX);
const SEVEN_TOKENS = ONE_TOKEN.mul(SEVEN);
const ONE_HUNDRED_TOKENS = ONE_TOKEN.mul(ONE_HUNDRED);
const ONE_THOUSAND_TOKENS = ONE_TOKEN.mul(ONE_THOUSAND);

contract(
    'sBombToken', 
    (
        [
            deployer, 
            lottery, 
            team, 
            user1, 
            user2, 
            user3
        ]
    ) => {

        let sBombToken, shibakenToken;

        beforeEach(async()=>{
            sBombToken = await SBombToken.deployed();
            shibakenToken = await TestToken.deployed();

            wethInst = await WETH.new(
                { from: deployer }
            );
        
            pancakeFactoryInstant = await PancakeFactory.new(
                deployer,
                { from: deployer }
            );
        
            pancakeRouterInstant = await PancakeRouter.new(
                pancakeFactoryInstant.address,
                wethInst.address,
                { from: deployer }
            );
        }
    )

})