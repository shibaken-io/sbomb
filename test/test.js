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
const _SEVEN = new BN('7')

const _TEN = new BN('10')
const _FIFTEEN = new BN('15')
const _STO = new BN('100')

const MULTIPLIER  = new BN((10**19).toString())
const TWO = new BN((2*10**18).toString())
const TROI = new BN((3*10**18).toString())
const FIVE = new BN((5 * 10 ** 18).toString())
const TEN = new BN((10 * 10 ** 18).toString())
const STO = new BN((100 * 10 ** 18).toString())
//const REWARDS = (new BN('269200')).mul(new BN((60*60*24*30*12).toString())).div(new BN((60*60*24*7).toString()))
//const REWARDS = (new BN('403800')).mul(new BN((60*60*24*30*12).toString())).div(new BN((60*60*24*7).toString()))
//const REWARDS = (new BN('201900')).mul(new BN((60*60*24*30*12).toString())).div(new BN((60*60*24*7).toString()))
const REWARDS = (new BN('471100')).mul(new BN((60*60*24*30*12).toString())).div(new BN((60*60*24*7).toString()))

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

        let timestamp_deposit_1 = (await web3.eth.getBlock((await Staking.deposit(FIVE, { from: alice })).receipt.blockNumber)).timestamp

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_1.toString())
        expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals(_ZERO)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE)
        expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(_ZERO)
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
        
        try {
            expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(glKoffM)
        } catch {
            expect(Math.abs((await Staking.getUserInfo(alice)).globalCoefficientMinus.sub(glKoffM))).to.be.lessThanOrEqual(1)
        }
        
        try {
            expect((await Staking.getUserInfo(alice)).assignedReward.div(MULTIPLIER).div(MULTIPLIER)).to.be.bignumber.equals((new BN(timestamp_withdraw_1)).sub(new BN(timestamp_deposit_1)).mul(MULTIPLIER).mul(N).div(MULTIPLIER).div(MULTIPLIER))
        } catch {
            expect(Math.abs(((await Staking.getUserInfo(alice)).assignedReward.div(MULTIPLIER).div(MULTIPLIER)).sub((new BN(timestamp_withdraw_1)).sub(new BN(timestamp_deposit_1)).mul(MULTIPLIER).mul(N).div(MULTIPLIER).div(MULTIPLIER))) ).to.be.lessThanOrEqual(1)
        }

        try {
            expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(glKoffM)
        } catch {
            expect(Math.abs((await Staking.getPoolInfo())._globalCoefficient.sub(glKoffM))).to.be.lessThanOrEqual(1)
        }

        await time.increase(time.duration.days(15))
        
        let timestamp_claim_1 = (await web3.eth.getBlock((await Staking.claim({ from: alice })).receipt.blockNumber)).timestamp 

        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals((STO.sub(FIVE)).add(withoutFee))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TWO)
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))

        rewards_alice = N.mul((new BN(timestamp_claim_1)).sub(new BN(timestamp_deposit_1))).div(MULTIPLIER)
        
        try {
            expect((await tokenReward.balanceOf(alice))).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(1)
        }
    
        try {
            expect(await tokenReward.balanceOf(alice)).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(1)
        }

        try {
            expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.equals(REWARDS.sub(rewards_alice))
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(Staking.address)).sub(REWARDS.sub(rewards_alice)))).to.be.lessThanOrEqual(1)
        }
     

        try {
            expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(glKoffM)
        } catch {
            expect(Math.abs((await Staking.getPoolInfo())._globalCoefficient.sub(glKoffM)).toString()).to.be.lessThanOrEqual(1)
        }
     
        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(TWO)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_1.toString())
        
        try {
            expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(glKoffM)
        } catch {
            expect(Math.abs((await Staking.getUserInfo(alice)).globalCoefficientMinus.sub(glKoffM))).to.be.lessThanOrEqual(1)
        }

        await time.increase(time.duration.days(1))
        
        let timestamp_deposit_2 = (await web3.eth.getBlock((await Staking.deposit(TROI, { from: alice })).receipt.blockNumber)).timestamp
         
        try {
            expect((await tokenReward.balanceOf(alice))).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(1)
        }
        
        try {
            expect((await tokenReward.balanceOf(Staking.address))).to.be.bignumber.equals(REWARDS.sub(rewards_alice))
        } catch {
            expect(Math.abs(((await tokenReward.balanceOf(Staking.address))).sub(REWARDS.sub(rewards_alice)))).to.be.lessThanOrEqual(1)
        }
        
        rewards_alice = N.mul((new BN(timestamp_deposit_2)).sub(new BN(timestamp_claim_1))).div(MULTIPLIER)
        
        try {
            expect(await Staking.getReward(alice)).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs((await Staking.getReward(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(1)
        }
        
        glKoff = glKoff.add(((new BN(timestamp_deposit_2)).sub(new BN(timestamp_withdraw_1))).mul(MULTIPLIER).div(TWO))
        
        try {
            expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(glKoff)
        } catch {
            expect(Math.abs((await Staking.getPoolInfo())._globalCoefficient.sub(glKoff)).toString()).to.be.lessThanOrEqual(1)
        }

        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals((STO.sub(FIVE)).add(withoutFee).sub(TROI))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE)
     
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE)
        expect((await Staking.getPoolInfo())._lastUpdate).to.be.bignumber.equals(timestamp_deposit_2.toString())
        
        try {
            expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(glKoff)
        } catch {
            expect(Math.abs((await Staking.getUserInfo(alice)).globalCoefficientMinus.sub(glKoff)).toString()).to.be.lessThanOrEqual(1)
        }

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        let assignedReward = ((new BN(timestamp_deposit_2)).sub(new BN(timestamp_claim_1))).mul(N).mul(TWO).mul(MULTIPLIER).div(TWO)
        
        try {
            expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals(assignedReward)
        } catch {
            expect(Math.abs(((await Staking.getUserInfo(alice)).assignedReward.sub(assignedReward)).div(MULTIPLIER))).to.be.lessThanOrEqual(parseInt(N))
        }

        await time.increase(time.duration.days(30*11))

        let end = timestamp_deposit_1 + 60*60*24*30*12
        let timestamp_withdraw_2 = (await web3.eth.getBlock((await Staking.withdraw(FIVE , { from: alice })).receipt.blockNumber)).timestamp

        rewards_alice = rewards_alice.add(N.mul((new BN(end)).sub(new BN(timestamp_deposit_2))).div(MULTIPLIER))
        
        try {
            expect((await Staking.geNextReward(alice))).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs(((await Staking.getReward(alice)).sub(rewards_alice)))).to.be.lessThanOrEqual(parseInt(N))
        }
        
        //await Staking.claim({ from: alice })

        percents = (TROI.mul(_THREE.add(_THREE))).div(_STO)
        withoutFee = TROI.sub(percents)
        value = (STO.sub(TROI)).add(withoutFee)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(_ZERO)
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals((STO.sub(percents)))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.equals(_ZERO)
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))
        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(_ZERO)
        
        expect((await tokenReward.balanceOf(Staking.address))).to.be.bignumber.equals(_ZERO)
    })
    
    it('#2 Deposit 5 tokens from Alice -> Increase time - 30days -> Deposit 10 tokens from Bob -> Increase time - 30days -> Claim', async () => {
        let rewards_alice, rewards_bob, timestamp_deposit_alice, timestamp_deposit_bob, timestamp_claim_alice, timestamp_claim_bob, timestamp_withdraw_alice, timestamp_withdraw_bob, timestamp_claim_alice_1, timestamp_claim_bob_1

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })

        timestamp_deposit_alice = (await web3.eth.getBlock((await Staking.deposit(FIVE, { from: alice })).receipt.blockNumber)).timestamp

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_alice.toString())
        expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals(_ZERO)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE)
        expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(_ZERO)
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
        expect((await Staking.getUserInfo(bob)).assignedReward).to.be.bignumber.equals(_ZERO)
        
        try {
            expect((await Staking.getUserInfo(bob)).globalCoefficientMinus).to.be.bignumber.equals(koff)
        } catch {
            expect(Math.abs((await Staking.getUserInfo(bob)).globalCoefficientMinus.sub(koff)).toString()).to.be.lessThanOrEqual(1)
        }

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE.add(TEN))
        expect((await Staking.getPoolInfo())._lastUpdate).to.be.bignumber.equals(timestamp_deposit_bob.toString())
        
        try {
            expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(koff)
        } catch {
            expect(Math.abs((await Staking.getPoolInfo())._globalCoefficient.sub(koff)).toString()).to.be.lessThanOrEqual(1)
        }

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

        try {
            expect(await tokenReward.balanceOf(alice)).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(1)
        }

        try {
            expect(await tokenReward.balanceOf(bob)).to.be.bignumber.equals(rewards_bob)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(bob)).sub(rewards_bob))).to.be.lessThanOrEqual(1)
        }
       
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(bob)).to.be.bignumber.that.equals(STO.sub(TEN))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE.add(TEN))
        try {
            expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS.sub(rewards_alice).sub(rewards_bob))
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(Staking.address)).sub(REWARDS.sub(rewards_alice).sub(rewards_bob)))).to.be.lessThanOrEqual(2)
        }  

        await time.increase(time.duration.days(30*11))

        timestamp_withdraw_alice = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: alice })).receipt.blockNumber)).timestamp
        timestamp_withdraw_bob = (await web3.eth.getBlock((await Staking.withdraw(TEN, { from: bob })).receipt.blockNumber)).timestamp
        
        let end = timestamp_deposit_alice + 60*60*24*30*12 

       
        //await Staking.claim({ from: alice })
       // await Staking.claim({ from: bob })
        
        rewards_alice = rewards_alice.add( N.mul((new BN(end)).sub(new BN(timestamp_claim_alice))).mul(FIVE).div(FIVE.add(TEN)).div(MULTIPLIER) )
        rewards_bob = rewards_bob.add(N.mul((new BN(end)).sub(new BN(timestamp_claim_bob))).mul(TEN).div(FIVE.add(TEN)).div(MULTIPLIER))
        
        try {
            expect(await tokenReward.balanceOf(alice)).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(4)
        }
    
        rewards_bob = (((new BN(end)).sub(new BN(timestamp_claim_bob))).mul(N).mul(TEN).div(FIVE.add(TEN)).div(MULTIPLIER))
        
        expect((await tokenReward.balanceOf(Staking.address))).to.be.bignumber.equals(_ZERO)
    })
    
    it('#3 Deposit 10 tokens from Alice -> Increase time - 30days -> Deposit 10 tokens from Bob -> Increase time - 30days -> WITHDRAW 5 tokens for Alice -> Increase time - 30days -> WITHDRAW 5 tokens for bob -> Increase time - 30days -> CLAIM', async () => {

        let koff, timestamp_deposit_alice, timestamp_deposit_bob, timestamp_claim_alice, timestamp_claim_bob, timestamp_withdraw_alice, timestamp_withdraw_bob, rewards_alice, rewards_bob

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

        expect((await Staking.getUserInfo(bob)).amount).to.be.bignumber.equals(TEN)
        expect((await Staking.getUserInfo(bob)).start).to.be.bignumber.equals(timestamp_deposit_bob.toString())
        expect((await Staking.getUserInfo(bob)).assignedReward).to.be.bignumber.equals(_ZERO)
        
        koff = ((new BN(timestamp_deposit_bob)).sub(new BN(timestamp_deposit_alice))).mul(MULTIPLIER).div(TEN)
       
        try {
            expect((await Staking.getUserInfo(bob)).globalCoefficientMinus).to.be.bignumber.equals(koff)
        } catch {
            expect(Math.abs((await Staking.getUserInfo(bob)).globalCoefficientMinus.sub(koff))).to.be.lessThanOrEqual(parseInt(N.div(MULTIPLIER)))
        }
        
        koff = koff.add(((new BN(timestamp_withdraw_alice)).sub(new BN(timestamp_deposit_bob))).mul(MULTIPLIER).div(TEN.add(TEN)))
       
        try {
            expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(koff)
        } catch {
            expect(Math.abs((await Staking.getPoolInfo())._globalCoefficient.sub(koff))).to.be.lessThanOrEqual(parseInt(N.div(MULTIPLIER)))
        }
    
        try {
            expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(koff)
        } catch {
            expect(Math.abs((await Staking.getUserInfo(alice)).globalCoefficientMinus.sub(koff))).to.be.lessThanOrEqual(parseInt(N.div(MULTIPLIER)))
        }

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_alice.toString())
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE.add(TEN))
       
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(bob)).to.be.bignumber.that.equals(STO.sub(TEN))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE.add(TEN))

        expect(await tokenReward.balanceOf(alice)).to.be.bignumber.that.equals(_ZERO)
        expect(await tokenReward.balanceOf(bob)).to.be.bignumber.that.equals(_ZERO)
        expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.equals(REWARDS)
        
        timestamp_withdraw_bob = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: bob })).receipt.blockNumber)).timestamp

        rewards_alice = rewards_alice.add(((new BN(timestamp_withdraw_bob)).sub(new BN(timestamp_withdraw_alice))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))
        rewards_bob = rewards_bob.add(((new BN(timestamp_withdraw_bob)).sub(new BN(timestamp_withdraw_alice))).mul(N).mul(TEN).div(TEN.add(FIVE)).div(MULTIPLIER))

        await time.increase(time.duration.days(9*30))

        let end = timestamp_deposit_alice + 60*60*24*30*12 

        rewards_alice = rewards_alice.add(((new BN(end)).sub(new BN(timestamp_withdraw_bob))).mul(N).mul(FIVE).div(TEN).div(MULTIPLIER))
        rewards_bob = rewards_bob.add(((new BN(end)).sub(new BN(timestamp_withdraw_bob))).mul(N).mul(FIVE).div(TEN).div(MULTIPLIER))
        rewards_alice = await Staking.getReward(alice)
        
        await Staking.claim({ from: alice })
        await Staking.claim({ from: bob })
    
        await Staking.withdraw(FIVE, { from: alice })
        await Staking.withdraw(FIVE, { from: bob })

        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(STO)
        expect(await tokenStaked.balanceOf(bob)).to.be.bignumber.that.equals(STO) 
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.equals(_ZERO)

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getUserInfo(bob)).amount).to.be.bignumber.equals(_ZERO)

        expect((await tokenReward.balanceOf(Staking.address))).to.be.bignumber.equals(_ZERO)
    }) 
   
    it('#4 deposit for alice ang eva 10 tokens -> Increase time - 30days -> deposit for bob 5 tokens and withdraw for eva and alice 5 tokens ->  Increase time - 30days -> check claiming', async () => {
        let timestamp_deposit_alice, timestamp_deposit_bob, timestamp_deposit_eva, timestamp_claim_alice, timestamp_claim_bob, timestamp_claim_eva, timestamp_withdraw_alice, timestamp_withdraw_bob, timestamp_withdraw_eva, rewards_alice, rewards_bob, rewards_eva

        await tokenStaked.transfer(Staking.address, TEN, { from: owner })

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

        try {
            expect((await Staking.getReward(alice))).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs((await Staking.getReward(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(2)
        }
        
        try {
            expect((await Staking.getReward(bob))).to.be.bignumber.equals(rewards_bob)
        } catch {
            expect(Math.abs((await Staking.getReward(bob)).sub(rewards_bob))).to.be.lessThanOrEqual(1)
        }

        try {
            expect((await Staking.getReward(eva))).to.be.bignumber.equals(rewards_eva)
        } catch {
            expect(Math.abs((await Staking.getReward(eva)).sub(rewards_eva))).to.be.lessThanOrEqual(2)
        }

        await time.increase(time.duration.days(10*30))
        
        await Staking.withdraw(FIVE, { from: alice })
        await Staking.withdraw(FIVE, { from: bob })
        await Staking.withdraw(FIVE, { from: eva })

       // await Staking.claim({ from: alice })
       // await Staking.claim({ from: bob })
      //  await Staking.claim({ from: eva })

        await Staking.getTokensForOwner( owner, {from: owner} )

        expect((await tokenReward.balanceOf(Staking.address))).to.be.bignumber.equals(_ZERO)
    })

    it('#5 check requires', async () => {

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })
        
        await expectRevert(
            Staking.deposit( _ZERO, { from: alice }) ,
            "Staking: amount == 0"
        ); 

        await Staking.deposit( FIVE, { from: alice })

        await expectRevert(
            Staking.withdraw( TEN, { from: alice }) ,
            "Staking: _user.amount >= amount"
        ); 

        await time.increase(time.duration.days(30))

        await Staking.deposit( FIVE, { from: bob })

        await time.increase(time.duration.days(30))

        await Staking.withdraw( FIVE, { from: alice })

       // await Staking.claim({ from: alice })
        
        await expectRevert(
            Staking.claim({ from: alice }) ,
            "Staking: rewards != 0"
        ); 

        await Staking.emergencyExit({from: owner})

        expect((await tokenReward.balanceOf(Staking.address))).to.be.bignumber.equals(_ZERO)

        await time.increase(time.duration.days(12*30))

        await expectRevert(
            Staking.deposit( FIVE, { from: alice }) ,
            "Staking: out of time"
        ); 

       
    })

    it('#6 Check seconds', async () => {
        let rewards_alice, rewards_bob, timestamp_deposit_alice, timestamp_deposit_bob, timestamp_claim_alice, timestamp_claim_bob, timestamp_withdraw_alice, timestamp_withdraw_bob, timestamp_claim_alice_1, timestamp_claim_bob_1
        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })
        timestamp_deposit_alice = (await web3.eth.getBlock((await Staking.deposit(FIVE, { from: alice })).receipt.blockNumber)).timestamp
        await time.increase(time.duration.days(30))
        await Staking.deposit(FIVE, { from: alice })
        await Staking.claim({ from: alice })
        await time.increase(2)
        timestamp_claim_alice = (await web3.eth.getBlock((await Staking.claim({ from: alice })).receipt.blockNumber)).timestamp
        rewards_alice = N.mul((new BN(timestamp_claim_alice)).sub(new BN(timestamp_deposit_alice))).div(MULTIPLIER)
        try {
            expect(await tokenReward.balanceOf(alice)).to.be.bignumber.equals(grewards_alice)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(2)
        }
    })

    it('#7 test process whith the situation stakedSum == 0 at some moment of time', async () => {
        let rewards_alice, rewards_bob, timestamp_deposit_alice, timestamp_deposit_bob, timestamp_deposit_eva, timestamp_claim_alice, timestamp_claim_bob, timestamp_claim_eva, timestamp_withdraw_alice, timestamp_withdraw_bob, timestamp_withdraw_eva, timestamp_claim_alice_1, timestamp_claim_bob_1

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})        
        await Staking.initStaking(tokenStaked.address, tokenReward.address, devWallet, YEAR, { from: owner })

        timestamp_deposit_alice = (await web3.eth.getBlock((await Staking.deposit(FIVE, { from: alice })).receipt.blockNumber)).timestamp
        let end = timestamp_deposit_alice + 60*60*24*30*13

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        expect((await Staking.getUserInfo(alice)).start).to.be.bignumber.equals(timestamp_deposit_alice.toString())
        expect((await Staking.getUserInfo(alice)).globalCoefficientMinus).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getUserInfo(alice)).assignedReward).to.be.bignumber.equals(_ZERO)

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE)
        expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(_ZERO)
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
        expect((await Staking.getUserInfo(bob)).assignedReward).to.be.bignumber.equals(_ZERO)
        
        try {
            expect((await Staking.getUserInfo(bob)).globalCoefficientMinus).to.be.bignumber.equals(koff)
        } catch {
            expect(Math.abs((await Staking.getUserInfo(bob)).globalCoefficientMinus.sub(koff)).toString()).to.be.lessThanOrEqual(1)
        }

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(FIVE.add(TEN))
        expect((await Staking.getPoolInfo())._lastUpdate).to.be.bignumber.equals(timestamp_deposit_bob.toString())
        
        try {
            expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(koff)
        } catch {
            expect(Math.abs((await Staking.getPoolInfo())._globalCoefficient.sub(koff)).toString()).to.be.lessThanOrEqual(1)
        }

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

        try {
            expect(await tokenReward.balanceOf(alice)).to.be.bignumber.equals(rewards_alice)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(alice)).sub(rewards_alice))).to.be.lessThanOrEqual(1)
        }

        try {
            expect(await tokenReward.balanceOf(bob)).to.be.bignumber.equals(rewards_bob)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(bob)).sub(rewards_bob))).to.be.lessThanOrEqual(1)
        }

        timestamp_withdraw_alice = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: alice })).receipt.blockNumber)).timestamp  
        
        koff = koff.add((new BN(timestamp_withdraw_alice)).sub(new BN(timestamp_deposit_bob)).mul(MULTIPLIER).div(FIVE.add(TEN)))
        
        timestamp_withdraw_bob = (await web3.eth.getBlock((await Staking.withdraw(TEN, { from: bob })).receipt.blockNumber)).timestamp 

        koff = koff.add((new BN(timestamp_withdraw_bob)).sub(new BN(timestamp_withdraw_alice)).mul(MULTIPLIER).div(TEN))


        await time.increase(time.duration.days(30))

        
       
        timestamp_deposit_eva = (await web3.eth.getBlock((await Staking.deposit(TEN, { from: eva })).receipt.blockNumber)).timestamp
      
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN)
        expect((await Staking.getPoolInfo())._lastUpdate).to.be.bignumber.equals(timestamp_deposit_eva.toString())
        
        try {
            expect((await Staking.getPoolInfo())._globalCoefficient).to.be.bignumber.equals(koff)
        } catch {
            expect(Math.abs((await Staking.getPoolInfo())._globalCoefficient.sub(koff)).toString()).to.be.lessThanOrEqual(1)
        }

        expect(await tokenStaked.balanceOf(eva)).to.be.bignumber.that.equals(STO.sub(TEN))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TEN)

        await time.increase(time.duration.days(30))

        timestamp_claim_eva = (await web3.eth.getBlock((await Staking.claim({ from: eva })).receipt.blockNumber)).timestamp
        timestamp_deposit_alice = (await web3.eth.getBlock((await Staking.deposit(FIVE, { from: alice })).receipt.blockNumber)).timestamp
        let rewards_eva = (new BN(timestamp_claim_eva)).sub(new BN(timestamp_deposit_eva)).mul(N).div(MULTIPLIER)
        
        expect(await tokenReward.balanceOf(eva)).to.be.bignumber.that.equals(rewards_eva)

        await time.increase(time.duration.days(10*30))

        timestamp_withdraw_eva = (await web3.eth.getBlock((await Staking.withdraw(TEN, { from: eva })).receipt.blockNumber)).timestamp
        timestamp_withdraw_alice = (await web3.eth.getBlock((await Staking.withdraw(FIVE, { from: alice })).receipt.blockNumber)).timestamp
        
       // timestamp_claim_eva = (await web3.eth.getBlock((await Staking.claim({ from: eva })).receipt.blockNumber)).timestamp
      // timestamp_claim_alice = (await web3.eth.getBlock((await Staking.claim({ from: alice })).receipt.blockNumber)).timestamp
        
        rewards_eva = rewards_eva.add(((new BN(end)).sub(new BN(timestamp_deposit_alice))).mul(N).mul(TEN).div(TEN.add(FIVE)).div(MULTIPLIER))
        
        try {
            expect(await tokenReward.balanceOf(eva)).to.be.bignumber.equals(rewards_eva)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(eva)).sub(rewards_eva))).to.be.lessThanOrEqual(2)
        }

        rewards_alice = rewards_alice.add(((new BN(end)).sub(new BN(timestamp_deposit_alice))).mul(N).mul(FIVE).div(TEN.add(FIVE)).div(MULTIPLIER))
    
        try {
            expect(await tokenReward.balanceOf(eva)).to.be.bignumber.equals(rewards_eva)
        } catch {
            expect(Math.abs((await tokenReward.balanceOf(eva)).sub(rewards_eva))).to.be.lessThanOrEqual(2)
        }
    })

})
