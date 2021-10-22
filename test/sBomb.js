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

        let sBombToken, shibakenToken, sBombEthLP, sBombShibakenLP, shibakenEthLp, testToken, sBombTestLp;

        before(async()=>{
            shibakenToken = await TestToken.new("ShibaKen.finance", "SHIBAKEN");
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

            sBombToken = await SBombToken.new(shibakenToken.address, pancakeRouterInstant.address);
            await sBombToken.setLotteryContarct(lottery);
            await sBombToken.changeTeamWallet(team);

            //await sBombToken.setDexRouter(pancakeRouterInstant.address);
            console.log("DEX: ",pancakeRouterInstant.address);
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

            await shibakenToken.approve(pancakeRouterInstant.address, ONE_HUNDRED_TOKENS);
            pancakeRouterInstant.addLiquidityETH(
                shibakenToken.address,
                ONE_HUNDRED_TOKENS,
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
        })

        /* it("#0 - initial checking", async()=>{
            expect(await shibakenToken.balanceOf(DEAD_ADDRESS)).bignumber.equal(ZERO);
            expect(await sBombEthLP.balanceOf(DEAD_ADDRESS)).bignumber.equal(ZERO);
            let lotteryBalance = await web3.eth.getBalance(lottery);
            let teamBalance = await web3.eth.getBalance(team);
            assert.equal(lotteryBalance.toString(),ONE_HUNDRED_TOKENS.toString());
            assert.equal(teamBalance.toString(),ONE_HUNDRED_TOKENS.toString());
        }) */

        it("#1 - transfer between usual addresses", async()=>{
            expect(await sBombToken.balanceOf(user1)).bignumber.equal(ZERO);
            const deadShibaBalanceBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadSbombEthLpBalanceBefore = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const lotteryEthBalanceBefore = await web3.eth.getBalance(lottery);
            const teamEthBalanceBefore = await web3.eth.getBalance(team);
            sBombToken.transfer(user1, ONE_HUNDRED_TOKENS, {from: deployer});
            const lotteryEthBalanceAfter = await web3.eth.getBalance(lottery);
            const teamEthBalanceAfter = await web3.eth.getBalance(team);
            const deadShibaBalanceAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadSbombEthLpBalanceAfter = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            assert.equal(lotteryEthBalanceAfter - lotteryEthBalanceBefore, 0);
            assert.equal(teamEthBalanceAfter - teamEthBalanceBefore, 0);
            assert.equal(deadShibaBalanceAfter - deadShibaBalanceBefore, 0);
            assert.equal(deadSbombEthLpBalanceAfter - deadSbombEthLpBalanceBefore, 0);
        })
    
        it("#2 - trying to BUY sBomb token on DEX", async()=>{
            let amountEthToSBomb = await pancakeRouterInstant.getAmountsOut(ONE_HALF_TOKEN, [wethInst.address, sBombToken.address]);
            let amountSBombToSibaken = await pancakeRouterInstant.getAmountsOut(amountEthToSBomb[1].div(ONE_HUNDRED), [sBombToken.address, shibakenToken.address]);
            let amountSBombToShibakenToEth = await pancakeRouterInstant.getAmountsOut(amountEthToSBomb[1].mul(FIVE).div(ONE_HUNDRED), [sBombToken.address, shibakenToken.address, wethInst.address]);
            console.log("AMOUNT ETH-SBOMB", amountEthToSBomb.toString());
            console.log("AMOUNT SBOMB-SHIBAKEN", amountSBombToSibaken.toString());
            console.log("AMOUNT SBOMB-SHIBAKEN-ETH", amountSBombToShibakenToEth.toString());

            const shibakenTokenBalanceBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const lotteryEthBalanceBefore = await web3.eth.getBalance(lottery);
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
            const lotteryEthBalanceAfter = await web3.eth.getBalance(lottery);
            const shibakenTokenBalanceAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);

            let difference = await web3.utils.fromWei((lotteryEthBalanceAfter - lotteryEthBalanceBefore).toString(), 'ether');
            difference = parseFloat(difference).toFixed(13);

            let finalAmount = await web3.utils.fromWei(amountSBombToShibakenToEth[2], 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(13);

            //assert.equal(lotteryEthBalanceAfter - lotteryEthBalanceBefore, amountSBombToShibakenToEth[2].toString());
            assert.equal(difference, finalAmount);

            difference = await web3.utils.fromWei(shibakenTokenBalanceAfter.sub(shibakenTokenBalanceBefore), 'ether');
            difference = parseFloat(difference).toFixed(2);

            finalAmount = await web3.utils.fromWei(amountSBombToSibaken[1], 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(2);
            assert.equal(difference, finalAmount);
            //expect(shibakenTokenBalanceAfter.sub(shibakenTokenBalanceBefore)).bignumber.equal(amountSBombToSibaken[1]);
        })

        it("#3 - trying to BUY sBomb token on DEX by TOKEN", async()=>{
            const lotteryEthBalanceBefore = await web3.eth.getBalance(lottery);
            let amounts = await pancakeRouterInstant.getAmountsOut(ONE_HALF_TOKEN, [testToken.address, sBombToken.address]);
            console.log("BEFORE: ",amounts.toString());
            const sBombBalanceBefore = await sBombToken.balanceOf(user1);
            await testToken.approve(pancakeRouterInstant.address, ONE_HALF_TOKEN, {from:user1});
            let now = await time.latest();
            //expect(await shibakenToken.balanceOf(DEAD_ADDRESS)).bignumber.equal(ZERO);
            await pancakeRouterInstant.swapExactTokensForTokens(
                ONE_HALF_TOKEN,
                ZERO,
                [testToken.address, sBombToken.address],
                user1,
                now.add(time.duration.minutes(15)),
                {from: user1}
            );
            const sBombBalanceAfter = await sBombToken.balanceOf(user1);
            console.log("AFTER: ",sBombBalanceAfter.sub(sBombBalanceBefore).toString());
            const lotteryEthBalanceAfter = await web3.eth.getBalance(lottery);
            let lotteryFee = new BN(lotteryEthBalanceAfter - lotteryEthBalanceBefore);
            let burnFee = await shibakenToken.balanceOf(DEAD_ADDRESS);
            console.log("Lottery fee : ",lotteryFee.toString());
            console.log("Burn fee : ", burnFee.toString());
            let amounts1 = await pancakeRouterInstant.getAmountsOut(lotteryFee, [wethInst.address, sBombToken.address]);
            let amounts2 = await pancakeRouterInstant.getAmountsOut(burnFee, [shibakenToken.address, sBombToken.address]);
            console.log("SUMMURY: ", sBombBalanceAfter.sub(sBombBalanceBefore).add(amounts1[1]).add(amounts2[1]).toString());
        })

        it("#4 - trying to SELL sBomb token on DEX to ETH", async()=>{
            let now = await time.latest();
            const ethBalanceBefore = await web3.eth.getBalance(user2);
            let amountsOut = await pancakeRouterInstant.getAmountsOut(ONE_TOKEN.mul(EIGHT).div(TEN), [sBombToken.address, wethInst.address]);
            
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
            //console.log(difference);
            let finalAmount = await web3.utils.fromWei(amountsOut[1], 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(2);
            assert.equal(finalAmount, difference);
            //assert.equal(ethBalanceAfter - ethBalanceBefore, amountsOut[1].toString());
        })

        it("#5 - trying to SELL sBomb token on DEX to TOKENS", async()=>{
            let now = await time.latest();
            const testTokenBalanceBefore = await testToken.balanceOf(user2);
            let amountsOut = await pancakeRouterInstant.getAmountsOut(ONE_TOKEN.mul(EIGHT).div(TEN), [sBombToken.address, testToken.address]);

            let shibakenToBurn = await pancakeRouterInstant.getAmountsOut(ONE_TOKEN.div(TEN), [sBombToken.address, shibakenToken.address]);
            let ethToTeam = await pancakeRouterInstant.getAmountsOut(ONE_TOKEN.mul(FIVE).div(ONE_HUNDRED), [sBombToken.address, wethInst.address]);
            let sBombEthReserves = await sBombEthLP.getReserves();
            let ethToLiquidity = ethToTeam[1].div(TWO);
            let sBombToLiquidity = (ONE_TOKEN.mul(FIVE).div(ONE_HUNDRED)).sub(ONE_TOKEN.mul(FIVE).div(ONE_HUNDRED).div(TWO))
            let amountEthOptimal  = sBombToLiquidity.mul(sBombEthReserves[1]).div(sBombEthReserves[0]);
            let amountSBombOptimal = ethToLiquidity.mul(sBombEthReserves[0]).div(sBombEthReserves[1]);
            ethToLiquidity = ethToLiquidity < amountEthOptimal ? amountEthOptimal : ethToLiquidity;
            sBombToLiquidity = sBombToLiquidity < amountSBombOptimal ? amountSBombOptimal : sBombToLiquidity;
            let lpTokenAmountToMint = Math.min(ethToLiquidity.mul(await sBombEthLP.totalSupply()).div(sBombEthReserves[1]), sBombToLiquidity.mul(await sBombEthLP.totalSupply()).div(sBombEthReserves[0]));

            const shibakenBalanceBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const teamBalanceBefore = await web3.eth.getBalance(team);
            const lpBalanceBefore = await sBombEthLP.balanceOf(DEAD_ADDRESS);

            await sBombToken.approve(pancakeRouterInstant.address, ONE_TOKEN, {from: user2});
            await pancakeRouterInstant.swapExactTokensForTokensSupportingFeeOnTransferTokens(
                ONE_TOKEN,
                ZERO,
                [sBombToken.address, testToken.address],
                user2,
                now.add(time.duration.minutes(15)),
                {from: user2}
            );
            const testTokenBalanceAfter = await testToken.balanceOf(user2);
            let difference = await web3.utils.fromWei(testTokenBalanceAfter.sub(testTokenBalanceBefore), 'ether');
            //console.log(difference);
            expect(testTokenBalanceAfter.sub(testTokenBalanceBefore)).bignumber.equal(amountsOut[1]);

            const shibakenBalanceAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const teamBalanceAfter = await web3.eth.getBalance(team);
            const lpBalanceAfter = await sBombEthLP.balanceOf(DEAD_ADDRESS);

            expect(shibakenBalanceAfter.sub(shibakenBalanceBefore)).bignumber.equal(shibakenToBurn[1]);

            difference = await web3.utils.fromWei((teamBalanceAfter - teamBalanceBefore).toString(), 'ether');
            difference = parseFloat(difference).toFixed(11);
            let finalAmount = await web3.utils.fromWei(ethToTeam[1], 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(11);
            assert.equal(finalAmount, difference);

            difference = await web3.utils.fromWei(lpBalanceAfter.sub(lpBalanceBefore), 'ether');
            difference = parseFloat(difference).toFixed(3);
            finalAmount = await web3.utils.fromWei(new BN(lpTokenAmountToMint), 'ether');
            finalAmount = parseFloat(finalAmount).toFixed(3);
            assert.equal(finalAmount, difference);

            //expect(lpBalanceAfter.sub(lpBalanceBefore)).bignumber.equal(new BN(lpTokenAmountToMint));
        })

        it("#6 - trying add liquidity ETH without fee", async()=>{
            const deadBalanceShibakenBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadBalanceLPBefore = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const teamWalletBefore = await web3.eth.getBalance(team);
            const reserves0 = await sBombEthLP.getReserves();

            //console.log("SBOMB OWN BALANCE ", (await sBombToken.balanceOf(sBombToken.address)).toString());
            console.log("ETH BALANCE : ", (await web3.eth.getBalance(sBombToken.address)).toString());

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
            //console.log("SBOMB OWN BALANCE ", (await sBombToken.balanceOf(sBombToken.address)).toString());
            const deadBalanceShibakenAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadBalanceLPAfter = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const teamWalletAfter = await web3.eth.getBalance(team);

            expect(deadBalanceShibakenAfter.sub(deadBalanceShibakenBefore)).bignumber.equal(ZERO);
            expect(deadBalanceLPAfter.sub(deadBalanceLPBefore)).bignumber.equal(ZERO);
            const reserves1 = await sBombEthLP.getReserves();
            expect(reserves1[0].sub(reserves0[0])).bignumber.equal((ONE_TOKEN.div(ONE_THOUSAND)).mul(reserves0[0]).div(reserves0[1]));
            expect(reserves1[1].sub(reserves0[1])).bignumber.equal(ONE_TOKEN.div(ONE_THOUSAND));
            assert.equal(teamWalletAfter - teamWalletBefore, 0);
        })

        it("#7 - trying add liquidity TOKENS without fee", async()=>{
            const deadBalanceShibakenBefore = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadBalanceLPBefore = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const teamWalletBefore = await web3.eth.getBalance(team);
            const reserves0 = await sBombTestLp.getReserves();

            await sBombToken.approve(sBombToken.address, ONE_HALF_TOKEN, {from: user1});
            await testToken.approve(sBombToken.address, ONE_HALF_TOKEN, {from: user1});
            //console.log("SBOMB OWN BALANCE ", (await sBombToken.balanceOf(sBombToken.address)).toString());
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
            //console.log("SBOMB OWN BALANCE ", (await sBombToken.balanceOf(sBombToken.address)).toString());
            const deadBalanceShibakenAfter = await shibakenToken.balanceOf(DEAD_ADDRESS);
            const deadBalanceLPAfter = await sBombEthLP.balanceOf(DEAD_ADDRESS);
            const teamWalletAfter = await web3.eth.getBalance(team);

            expect(deadBalanceShibakenAfter.sub(deadBalanceShibakenBefore)).bignumber.equal(ZERO);
            expect(deadBalanceLPAfter.sub(deadBalanceLPBefore)).bignumber.equal(ZERO);
            const reserves1 = await sBombTestLp.getReserves();
            expect(reserves1[0].sub(reserves0[0])).bignumber.equal(ONE_HALF_TOKEN);
            expect(reserves1[1].sub(reserves0[1])).bignumber.equal(ONE_HALF_TOKEN.mul(reserves0[1]).div(reserves0[0]));
            assert.equal(teamWalletAfter - teamWalletBefore, 0);
        })
    }
)