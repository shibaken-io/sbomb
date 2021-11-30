const { expect } = require('chai');
const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');

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
const ShibakenToken = artifacts.require("ShibaKen");
const TimeBomb = artifacts.require("TimeBomb");

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
const ONE_MILLION_TOKENS = ONE_THOUSAND_TOKENS.mul(ONE_THOUSAND);

contract(
    'sBombToken', 
    (
        [
            deployer,
            team, 
            user1, 
            user2, 
            user3,
            charity
        ]
    ) => {

        let sBombToken, shibakenToken, sBombEthLP, sBombShibakenLP, shibakenEthLp, testToken, sBombTestLp, timeBombContract;

        before(async()=>{
            shibakenToken = await ShibakenToken.new();
            console.log("SHIBAKEN: ", shibakenToken.address);
            await shibakenToken.initialize(deployer);
            testToken = await TestToken.new("TestToken", "TEST", {from: user1});
            console.log("TEST TOKEN: ", testToken.address);

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

            sBombToken = await SBombToken.new(shibakenToken.address, pancakeRouterInstant.address, deployer);
            console.log("SBOMB: ", sBombToken.address);
            
            timeBombContract = await TimeBomb.new(deployer, testToken.address, "0x7269746100000000000000000000000000000000000000000000000000000000", ONE, ONE, sBombToken.address);
            console.log("LOTTERY: ", timeBombContract.address);
            const REGISTER_ROLE = await timeBombContract.REGISTER_ROLE.call();
            await timeBombContract.grantRole(REGISTER_ROLE, sBombToken.address);
            await sBombToken.setTimeBombContarct(timeBombContract.address);
            await sBombToken.changeTeamWallet(team);

            console.log("DEX: ",pancakeRouterInstant.address);

            await sBombToken.approve(pancakeRouterInstant.address, ONE_HUNDRED_TOKENS.mul(TWO));
            await shibakenToken.approve(pancakeRouterInstant.address, ONE_HALF_TOKEN);
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
            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);
            await pancakeRouterInstant.addLiquidity(
                sBombToken.address,
                shibakenToken.address,
                ONE_HUNDRED_TOKENS,
                '10000000000',
                ZERO,
                ZERO,
                deployer,
                now.add(time.duration.minutes(15))
            );
            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);

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
            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);

            pancakeRouterInstant.addLiquidityETH(
                shibakenToken.address,
                '10000000000',
                ZERO,
                ZERO,
                deployer,
                now.add(time.duration.minutes(15)),
                {value: ONE_TOKEN.mul(TEN)}
            );

            sBombEthLP = await pancakeFactoryInstant.getPair(wethInst.address, sBombToken.address);
            sBombEthLP = await PancakePair.at(sBombEthLP);
            sBombShibakenLP = await pancakeFactoryInstant.getPair(sBombToken.address, shibakenToken.address);
            sBombShibakenLP = await PancakePair.at(sBombShibakenLP);
            shibakenEthLp = await pancakeFactoryInstant.getPair(wethInst.address, shibakenToken.address);
            shibakenEthLp = await PancakePair.at(shibakenEthLp);
            sBombTestLp = await pancakeFactoryInstant.getPair(sBombToken.address, testToken.address);
            sBombTestLp = await PancakePair.at(sBombTestLp);

            //console.log("TOTAL DISTRIBUTED: ",(await sBombToken.totalDistributed.call()).toString());
            expect(await sBombToken.totalDistributed.call()).bignumber.equal(ZERO);
        })

        it("#1 - transfer between usual addresses", async()=>{
            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);
            expect(await sBombToken.balanceOf(user1)).bignumber.equal(ZERO);
            const deadShibaBalanceBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadSbombEthLpBalanceBefore = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const lotteryEthBalanceBefore = await web3.eth.getBalance(timeBombContract.address);
            const teamEthBalanceBefore = await web3.eth.getBalance(team);
            await sBombToken.transfer(user1, ONE_HUNDRED_TOKENS, {from: deployer});
            expect(await sBombToken.totalDistributed.call()).bignumber.equal(ONE_HUNDRED_TOKENS);
            const lotteryEthBalanceAfter = await web3.eth.getBalance(timeBombContract.address);
            const teamEthBalanceAfter = await web3.eth.getBalance(team);
            const deadShibaBalanceAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadSbombEthLpBalanceAfter = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            assert.equal(lotteryEthBalanceAfter - lotteryEthBalanceBefore, 0);
            assert.equal(teamEthBalanceAfter - teamEthBalanceBefore, 0);
            assert.equal(deadShibaBalanceAfter - deadShibaBalanceBefore, 0);
            assert.equal(deadSbombEthLpBalanceAfter - deadSbombEthLpBalanceBefore, 0);
        })
    
        it("#2 - trying to BUY sBomb token on DEX", async()=>{ 
            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);
            let amountEthToSBomb = await pancakeRouterInstant.getAmountsOut(ONE_HALF_TOKEN, [wethInst.address, sBombToken.address]);
            let amountSBombToSibaken = await pancakeRouterInstant.getAmountsOut(amountEthToSBomb[1].div(ONE_HUNDRED), [sBombToken.address, shibakenToken.address]);
            let amountSBombToShibakenToEth = await pancakeRouterInstant.getAmountsOut(amountEthToSBomb[1].mul(FIVE).div(ONE_HUNDRED).div(TWO), [sBombToken.address, shibakenToken.address, wethInst.address]);
            let amountSbombToLottery = amountEthToSBomb[1].mul(FIVE).div(ONE_HUNDRED).sub(amountEthToSBomb[1].mul(FIVE).div(ONE_HUNDRED).div(TWO));

            const shibakenTokenBalanceBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const lotteryEthBalanceBefore = await web3.eth.getBalance(timeBombContract.address);
            const lotterySbombBalanceBefore = await sBombToken.balanceOf(timeBombContract.address);
            let now = await time.latest();
            await pancakeRouterInstant.swapExactETHForTokens(
                ZERO,
                [wethInst.address, sBombToken.address],
                user2,
                now.add(time.duration.minutes(15)),
                {
                    value: ONE_HALF_TOKEN,
                    from: user2
                }
            );
            const user2sbombBalance = await sBombToken.balanceOf(user2);
            expect(user2sbombBalance).bignumber.equal(amountEthToSBomb[1].mul(new BN(94)).div(ONE_HUNDRED).add(ONE));
            expect(await sBombToken.totalDistributed.call()).bignumber.equal(user2sbombBalance.add(ONE_HUNDRED_TOKENS));
            const lotteryEthBalanceAfter = await web3.eth.getBalance(timeBombContract.address);
            const shibakenTokenBalanceAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const lotterySbombBalanceAfter = await sBombToken.balanceOf(timeBombContract.address);

            let difference = await web3.utils.fromWei((lotteryEthBalanceAfter - lotteryEthBalanceBefore).toString(), 'ether');
            difference = parseFloat(difference).toFixed(2);
            let finalAmount = await web3.utils.fromWei(amountSBombToShibakenToEth[2], 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(2);
            assert.equal(difference, finalAmount);

            difference = await web3.utils.fromWei(lotterySbombBalanceAfter.sub(lotterySbombBalanceBefore), 'ether');
            difference = parseFloat(difference).toFixed(18);
            finalAmount = await web3.utils.fromWei(amountSbombToLottery, 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(18);
            assert.equal(difference, finalAmount);

            difference = await web3.utils.fromWei(shibakenTokenBalanceAfter.sub(shibakenTokenBalanceBefore), 'ether');
            difference = parseFloat(difference).toFixed(2);
            finalAmount = await web3.utils.fromWei(amountSBombToSibaken[1], 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(2);
            assert.equal(difference, finalAmount);
        })

        it("#3 - trying to BUY sBomb token on DEX by TOKEN", async()=>{
            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);
            const lotteryEthBalanceBefore = await web3.eth.getBalance(timeBombContract.address);
            const shibakenBalanceBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const sBombLotteryBalanceBefore = await sBombToken.balanceOf(timeBombContract.address);

            let amounts = await pancakeRouterInstant.getAmountsOut(ONE_HALF_TOKEN, [testToken.address, sBombToken.address]);
            let expectedLotteryFee = await pancakeRouterInstant.getAmountsOut(amounts[1].mul(FIVE).div(ONE_HUNDRED).div(TWO), [sBombToken.address, wethInst.address]);
            let expectedLotteryFeeSbomb = await amounts[1].mul(FIVE).div(ONE_HUNDRED).sub(amounts[1].mul(FIVE).div(ONE_HUNDRED).div(TWO));
            let expectedBurnFee = await pancakeRouterInstant.getAmountsOut(amounts[1].div(ONE_HUNDRED), [sBombToken.address, shibakenToken.address]);
            const sBombBalanceBefore = await sBombToken.balanceOf(user1);
            await testToken.approve(pancakeRouterInstant.address, ONE_HALF_TOKEN, {from:user1});
            let now = await time.latest();
            await pancakeRouterInstant.swapExactTokensForTokens(
                ONE_HALF_TOKEN,
                ZERO,
                [testToken.address, sBombToken.address],
                user1,
                now.add(time.duration.minutes(15)),
                {from: user1}
            );
            const sBombBalanceAfter = await sBombToken.balanceOf(user1);
            expect(await sBombToken.totalDistributed.call()).bignumber.equal((await sBombToken.balanceOf(user2)).add(sBombBalanceAfter));
            let difference = await web3.utils.fromWei(sBombBalanceAfter.sub(sBombBalanceBefore), 'ether');
            difference = parseFloat(difference).toFixed(17);
            let finalAmount = await web3.utils.fromWei(amounts[1].mul(new BN(94)).div(ONE_HUNDRED), 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(17);
            assert.equal(finalAmount, difference);

            const lotteryEthBalanceAfter = await web3.eth.getBalance(timeBombContract.address);
            const sBombLotteryBalanceAfter = await sBombToken.balanceOf(timeBombContract.address);
            let lotteryFee = new BN(lotteryEthBalanceAfter - lotteryEthBalanceBefore);
            difference = await web3.utils.fromWei(lotteryFee, 'ether');
            difference = parseFloat(difference).toFixed(17);
            finalAmount = await web3.utils.fromWei(expectedLotteryFee[1], 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(17);
            assert.equal(finalAmount, difference);

            lotteryFee = sBombLotteryBalanceAfter.sub(sBombLotteryBalanceBefore);
            difference = await web3.utils.fromWei(lotteryFee, 'ether');
            difference = parseFloat(difference).toFixed(18);
            finalAmount = await web3.utils.fromWei(expectedLotteryFeeSbomb, 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(18);
            assert.equal(finalAmount, difference);

            const shibakenBalanceAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const burnFee = shibakenBalanceAfter.sub(shibakenBalanceBefore);
            expect(burnFee).bignumber.equal(expectedBurnFee[1].mul(new BN(98)).div(ONE_HUNDRED).add(TWO)); //can not round currently cause of zero decimals
        })

        it("#4 - trying to SELL sBomb token on DEX to ETH", async()=>{
            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);
            expect((await sBombToken.getReward(user1))).bignumber.equal(ZERO);
            expect((await sBombToken.getReward(user2))).bignumber.equal(ZERO);
            let now = await time.latest();
            const ethBalanceBefore = await web3.eth.getBalance(user2);
            const teamBalanceBefore = await sBombToken.balanceOf(team);
            const deadBalanceBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            let amountsOut = await pancakeRouterInstant.getAmountsOut(ONE_TOKEN, [sBombToken.address, wethInst.address]);
            let deadAmount = await pancakeRouterInstant.getAmountsOut(ONE_TOKEN.mul(EIGHT).div(ONE_HUNDRED), [sBombToken.address, shibakenToken.address]);

            await sBombToken.approve(pancakeRouterInstant.address, ONE_TOKEN);
            await pancakeRouterInstant.swapExactTokensForETHSupportingFeeOnTransferTokens(
                ONE_TOKEN,
                ZERO,
                [sBombToken.address, wethInst.address],
                user2,
                now.add(time.duration.minutes(15))
            );
            
            const ethBalanceAfter = await web3.eth.getBalance(user2);
            let difference = await web3.utils.fromWei((ethBalanceAfter - ethBalanceBefore).toString(), 'ether');
            difference = parseFloat(difference).toFixed(2);
            let finalAmount = await web3.utils.fromWei(amountsOut[1].mul(EIGHT).div(TEN), 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(2);
            assert.equal(finalAmount, difference);

            const holdersPerc = ONE_TOKEN.mul(TWO).div(ONE_HUNDRED);

            //expect((await sBombToken.getReward(user1))).bignumber.equal(ZERO);
            expect((await sBombToken.getReward(user1))).bignumber.equal(holdersPerc.mul((await sBombToken.balanceOf(user1)).sub(await sBombToken.getReward(user1))).div(await sBombToken.totalDistributed.call()));
            expect((await sBombToken.getReward(user2))).bignumber.equal(holdersPerc.mul((await sBombToken.balanceOf(user2)).sub(await sBombToken.getReward(user2))).div(await sBombToken.totalDistributed.call()));

            const teamBalanceAfter = await sBombToken.balanceOf(team);
            expect(teamBalanceAfter.sub(teamBalanceBefore)).bignumber.equal(ONE_TOKEN.mul(FIVE).div(ONE_HUNDRED));

            const deadBalanceAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            expect(deadBalanceAfter.sub(deadBalanceBefore)).bignumber.equal(deadAmount[1].sub(deadAmount[1].mul(TWO).div(ONE_HUNDRED)).add(ONE));

            await sBombToken.transfer(user3, ONE_TOKEN, {from: user1});
            expect((await sBombToken.getReward(user1))).bignumber.equal(ZERO);
            expect((await sBombToken.getReward(user3))).bignumber.equal(ZERO);
        })

        it("#5 - trying to SELL sBomb token on DEX to TOKENS", async()=>{
            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);
            let now = await time.latest();
            const testTokenBalanceBefore = await testToken.balanceOf(user2);
            await sBombToken.transfer(user2, FIVE.mul(TEN).mul(ONE_TOKEN));
            let amountsOut = await pancakeRouterInstant.getAmountsOut(FIVE.mul(TEN).mul(ONE_TOKEN).mul(EIGHT).div(TEN), [sBombToken.address, testToken.address]);

            let shibakenToBurn = await pancakeRouterInstant.getAmountsOut(FIVE.mul(ONE_TOKEN).mul(EIGHT).div(TEN), [sBombToken.address, shibakenToken.address]);
            let ethToTeam = await pancakeRouterInstant.getAmountsOut(FIVE.mul(TEN).mul(ONE_TOKEN).mul(FIVE).div(ONE_HUNDRED), [sBombToken.address, wethInst.address]);
            let sBombEthReserves = await sBombEthLP.getReserves();
            let sbombReserve = sBombToken.address == sBombEthLP.token0() ? sBombEthReserves[0] : sBombEthReserves[1];
            let ethReserve = sBombToken.address == sBombEthLP.token0() ? sBombEthReserves[1] : sBombEthReserves[0];
            let ethToLiquidity = ethToTeam[1].div(TWO);
            let sBombToLiquidity = (ethToTeam[0]).sub(ethToTeam[0].div(TWO));
            let amountEthOptimal  = sBombToLiquidity.mul(ethReserve).div(sbombReserve);
            let amountSBombOptimal = ethToLiquidity.mul(sbombReserve).div(ethReserve);
            ethToLiquidity = ethToLiquidity < amountEthOptimal ? amountEthOptimal : ethToLiquidity;
            sBombToLiquidity = sBombToLiquidity < amountSBombOptimal ? amountSBombOptimal : sBombToLiquidity;
            let lpTotalSupply = await sBombEthLP.totalSupply();
            let lpTokenAmountToMint = BN.min(new BN(ethToLiquidity).mul(lpTotalSupply).div(ethReserve), sBombToLiquidity.mul(lpTotalSupply).div(sbombReserve));

            const shibakenBalanceBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const teamBalanceBefore = await sBombToken.balanceOf(team);
            const lpBalanceBefore = await sBombEthLP.balanceOf(DEAD_ADDRESS);

            let user1BeforeReward = await sBombToken.getReward(user1);
            let user2BeforeReward = await sBombToken.getReward(user2);
            let user3BeforeReward = await sBombToken.getReward(user3);
            expect(user1BeforeReward).bignumber.equal(ZERO);
            expect(user2BeforeReward).bignumber.equal(ZERO);
            expect(user3BeforeReward).bignumber.equal(ZERO);

            await sBombToken.approve(pancakeRouterInstant.address, FIVE.mul(TEN).mul(ONE_TOKEN), {from: user2});
            await pancakeRouterInstant.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                FIVE.mul(TEN).mul(ONE_TOKEN),
                ZERO,
                [sBombToken.address, testToken.address],
                user2,
                now.add(time.duration.minutes(15)),
                {from: user2}
            );
            const testTokenBalanceAfter = await testToken.balanceOf(user2);
            expect(testTokenBalanceAfter.sub(testTokenBalanceBefore)).bignumber.equal(amountsOut[1]);

            const shibakenBalanceAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const teamBalanceAfter = await sBombToken.balanceOf(team);
            const lpBalanceAfter = await sBombEthLP.balanceOf(DEAD_ADDRESS);

            expect(shibakenBalanceAfter.sub(shibakenBalanceBefore)).bignumber.equal(shibakenToBurn[1].sub(shibakenToBurn[1].mul(TWO).div(ONE_HUNDRED)).add(ONE));

            expect(teamBalanceAfter.sub(teamBalanceBefore)).bignumber.equal(FIVE.mul(TEN).mul(ONE_TOKEN).mul(FIVE).div(ONE_HUNDRED));

            let difference = await web3.utils.fromWei(lpBalanceAfter.sub(lpBalanceBefore), 'ether');
            difference = parseFloat(difference).toFixed(1);
            let finalAmount = await web3.utils.fromWei(new BN(lpTokenAmountToMint), 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(1);
            assert.equal(finalAmount, difference);

            let user1AfterReward = await sBombToken.getReward(user1);
            let user2AfterReward = await sBombToken.getReward(user2);
            let user3AfterReward = await sBombToken.getReward(user3);
            const holdersPerc = FIVE.mul(TEN).mul(ONE_TOKEN).mul(TWO).div(ONE_HUNDRED);
            expect(user1AfterReward).bignumber.equal(holdersPerc.mul((await sBombToken.balanceOf(user1)).sub(await sBombToken.getReward(user1))).div(await sBombToken.totalDistributed.call()));
            expect(user2AfterReward).bignumber.equal(holdersPerc.mul((await sBombToken.balanceOf(user2)).sub(await sBombToken.getReward(user2))).div(await sBombToken.totalDistributed.call()).add(ONE));
            expect(user3AfterReward).bignumber.equal(holdersPerc.mul((await sBombToken.balanceOf(user3)).sub(await sBombToken.getReward(user3))).div(await sBombToken.totalDistributed.call()).add(ONE));
        })

        it("#6 - trying add liquidity ETH without fee", async()=>{
            const deadBalanceShibakenBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadBalanceLPBefore = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const teamWalletBefore = await web3.eth.getBalance(team);
            const reserves0 = await sBombEthLP.getReserves();
            const ethBeforeReserve = sBombToken.address == sBombEthLP.token0() ? reserves0[1] : reserves0[0];
            const sbombBeforeReserve = sBombToken.address == sBombEthLP.token0() ? reserves0[0] : reserves0[1];

            assert.equal(await web3.eth.getBalance(sBombToken.address), 0);

            await sBombToken.approve(sBombToken.address, ONE_HALF_TOKEN, {from: user1});
            await sBombToken.noFeeAddLiquidityETH(
                ONE_HALF_TOKEN,
                ZERO,
                ZERO,
                user1,
                {
                    from: user1,
                    value: ONE_TOKEN.div(ONE_THOUSAND)
                }
            );
            const deadBalanceShibakenAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadBalanceLPAfter = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const teamWalletAfter = await web3.eth.getBalance(team);

            expect(deadBalanceShibakenAfter.sub(deadBalanceShibakenBefore)).bignumber.equal(ZERO);
            expect(deadBalanceLPAfter.sub(deadBalanceLPBefore)).bignumber.equal(ZERO);
            const reserves1 = await sBombEthLP.getReserves();
            const ethAfterReserve = sBombToken.address == sBombEthLP.token0() ? reserves1[1] : reserves1[0];
            const sbombAfterReserve = sBombToken.address == sBombEthLP.token0() ? reserves1[0] : reserves1[1];
            expect(sbombAfterReserve.sub(sbombBeforeReserve)).bignumber.equal((ONE_TOKEN.div(ONE_THOUSAND)).mul(sbombBeforeReserve).div(ethBeforeReserve));
            expect(ethAfterReserve.sub(ethBeforeReserve)).bignumber.equal(ONE_TOKEN.div(ONE_THOUSAND));
            assert.equal(teamWalletAfter - teamWalletBefore, 0);
        })

        it("#7 - trying add liquidity TOKENS without fee", async()=>{
            const deadBalanceShibakenBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadBalanceLPBefore = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const teamWalletBefore = await web3.eth.getBalance(team);
            const reserves0 = await sBombTestLp.getReserves();

            await sBombToken.approve(sBombToken.address, ONE_HALF_TOKEN, {from: user1});
            await testToken.approve(sBombToken.address, ONE_HALF_TOKEN, {from: user1});
            await sBombToken.noFeeAddLiquidity(
                testToken.address,
                ONE_HALF_TOKEN,
                ONE_HALF_TOKEN,
                ZERO,
                ZERO,
                user1,
                {
                    from: user1
                }
            );
            const deadBalanceShibakenAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadBalanceLPAfter = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const teamWalletAfter = await web3.eth.getBalance(team);

            expect(deadBalanceShibakenAfter.sub(deadBalanceShibakenBefore)).bignumber.equal(ZERO);
            expect(deadBalanceLPAfter.sub(deadBalanceLPBefore)).bignumber.equal(ZERO);
            const reserves1 = await sBombTestLp.getReserves();
            expect(reserves1[0].sub(reserves0[0])).bignumber.equal(ONE_HALF_TOKEN.mul(reserves0[0]).div(reserves0[1]));
            expect(reserves1[1].sub(reserves0[1])).bignumber.equal(ONE_HALF_TOKEN);
            assert.equal(teamWalletAfter - teamWalletBefore, 0);
        })

        it("#8 - trying to remove liquidity SBOMB-ETH without fee", async()=>{
            const deadBalanceShibakenBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const lotteryBalanceBefore = await web3.eth.getBalance(timeBombContract.address);

            const ethBalanceBefore = await web3.eth.getBalance(deployer);
            const sBombBalanceBefore = await sBombToken.balanceOf(deployer);

            const lpBalance = await sBombEthLP.balanceOf(deployer);
            const totalSupply = await sBombEthLP.totalSupply();
            await sBombEthLP.approve(sBombToken.address, lpBalance);

            const reserves = await sBombEthLP.getReserves();
            const sbombReserve = sBombToken.address == sBombEthLP.token0() ? reserves[0] : reserves[1];
            const ethReserve = sBombToken.address == sBombEthLP.token0() ? reserves[1] : reserves[0];

            await sBombToken.noFeeRemoveLiquidityETH(
                lpBalance,
                ZERO,
                ZERO,
                deployer
            );

            const deadBalanceShibakenAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const lotteryBalanceAfter = await web3.eth.getBalance(timeBombContract.address);

            const ethBalanceAfter = await web3.eth.getBalance(deployer);
            const sBombBalanceAfter = await sBombToken.balanceOf(deployer);

            expect(deadBalanceShibakenAfter.sub(deadBalanceShibakenBefore)).bignumber.equal(ZERO);
            assert.equal(lotteryBalanceAfter - lotteryBalanceBefore, 0);

            expect(sBombBalanceAfter.sub(sBombBalanceBefore)).bignumber.equal(sbombReserve.mul(lpBalance).div(totalSupply));
            let difference = await web3.utils.fromWei((ethBalanceAfter - ethBalanceBefore).toString(), 'ether');
            difference = parseFloat(difference).toFixed(1);
            let finalAmount = await web3.utils.fromWei(ethReserve.mul(lpBalance).div(totalSupply), 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(1);
            assert.equal(finalAmount.toString(), difference.toString());
        })

        it('#9 - trying to remove liquidity from TOKEN-SBOMB pair', async()=>{
            const deadBalanceShibakenBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const lotteryBalanceBefore = await web3.eth.getBalance(timeBombContract.address);

            const testBalanceBefore = await testToken.balanceOf(user1);
            const sBombBalanceBefore = await sBombToken.balanceOf(user1);

            const lpBalance = await sBombTestLp.balanceOf(deployer);
            const totalSupply = await sBombTestLp.totalSupply();
            await sBombTestLp.approve(sBombToken.address, lpBalance);

            const reserves = await sBombTestLp.getReserves();

            await sBombToken.noFeeRemoveLiquidity(
                testToken.address,
                lpBalance,
                ZERO,
                ZERO,
                user1
            );
            
            const deadBalanceShibakenAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const lotteryBalanceAfter = await web3.eth.getBalance(timeBombContract.address);

            const testBalanceAfter = await testToken.balanceOf(user1);
            const sBombBalanceAfter = await sBombToken.balanceOf(user1);

            expect(deadBalanceShibakenAfter.sub(deadBalanceShibakenBefore)).bignumber.equal(ZERO);
            assert.equal(lotteryBalanceAfter - lotteryBalanceBefore, 0);

            expect(sBombBalanceAfter.sub(sBombBalanceBefore)).bignumber.equal(reserves[1].mul(lpBalance).div(totalSupply));
            expect(testBalanceAfter.sub(testBalanceBefore)).bignumber.equal(reserves[0].mul(lpBalance).div(totalSupply));
        })

        it('#10 - include charity', async()=>{
            let now = await time.latest();
            await sBombToken.changeCharityWallet(charity);
            expect(await sBombToken.balanceOf(charity)).bignumber.equal(ZERO);
            let sBombAmount = await pancakeRouterInstant.getAmountsOut(ONE_HALF_TOKEN, [testToken.address, sBombToken.address]);
            let timeBombBefore = await sBombToken.balanceOf(timeBombContract.address);
            
            await testToken.approve(pancakeRouterInstant.address, ONE_HALF_TOKEN, {from: user1});
            await pancakeRouterInstant.swapExactTokensForTokens(
                ONE_HALF_TOKEN,
                ZERO,
                [testToken.address, sBombToken.address],
                user1,
                now.add(time.duration.minutes(15)),
                {from: user1}
            );

            expect(await sBombToken.balanceOf(charity)).bignumber.equal(sBombAmount[1].mul(FIVE).div(ONE_HUNDRED).div(TWO).div(TEN));
            let timeBombAfter = await sBombToken.balanceOf(timeBombContract.address);
            expect(timeBombAfter.sub(timeBombBefore)).bignumber.equal(sBombAmount[1].mul(FIVE).div(ONE_HUNDRED).div(TWO).sub(sBombAmount[1].mul(FIVE).div(ONE_HUNDRED).div(TWO).div(TEN)).add(ONE));
        })
    }
)

function getOptimalAmountToSell(X, dX)
{
    let feeDenom = 1000000;
    let f = 998000; // 1 - fee
    let T1 = X * (X * (feeDenom + f)**2 + 4 * feeDenom * dX * f);

    // square root
    let z = (T1 + 1) / 2;
    let sqrtT1 = T1;
    while (z < sqrtT1) {
        sqrtT1 = z;
        z = (T1 / z + z) / 2;
    }

    return((2 * feeDenom * dX * X) / (sqrtT1 + X * (feeDenom + f)));
    
}
