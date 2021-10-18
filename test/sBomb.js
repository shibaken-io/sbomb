const { expect } = require('chai');
const { BN, expectEvent, expectRevert, makeInterfaceId, time } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { Contract } = require('web3-eth-contract');
//const { assert } = require('console');

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
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD";

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

        let sBombToken, shibakenToken, sBombEthLP, sBombShibakenLP, testToken;

        beforeEach(async()=>{
            sBombToken = await SBombToken.deployed();
            shibakenToken = await TestToken.deployed();
            testToken = await TestToken.new("TestToken", "TEST", {from: user1});

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

            //await sBombToken.setDexRouter(pancakeRouterInstant.address);
            await sBombToken.approve(pancakeRouterInstant.address, ONE_HUNDRED_TOKENS.mul(TWO));
            await shibakenToken.approve(pancakeRouterInstant.address, ONE_HUNDRED_TOKENS);
            let now = await time.latest();
            await pancakeRouterInstant.addLiquidityETH(
                sBombToken.address,
                ONE_HUNDRED_TOKENS,
                ZERO,
                ZERO,
                deployer,
                now.add(time.duration.minutes(15)),
                {value: ONE_TOKEN.mul(TEN)}
            );
            await pancakeRouterInstant.addLiquidity(
                sBombToken.address,
                shibakenToken.address,
                ONE_HUNDRED_TOKENS,
                ONE_HUNDRED_TOKENS,
                ZERO,
                ZERO,
                deployer,
                now.add(time.duration.minutes(15))
            );

            await sBombToken.transfer(user1, ONE_HUNDRED_TOKENS);
            await sBombToken.approve(pancakeRouterInstant.address, ONE_HUNDRED_TOKENS, {from: user1});
            await testToken.approve(pancakeRouterInstant.address, ONE_HUNDRED_TOKENS, {from: user1});
            await pancakeRouterInstant.addLiquidity(
                sBombToken.address,
                testToken.address,
                ONE_HUNDRED_TOKENS,
                ONE_HUNDRED_TOKENS,
                ZERO,
                ZERO,
                deployer,
                now.add(time.duration.minutes(15)),
                {from: user1}
            );

            sBombEthLP = await pancakeFactoryInstant.getPair(wethInst.address, sBombToken.address);
            sBombEthLP = await PancakePair.at(sBombEthLP);
            sBombShibakenLP = await pancakeFactoryInstant.getPair(sBombToken.address, shibakenToken.address);
            sBombShibakenLP = await PancakePair(sBombShibakenLP);

            await sBombToken.setDexRouter(pancakeRouterInstant.address);
        })

        it("#0 - initial checking", async()=>{
            expect(await shibakenToken.balanceOf(DEAD_ADDRESS)).bignumber.equal(ZERO);
            expect(await sBombEthLP.balanceOf(DEAD_ADDRESS)).bignumber.equal(ZERO);
            let lotteryBalance = await web3.eth.getBalance(lottery);
            let teamBalance = await web3.eth.getBalance(team);
            assert.equal(lotteryBalance.toString(),ONE_HUNDRED_TOKENS.toString());
            assert.equal(teamBalance.toString(),ONE_HUNDRED_TOKENS.toString());
        })

        it("#1 - transfer between usual addresses", async()=>{
            expect(await sBombToken.balanceOf(user1)).bignumber.equal(ZERO);

            const lotteryEthBalanceBefore = await web3.eth.getBalance(lottery);
            const teamEthBalanceBefore = await web3.eth.getBalance(team);
            sBombToken.transfer(user1, ONE_HUNDRED_TOKENS, {from: deployer});
            const lotteryEthBalanceAfter = await web3.eth.getBalance(lottery);
            const teamEthBalanceAfter = await web3.eth.getBalance(team);
            expect(await shibakenToken.balanceOf(DEAD_ADDRESS)).bignumber.equal(ZERO);
            expect(await sBombEthLP.balanceOf(DEAD_ADDRESS)).bignumber.equal(ZERO);
            assert.equal(lotteryEthBalanceAfter - lotteryEthBalanceBefore, 0);
            assert.equal(teamEthBalanceAfter - teamEthBalanceBefore, 0);
        })
    
        /* it("#2 - trying to BUY sBomb token on DEX", async()=>{
            //console.log("Router address : ",await sBombToken.dexRouter.call());

            let amounts = await pancakeRouterInstant.getAmountsOut(ONE_HALF_TOKEN, [wethInst.address, sBombToken.address]);

            console.log(await sBombToken.pairAddress.call());

            const lotteryEthBalanceBefore = await web3.eth.getBalance(lottery);
            let now = await time.latest();
            let receipt = await pancakeRouterInstant.swapExactETHForTokens(
                ZERO,
                [wethInst.address, sBombToken.address],
                user2,
                now.add(time.duration.minutes(15)),
                {value: ONE_HALF_TOKEN,
                from: user2}
            );
            //expect(amounts[1]).bignumber.equal(await sBombToken.balanceOf(user2));
            await expectEvent(receipt, "BuyTaxTaken");
            const lotteryEthBalanceAfter = await web3.eth.getBalance(lottery);
            assert.equal(lotteryEthBalanceAfter - lotteryEthBalanceBefore, amounts[1].mul(FIVE).div(ONE_HUNDRED));
            expect(await shibakenToken.balanceOf(DEAD_ADDRESS)).bignumber.equal(amounts[1].div(ONE_HUNDRED));
        }) */

        /* it("#3 - trying to swap to another token", async()=>{
            const lotteryEthBalanceBefore = await web3.eth.getBalance(lottery);
            await testToken.approve(pancakeRouterInstant.address, ONE_HALF_TOKEN, {from:user1});
            let now = await time.latest();
            let receipt = await pancakeRouterInstant.swapExactTokensForTokens(
                ONE_HALF_TOKEN,
                ZERO,
                [testToken.address, sBombToken.address],
                user1,
                now.add(time.duration.minutes(15)),
                {from: user1}
            );
            //console.log(receipt);
            //console.log(await pancakeFactoryInstant.getPair(sBombToken.address, testToken.address));
            await expectEvent(receipt, "BuyTaxTaken");
        }) */

        it("_pairCheck() test", async()=>{
            const pairAddress = await pancakeFactoryInstant.getPair(sBombToken.address, testToken.address);

            assert.equal(await sBombToken._pairCheck(pairAddress), true);
            assert.equal(await sBombToken._pairCheck(user1), false);
        })
    }
)