const {
    BN,
    time,
    expectRevert,
} = require('@openzeppelin/test-helpers');
const { expect } = require("chai");

const _ZERO = new BN('0')
const _TWO = new BN('2')
const _THREE = new BN('3')
const _FOUR = new BN('4')
const _FIVE = new BN('5')

const _TEN = new BN('10')
const _FIFTEEN = new BN('15')
const _STO = new BN('100')

const MULTIPLIER  = new BN((10**18).toString())
const TWO = new BN((2*10**18).toString())
const TROI = new BN((3*10**18).toString())
const FIVE = new BN((5 * 10 ** 18).toString())
const TEN = new BN((10 * 10 ** 18).toString())
const STO = new BN((100 * 10 ** 18).toString())
const REWARDS = new BN((60 * 60 * 24 * 30 * 12 * 10 ** 18).toString())
const YEAR = new BN((60 * 60 * 24 * 30 * 12).toString())
const DAY = new BN((60 * 60 * 24).toString())
const N = REWARDS.mul(MULTIPLIER).div(YEAR)

const ADDRESS_0 = '0x0000000000000000000000000000000000000000'
const _Staking = artifacts.require("StakingReward");
const TestToken = artifacts.require("TestToken");

contract('Staking', ([
        owner,
        alice,
        bob,
        eva,
        devWallet
    ]) => {
    let value, tokenReward, tokenStaked, Staking, before_alice, after_alice, before_bob, after_bob, before_eva, after_eva


    beforeEach(async () => {
        
        tokenReward = await TestToken.new('TEST_reward', 'T_r', { from: owner })
        tokenStaked = await TestToken.new('TEST_staked', 'T_s', { from: owner })
        Staking = await _Staking.new({ from: owner }) 
        
        let ar = [alice, bob, eva]
        let i = 0;
        while (i < 3) {
           
            await tokenStaked.transfer(ar[i], STO, { from: owner })
            await tokenStaked.approve(Staking.address, STO, { from: ar[i] })

            expect(await tokenStaked.balanceOf(ar[i])).to.be.bignumber.that.equals(STO)
            expect(await tokenStaked.allowance(ar[i], Staking.address)).to.be.bignumber.that.equals(STO)
    
            i = i + 1
        }
    
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.equals(_ZERO)

    })

    it('#0 check exeptions before initiating Staking and conditions after that', async () => {
        
        await expectRevert(
            Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet,  YEAR, { from: owner }),
            "Staking: Uncorrect data for init"
        )   

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})
        
        await expectRevert(
            Staking.initStaking(ADDRESS_0, tokenReward.address, devWallet, YEAR, { from: owner }),
            "Staking: Uncorrect data for init"
        )
        await expectRevert(
            Staking.initStaking(tokenStaked.address, ADDRESS_0, devWallet, YEAR, { from: owner }),
            "Staking: Uncorrect data for init"
        )
        await expectRevert(
            Staking.initStaking(tokenStaked.address, tokenReward.address, ADDRESS_0, YEAR, { from: owner }),
            "Staking: Uncorrect data for init"
        )
        await expectRevert(
            Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet,  _ZERO, { from: owner }),
            "Staking: Uncorrect data for init"
        )   

        await expectRevert(
            Staking.deposit( FIVE, { from: alice }) ,
            "Staking: not init"
        ); 
        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })

        expect((await Staking.getPoolInfo())._stakedToken).to.be.equals(tokenStaked.address)
        expect((await Staking.getPoolInfo())._devWallet).to.be.equals(devWallet)
        expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getPoolInfo())._tokenRate).to.be.bignumber.equals(N)
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(_ZERO)

    })
   
    it('#1 Deposit 5 tokens from alice -> After 0.5 months withdraw 3 tokens -> After 0.5 claim and deposit 3 tokens -> Increase time to the end of year, withdraw all tokens and claim', async () => {
        let glKoffM, rewards_alice

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })

        await expectRevert(
            Staking.withdraw( FIVE, { from: alice }) ,
            "Staking: _user.amount > 0"
        ); 

        let timestamp_deposit_1 = (await web3.eth.getBlock((await Staking.deposit(FIVE, { from: alice })).receipt.blockNumber)).timestamp

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_1.toString())
        //expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals(_ZERO)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE)
        //expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getPoolInfo())._lastUpdate).to.be.bignumber.equals(timestamp_deposit_1.toString())
       
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE)

        expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(_ZERO)
        expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS)
       

        await time.increase(time.duration.days(15))

        let timestamp_withdraw_1 = (await web3.eth.getBlock((await Staking.withdraw(TROI, { from: alice })).receipt.blockNumber)).timestamp
        let percents = (TROI.mul(_THREE.add(_THREE))).div(_STO)
        let withoutFee = TROI.sub(percents)
        value = (STO.sub(TROI)).add(withoutFee)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TWO)

        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals((STO.sub(FIVE)).add(withoutFee))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TWO)
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))

        expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(_ZERO)
        expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS)

        let glKoff 
        glKoffM = ((new BN(timestamp_withdraw_1)).sub(new BN(timestamp_deposit_1))).mul(MULTIPLIER).div(FIVE)
        glKoff = glKoffM

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(TWO)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_1.toString())
        //expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(glKoffM)
        expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals((new BN(timestamp_withdraw_1)).sub(new BN(timestamp_deposit_1)).mul(MULTIPLIER).mul(N).mul(FIVE).div(FIVE))
         
        //expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(glKoff)
       
        await time.increase(time.duration.days(15))
        
        let timestamp_claim_1 = (await web3.eth.getBlock((await Staking.claim({ from: alice })).receipt.blockNumber)).timestamp 

        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals((STO.sub(FIVE)).add(withoutFee))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TWO)
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))

        rewards_alice = N.mul((new BN(timestamp_claim_1)).sub(new BN(timestamp_deposit_1))).div(MULTIPLIER)
        //console.log(rewards_alice.toString(), ' && ', (await tokenReward.balanceOf(alice)).toString())

        expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(rewards_alice)
        expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS.sub(rewards_alice))

        //expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(glKoffM)
        
        glKoffM = glKoffM.add(((new BN(timestamp_claim_1)).sub(new BN(timestamp_withdraw_1))).mul(MULTIPLIER).div(TWO))

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(TWO)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_1.toString())
        //expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(glKoffM)
        expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals(_ZERO)

        await time.increase(time.duration.days(1))
        
        let timestamp_deposit_2 = (await web3.eth.getBlock((await Staking.deposit(TROI, { from: alice })).receipt.blockNumber)).timestamp
         
        expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(rewards_alice)
        expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS.sub(rewards_alice))
        //rewards_alice = N.mul((new BN(timestamp_deposit_2)).sub(new BN(timestamp_claim_1))).div(MULTIPLIER)
        //console.log(rewards_alice.toString(), ' && ', (await Staking.nextReward(alice)).toString())
        
        glKoff = glKoff.add(((new BN(timestamp_deposit_2)).sub(new BN(timestamp_withdraw_1))).mul(MULTIPLIER).div(TWO))
        //expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(glKoff) 
        
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals((STO.sub(FIVE)).add(withoutFee).sub(TROI))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE)
        
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE)
        expect((await Staking.getPoolInfo())._lastUpdate).to.be.bignumber.equals(timestamp_deposit_2.toString())
        
        //expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(glKoff)
        
        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        //expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals(((new BN(timestamp_deposit_2)).sub(new BN(timestamp_claim_1))).mul(N).mul(TWO).mul(MULTIPLIER).div(TWO))

        await time.increase(time.duration.days(30*11))

        let end = timestamp_deposit_1 + 60*60*24*30*12
        
        //console.log((await Staking.nextReward(alice)).toString())
        //console.log((await tokenReward.balanceOf(Staking.address)).toString())
        
        let timestamp_withdraw_2 = (await web3.eth.getBlock((await Staking.withdraw(FIVE , { from: alice })).receipt.blockNumber)).timestamp

        rewards_alice = rewards_alice.add(N.mul((new BN(end)).sub(new BN(timestamp_deposit_2))).div(MULTIPLIER))
       // console.log(rewards_alice.toString(), ' && ', (await Staking.nextReward(alice)).toString())
        
        let timestamp_claim_2 = (await web3.eth.getBlock((await Staking.claim({ from: alice })).receipt.blockNumber)).timestamp 

        //console.log(((await Staking.getUserInfo(alice)).assignedReward).div(MULTIPLIER).div(MULTIPLIER).toString())
        //console.log((await tokenReward.balanceOf(Staking.address)).toString())
        
        percents = (TROI.mul(_THREE.add(_THREE))).div(_STO)
        withoutFee = TROI.sub(percents)
        value = (STO.sub(TROI)).add(withoutFee)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(_ZERO)

        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals((STO.sub(percents)))
       
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.lessThan(new BN('90'))
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(_ZERO)
    }) 



    
    it('#2 Deposit 5 tokens from Alice -> Increase time - 30days -> Deposit 10 tokens from Bob -> Increase time - 30days -> Claim', async () => {
        let rewards_alice, rewards_bob, timestamp_deposit_alice, timestamp_deposit_bob, timestamp_claim_alice, timestamp_claim_bob, timestamp_withdraw_alice, timestamp_withdraw_bob, timestamp_claim_alice_1, timestamp_claim_bob_1

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })

        timestamp_deposit_alice = (await web3.eth.getBlock((await Staking.deposit(FIVE, { from: alice })).receipt.blockNumber)).timestamp

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_alice.toString())
       // expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals(_ZERO)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE)
       // expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getPoolInfo())._lastUpdate).to.be.bignumber.equals(timestamp_deposit_alice.toString())
       
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE)

        expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(_ZERO)
        expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS)
      
        await time.increase(time.duration.days(30))

        timestamp_deposit_bob = (await web3.eth.getBlock((await Staking.deposit(TEN, { from: bob })).receipt.blockNumber)).timestamp

        rewards_alice = (N.mul((new BN(timestamp_deposit_bob)).sub(new BN(timestamp_deposit_alice))).div(MULTIPLIER))

        let koff = ((new BN(timestamp_deposit_bob)).sub(new BN(timestamp_deposit_alice)).mul(MULTIPLIER).div(FIVE))

        expect((await Staking.getUserInfo(bob)).amount).to.be.bignumber.equals(TEN)
        expect((await Staking.getUserInfo(bob)).start).to.be.bignumber.equals(timestamp_deposit_bob.toString())
        //expect((await Staking.getUserInfo(bob)).globalCoefficientMinus).to.be.bignumber.equals(koff)
        expect((await Staking.getUserInfo(bob)).assignedReward).to.be.bignumber.equals(_ZERO)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE.add(TEN))
        //expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(koff)
        expect((await Staking.getPoolInfo())._lastUpdate).to.be.bignumber.equals(timestamp_deposit_bob.toString())
       
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(bob)).to.be.bignumber.that.equals(STO.sub(TEN))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE.add(TEN))

        expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(_ZERO)
        expect(await tokenReward.balanceOf(bob)).to.be.bignumber.that.equals(_ZERO)
        expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS)

        await time.increase(time.duration.days(30))

        timestamp_claim_alice = (await web3.eth.getBlock((await Staking.claim({ from: alice })).receipt.blockNumber)).timestamp 
        
        timestamp_claim_bob = (await web3.eth.getBlock((await Staking.claim({ from: bob })).receipt.blockNumber)).timestamp 

        rewards_alice = rewards_alice.add(N.mul((new BN(timestamp_claim_alice)).sub(new BN(timestamp_deposit_bob))).mul(FIVE).div(FIVE.add(TEN)).div(MULTIPLIER))
        rewards_bob = (N.mul((new BN(timestamp_claim_bob)).sub(new BN(timestamp_claim_alice))).mul(TEN).div(FIVE.add(TEN)).div(MULTIPLIER)).add(N.mul((new BN(timestamp_claim_alice)).sub(new BN(timestamp_deposit_bob))).mul(TEN).div(FIVE.add(TEN)).div(MULTIPLIER))

        //console.log(rewards_alice.toString(), ' && ', (await tokenReward.balanceOf(alice)).toString())
        //console.log(rewards_bob.toString(), ' && ', (await tokenReward.balanceOf(bob)).toString())*/
       
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(bob)).to.be.bignumber.that.equals(STO.sub(TEN))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE.add(TEN))

        //console.log(rewards_alice.toString())
        //console.log((await tokenReward.balanceOf(alice)).toString())
      
      
        // !!!!!  expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(rewards_alice)
        
        //let rewards_bob = (((new BN(timestamp_claim_bob)).sub(new BN(timestamp_deposit_bob))).mul(N).mul(TEN).div(TEN.add(FIVE)).div(MULTIPLIER))
        //console.log(rewards_bob.toString())
        //console.log((await tokenReward.balanceOf(bob)).toString())
        expect(await tokenReward.balanceOf(bob)).to.be.bignumber.that.equals(rewards_bob)
        //expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS.sub(rewards_alice).sub(rewards_bob))

        await time.increase(time.duration.days(30*11))

        timestamp_withdraw_alice = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: alice })).receipt.blockNumber)).timestamp
        //console.log((await Staking.getUserInfo(bob)).assignedReward.div(MULTIPLIER).div(MULTIPLIER).toString())
        timestamp_withdraw_bob = (await web3.eth.getBlock((await Staking.withdraw(TEN, { from: bob })).receipt.blockNumber)).timestamp
        
        let end = timestamp_deposit_alice + 30*12*24*60*60
        
        await Staking.claim({ from: alice })
        
        rewards_alice = rewards_alice.add(N.mul((new BN(end)).sub(new BN(timestamp_claim_bob))).mul(FIVE).div(FIVE.add(TEN)).div(MULTIPLIER))
        //console.log(rewards_alice.toString(), ' && ', (await tokenReward.balanceOf(alice)).toString())
        //expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(rewards_alice)

        rewards_alice = (((new BN(end)).sub(new BN(timestamp_claim_alice))).mul(N).mul(FIVE).div(FIVE.add(TEN)).div(MULTIPLIER))
        rewards_bob = (((new BN(end)).sub(new BN(timestamp_claim_bob))).mul(N).mul(TEN).div(FIVE.add(TEN)).div(MULTIPLIER))

        timestamp_claim_bob_1 = (await web3.eth.getBlock((await Staking.claim({ from: bob })).receipt.blockNumber)).timestamp 
    })

    /*it('#3 Deposit 10 tokens from Alice -> Increase time - 30days -> Deposit 10 tokens from Bob -> Increase time - 30days -> WITHDRAW 5 tokens for Alice -> Increase time - 30days -> WITHDRAW 5 tokens for bob -> Increase time - 30days -> CLAIM', async () => {

        let timestamp_deposit_alice, timestamp_deposit_bob, timestamp_claim_alice, timestamp_claim_bob, timestamp_withdraw_alice, timestamp_withdraw_bob, rewards_alice, rewards_bob

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })

        timestamp_deposit_alice = (await web3.eth.getBlock((await Staking.deposit(TEN, { from: alice })).receipt.blockNumber)).timestamp

        await time.increase(time.duration.days(30))

        timestamp_deposit_bob = (await web3.eth.getBlock((await Staking.deposit(TEN, { from: bob })).receipt.blockNumber)).timestamp

        rewards_alice = ((new BN(timestamp_deposit_bob)).sub(new BN(timestamp_deposit_alice))).mul(N).div(MULTIPLIER)

        await time.increase(time.duration.days(30))

        timestamp_withdraw_alice = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: alice })).receipt.blockNumber)).timestamp

        rewards_alice = rewards_alice.add(((new BN(timestamp_withdraw_alice)).sub(new BN(timestamp_deposit_bob))).mul(N).mul(TEN).div(TEN.add(TEN)).div(MULTIPLIER))
        rewards_bob = ((new BN(timestamp_withdraw_alice)).sub(new BN(timestamp_deposit_bob))).mul(N).mul(TEN).div(TEN.add(TEN)).div(MULTIPLIER)
        
        await time.increase(time.duration.days(30))

        timestamp_withdraw_bob = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: bob })).receipt.blockNumber)).timestamp

        rewards_alice = rewards_alice.add(((new BN(timestamp_withdraw_bob)).sub(new BN(timestamp_withdraw_alice))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))
        rewards_bob = rewards_bob.add(((new BN(timestamp_withdraw_bob)).sub(new BN(timestamp_withdraw_alice))).mul(N).mul(TEN).div(TEN.add(FIVE)).div(MULTIPLIER))

        await time.increase(time.duration.days(9*30))

        let end = timestamp_deposit_alice + 60*60*24*30*12 //(await web3.eth.getBlock(await web3.eth.getBlockNumber())).timestamp

        rewards_alice = rewards_alice.add(((new BN(end)).sub(new BN(timestamp_withdraw_bob))).mul(N).mul(FIVE).div(TEN).div(MULTIPLIER))
        rewards_bob = rewards_bob.add(((new BN(end)).sub(new BN(timestamp_withdraw_bob))).mul(N).mul(FIVE).div(TEN).div(MULTIPLIER))
        
        console.log((await Staking.nextReward(alice)).toString(), '&&', rewards_alice.toString())
        console.log((await Staking.nextReward(bob)).toString(), '&&' ,rewards_bob.toString())
       // console.log((await tokenReward.balanceOf(Staking.address)).toString())
        
        await Staking.claim({ from: alice })
        await Staking.claim({ from: bob })

        //console.log((await tokenReward.balanceOf(Staking.address)).toString())
    }) 
   
    it('#4 deposit for alice ang eva 10 tokens -> Increase time - 30days -> deposit for bob 5 tokens and withdraw for eva and alice 5 tokens ->  Increase time - 30days -> check claiming', async () => {
        let timestamp_deposit_alice, timestamp_deposit_bob, timestamp_deposit_eva, timestamp_claim_alice, timestamp_claim_bob, timestamp_claim_eva, timestamp_withdraw_alice, timestamp_withdraw_bob, timestamp_withdraw_eva, rewards_alice, rewards_bob, rewards_eva

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })

        timestamp_deposit_alice = (await web3.eth.getBlock((await Staking.deposit(TEN, { from: alice })).receipt.blockNumber)).timestamp

        timestamp_deposit_eva = (await web3.eth.getBlock((await Staking.deposit(TEN, { from: eva })).receipt.blockNumber)).timestamp
        
        rewards_alice = ((new BN(timestamp_deposit_eva)).sub(new BN(timestamp_deposit_alice))).mul(N).div(MULTIPLIER)

        await time.increase(time.duration.days(30))

        timestamp_deposit_bob = (await web3.eth.getBlock((await Staking.deposit(FIVE, { from: bob })).receipt.blockNumber)).timestamp

        rewards_alice = rewards_alice.add(((new BN(timestamp_deposit_bob)).sub(new BN(timestamp_deposit_eva))).mul(N).mul(TEN).div(TEN.add(TEN)).div(MULTIPLIER))
        rewards_eva = ((new BN(timestamp_deposit_bob)).sub(new BN(timestamp_deposit_eva))).mul(N).mul(TEN).div(TEN.add(TEN)).div(MULTIPLIER)

        timestamp_withdraw_alice = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: alice })).receipt.blockNumber)).timestamp
        
        rewards_alice = rewards_alice.add(((new BN(timestamp_withdraw_alice)).sub(new BN(timestamp_deposit_bob))).mul(N).mul(TEN).div(TEN.add(TEN).add(FIVE)).div(MULTIPLIER))
        rewards_eva = rewards_eva.add(((new BN(timestamp_withdraw_alice)).sub(new BN(timestamp_deposit_bob))).mul(N).mul(TEN).div(TEN.add(TEN).add(FIVE)).div(MULTIPLIER))
        rewards_bob = (((new BN(timestamp_withdraw_alice)).sub(new BN(timestamp_deposit_bob))).mul(N).mul(FIVE).div(TEN.add(TEN).add(FIVE)).div(MULTIPLIER))

        timestamp_withdraw_eva = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: eva })).receipt.blockNumber)).timestamp

        rewards_alice = rewards_alice.add(((new BN(timestamp_withdraw_eva)).sub(new BN(timestamp_withdraw_alice))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))
        rewards_eva = rewards_eva.add(((new BN(timestamp_withdraw_eva)).sub(new BN(timestamp_withdraw_alice))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))
        rewards_bob = rewards_bob.add(((new BN(timestamp_withdraw_eva)).sub(new BN(timestamp_withdraw_alice))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))

        await time.increase(time.duration.days(30))

        let end = timestamp_withdraw_eva + 60*60*24*30

        rewards_alice = rewards_alice.add(((new BN(end)).sub(new BN(timestamp_withdraw_eva))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))
        rewards_eva = rewards_eva.add(((new BN(end)).sub(new BN(timestamp_withdraw_eva))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))
        rewards_bob = rewards_bob.add(((new BN(end)).sub(new BN(timestamp_withdraw_eva))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))

        console.log((await Staking.nextReward(alice)).toString(),' && ', rewards_alice.toString())
        console.log((await Staking.nextReward(bob)).toString(),' && ', rewards_bob.toString())
        console.log((await Staking.nextReward(eva)).toString(),' && ', rewards_eva.toString())
    })
    */

})