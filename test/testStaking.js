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

const DECIMAL = new BN((10**18).toString())
const TROI = new BN((3*10**18).toString())
const FIVE = new BN((5 * 10 ** 18).toString())
const TEN = new BN((10 * 10 ** 18).toString())
const STO = new BN((100 * 10 ** 18).toString())
const REWARDS = new BN((60 * 60 * 24 * 30 * 12 * 10 ** 18).toString())
const YEAR = new BN((60 * 60 * 24 * 30 * 12).toString())
const DAY = new BN((60 * 60 * 24).toString())
const N = REWARDS.mul(DECIMAL).div(YEAR)

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


    before(async () => {
        
        tokenReward = await TestToken.new('TEST_reward', 'T_r', { from: owner })
        tokenStaked = await TestToken.new('TEST_staked', 'T_s', { from: owner })
        Staking = await _Staking.new({ from: owner })  

    })

    it('#0 check exeption before initiating Staking', async () => {
        
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

    })

    it('#1 check conditions and transfer stakedtokens to each account and make approve for Staking ', async () => {

        expect((await Staking.getPoolInfo())._stakedToken).to.be.equals(tokenStaked.address)
        expect((await Staking.getPoolInfo())._devWallet).to.be.equals(devWallet)
        expect((await Staking.getPoolInfo())._globalKoeff).to.be.bignumber.equals(_ZERO)
        expect((await Staking.getPoolInfo())._token_speed).to.be.bignumber.equals(N)
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(_ZERO)
       
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
    
    it('#2 deposit 5 tokens from  alice and after 15 days 10 tokens from bob', async () => {
        
        await expectRevert(
            Staking.withdraw( FIVE, { from: alice }) ,
            "Staking: _user.amount > 0"
        ); 

        await Staking.deposit(FIVE, { from: alice })
        await time.increase(time.duration.days(15))
        await Staking.deposit(TEN, { from: bob })  
        await expectRevert(
            Staking.deposit(_ZERO, { from: bob }) ,
            "Staking: amount == 0"
        ); 
        
        value = (N.mul(_FIFTEEN).mul(DAY).mul(DECIMAL).div(FIVE).div(DECIMAL))

        expect((await Staking.getPoolInfo())._globalKoeff).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO) && (num - value) >= 0 
        });

        
        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)
        expect((await Staking.getUserInfo(bob)).amount).to.be.bignumber.equals(TEN)
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN.add(FIVE))
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(bob)).to.be.bignumber.that.equals(STO.sub(TEN))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE.add(TEN))
    })  
   
    it('#3 increase time on 5 days and claim for accouns 1 and 2', async () => { 
        
        before_alice = await tokenReward.balanceOf(alice)
        before_bob = await tokenReward.balanceOf(bob)
        
        await time.increase(time.duration.days(5))
        
        await Staking.claim({ from: alice })
        await Staking.claim({ from: bob })

        after_alice = await tokenReward.balanceOf(alice)
        after_bob = await tokenReward.balanceOf(bob)

        value = (N.mul(DAY).mul(_FIVE).mul(TEN)).div(FIVE.add(TEN).div(DECIMAL))

        expect((after_bob - before_bob)-value).to.be.lessThan(90*2)
      
        value = ((N.mul(_FIFTEEN.mul(DAY)).mul(FIVE)).div(FIVE).div(DECIMAL))
        value = value.add((N.mul(FIVE).mul(_FIVE.mul(DAY))).div(FIVE.add(TEN)).div(DECIMAL))
        
        expect((after_alice - before_alice)-value).to.be.lessThan(90*2)
    
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.equals(TEN.add(FIVE))

    })

    it('#4 deposit 5 tokens for eva then increase time on 5 days and second claim for all', async () => {

        await Staking.deposit(FIVE, { from: eva })

        value = (N.mul(_FIFTEEN).mul(DAY).mul(DECIMAL).div(FIVE).div(DECIMAL)).add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(FIVE.add(TEN)).div(DECIMAL))

        expect((await Staking.getPoolInfo())._globalKoeff).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_THREE).div(DECIMAL)
        });
              
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN.add(TEN))
        expect(await tokenStaked.balanceOf(eva)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TEN.add(TEN))

        before_alice = await tokenReward.balanceOf(alice)
        before_bob = await tokenReward.balanceOf(bob)
        before_eva = await tokenReward.balanceOf(eva)

        await time.increase(time.duration.days(5))

        await Staking.claim({ from: alice })
        await Staking.claim({ from: bob })
        await Staking.claim({ from: eva })
        
        after_alice = await tokenReward.balanceOf(alice)
        after_bob = await tokenReward.balanceOf(bob)
        after_eva = await tokenReward.balanceOf(eva)

        value = ((N.mul(FIVE).mul(DAY).mul(_FIVE)).div(TEN.add(TEN)).div(DECIMAL))
        
        expect(after_alice - before_alice).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL) 
        }) 

        value = ((N.mul(TEN).mul(DAY).mul(_FIVE)).div(TEN.add(TEN)).div(DECIMAL))

        expect(after_bob - before_bob).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL)
        })

        value = (N.mul(DAY).mul(_FIVE).mul(FIVE)).div(TEN.add(TEN)).div(DECIMAL)

        expect(after_eva - before_eva).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL)
        }) 

    })
    
    it('#5 withdraw 5 tokens of alice before ending of lockup`s period', async () => {
        before_alice = await tokenReward.balanceOf(alice)
        before_alice_staked = await tokenStaked.balanceOf(alice)

        await expectRevert(
            Staking.withdraw(FIVE.add(TEN), { from: alice }) ,
            "Staking: _user.amount >= amount"
        ); 

        await expectRevert(
            Staking.withdraw( _ZERO, { from: alice }) ,
            "Staking: amount > 0"
        ); 

        await Staking.withdraw(FIVE, {from: alice})

        after_alice = await tokenReward.balanceOf(alice)
        
        value = (N.mul(TEN).mul(_TWO)).div(TEN.add(TEN)).div(DECIMAL)

        expect(after_alice - before_alice).to.satisfy(function(num) {
            return Math.abs(num - value) < N 
        }) 
        
        let percents = (FIVE.mul(_THREE.add(_THREE))).div(_STO)
        let withoutFee = FIVE.sub(percents)
        value = (STO.sub(FIVE)).add(withoutFee)

        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(value)
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN.add(FIVE))
        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(_ZERO)
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TEN.add(FIVE))
       
        value = (N.mul(_FIFTEEN).mul(DAY).mul(DECIMAL).div(FIVE).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(FIVE.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))

        expect((await Staking.getPoolInfo())._globalKoeff).to.satisfy(function(num) {
            return Math.abs(num - value) < N.div(DECIMAL)
        });

    })

    it('#6 deposit 5 tokens for alice then increase time on 5 days and deposit 5 tokens for eva ', async () => {

        let percents = (FIVE.mul(_THREE.add(_THREE))).div(_STO)
        let withoutFee = FIVE.sub(percents)

        await Staking.deposit(FIVE, { from: alice })

        value = (N.mul(_FIFTEEN).mul(DAY).mul(DECIMAL).div(FIVE).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(FIVE.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TWO).mul(DECIMAL).div(TEN.add(FIVE)).div(DECIMAL))
        
        expect((await Staking.getPoolInfo())._globalKoeff).to.satisfy(function(num) {
            return Math.abs(num - value) < N.div(DECIMAL)
        });
        
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN.add(TEN))
        value = (STO.sub(TEN)).add(withoutFee)
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(value)
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TEN.add(TEN))
        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(FIVE)

        await time.increase(time.duration.days(5))

        await Staking.deposit(FIVE, { from: eva })

        value = (N.mul(_FIFTEEN).mul(DAY).mul(DECIMAL).div(FIVE).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(FIVE.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TWO).mul(DECIMAL).div(TEN.add(FIVE)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        
        expect((await Staking.getPoolInfo())._globalKoeff).to.satisfy(function(num) {
            return Math.abs(num - value) < N.div(DECIMAL)
        }); 
        
        expect((await Staking.getUserInfo(eva)).amount).to.be.bignumber.equals(TEN)
        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN.add(TEN).add(FIVE))
        expect(await tokenStaked.balanceOf(eva)).to.be.bignumber.that.equals(STO.sub(TEN))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TEN.add(TEN).add(FIVE))
    })

    it('#7 increase time on 5 days then check claiming for all accounts', async () => {

        before_alice = await tokenReward.balanceOf(alice)
        before_bob = await tokenReward.balanceOf(bob)
        before_eva = await tokenReward.balanceOf(eva)
        
        await time.increase(time.duration.days(5))

        await Staking.claim({ from: alice })
        await Staking.claim({ from: bob })
        await Staking.claim({ from: eva })
        
        after_alice = await tokenReward.balanceOf(alice)
        after_bob = await tokenReward.balanceOf(bob)
        after_eva = await tokenReward.balanceOf(eva)

        value = (N.mul(_FIVE).mul(DAY).mul(FIVE)).div(TEN.add(FIVE).add(TEN)).div(DECIMAL)
        value = value.add(N.mul(_FIVE).mul(DAY).mul(FIVE).div(TEN.add(TEN)).div(DECIMAL))
    
        expect(after_alice - before_alice).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL) 
        }) 

        value = (N.mul(_FIVE).mul(DAY).mul(TEN)).div(TEN.add(FIVE).add(TEN)).div(DECIMAL)
        value = value.add(N.mul(_FIVE).mul(DAY).mul(TEN).div(TEN.add(TEN)).div(DECIMAL))

        expect(after_bob - before_bob).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL)
        })

        value = ((N.mul(_FIVE).mul(DAY).mul(TEN)).div(TEN.add(FIVE).add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(FIVE).div(TEN.add(TEN)).div(DECIMAL))
        
        expect(after_eva - before_eva).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL)
        })

    })

    it('#8 increase time on 5 days then withdraw for alice last 5 tokens then increase time for 5 days and check claiming for all accounts', async () => {
        
        await time.increase(time.duration.days(5))
        
        before_alice = await tokenReward.balanceOf(alice)
        
        await Staking.withdraw(FIVE, {from: alice})

        after_alice = await tokenReward.balanceOf(alice)
        
        value = (N.mul(FIVE).mul(_FIVE).mul(DAY)).div(TEN.add(TEN).add(FIVE)).div(DECIMAL)

        expect(after_alice - before_alice).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL)
        }) 
        
        let percents = (FIVE.mul(_THREE.add(_THREE))).div(_STO)
        let withoutFee = FIVE.sub(percents)
        value = (STO.sub(FIVE)).add(withoutFee)
        
        expect(await tokenStaked.balanceOf(alice)).to.be.bignumber.that.equals(value)
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN.add(TEN))
        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(_ZERO)
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TEN.add(TEN))
        
        value = (N.mul(_FIFTEEN).mul(DAY).mul(DECIMAL).div(FIVE).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(FIVE.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TWO).mul(DECIMAL).div(TEN.add(FIVE)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TEN).mul(DAY).mul(DECIMAL).div(TEN.add(TEN).add(FIVE)).div(DECIMAL))

        expect((await Staking.getPoolInfo())._globalKoeff).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL)
        });
       
        before_alice = await tokenReward.balanceOf(alice)
        before_bob = await tokenReward.balanceOf(bob)
        before_eva = await tokenReward.balanceOf(eva)
        
        await time.increase(time.duration.days(5))
        
        await expectRevert(
            Staking.claim({ from: alice }),
            "Staking: deposit == 0"
        );
        await Staking.claim({ from: bob })
        await Staking.claim({ from: eva })
        
        after_alice = await tokenReward.balanceOf(alice)
        after_bob = await tokenReward.balanceOf(bob)
        after_eva = await tokenReward.balanceOf(eva)

        value = (N.mul(_FIVE).mul(DAY).mul(FIVE)).div(TEN.add(FIVE).add(TEN))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(FIVE).div(TEN.add(TEN)))

        expect((await Staking.getUserInfo(alice)).amount).to.be.bignumber.equals(_ZERO)
        expect((after_alice-before_alice).toString()).to.be.bignumber.equals(_ZERO)

        value = (N.mul(_FIVE).mul(DAY).mul(TEN).div(TEN.add(TEN).add(FIVE)).div(DECIMAL))
        value = value.add((N.mul(_FIVE).mul(DAY).mul(TEN).div(TEN.add(TEN)).div(DECIMAL)))

        expect(after_bob - before_bob).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL)
        })

        value = (N.mul(_FIVE).mul(DAY).mul(TEN).div(TEN.add(TEN).add(FIVE)).div(DECIMAL))
        value = value.add((N.mul(_FIVE).mul(DAY).mul(TEN).div(TEN.add(TEN))).div(DECIMAL))

        expect(after_eva - before_eva).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_TWO).div(DECIMAL)  
        })
    })

    it('#9 increase time on 5 days then withdraw for bob 3 tokens and 5 tokens for eva then increase time for 5 days and check claiming for all accounts', async () => {
        await time.increase(time.duration.days(5))

        before_bob = await tokenReward.balanceOf(bob)
        
        await Staking.withdraw(TROI, {from: bob})

        after_bob = await tokenReward.balanceOf(bob)
        
        
        value = (N.mul(TEN).mul(_FIVE).mul(DAY)).div(TEN.add(TEN)).div(DECIMAL)
        
   
        expect(Math.abs((after_bob - before_bob)-value)).to.be.lessThan(90*3)

        let percents = (FIVE.mul(_THREE.add(_THREE))).div(_STO)
        let withoutFee = FIVE.sub(percents)
        
        expect(await tokenStaked.balanceOf(bob)).to.be.bignumber.that.equals(STO.sub(TEN).add(TROI))
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN.add(TEN).sub(TROI))
        expect((await Staking.getUserInfo(bob)).amount).to.be.bignumber.equals(TEN.sub(TROI))
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TEN.add(TEN).sub(TROI))
        
        value = (N.mul(_FIFTEEN).mul(DAY).mul(DECIMAL).div(FIVE).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(FIVE.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TWO).mul(DECIMAL).div(TEN.add(FIVE)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TEN).mul(DAY).mul(DECIMAL).div(TEN.add(TEN).add(FIVE)).div(DECIMAL))
        value = value.add(N.mul(_TEN).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        
        expect(Math.abs((await Staking.getPoolInfo())._globalKoeff-value)).to.be.lessThan(90*2)
        
        before_eva = await tokenReward.balanceOf(eva)

        await Staking.withdraw(FIVE, {from: eva})

        after_eva = await tokenReward.balanceOf(eva)
        
        value = (N.mul(TEN).mul(_FIVE).mul(DAY)).div(TEN.add(TEN)).div(DECIMAL)
        expect(Math.abs((after_eva - before_eva)-value)).to.be.lessThan(90*3)

        expect(await tokenStaked.balanceOf(eva)).to.be.bignumber.that.equals(STO.sub(FIVE))
        expect(await tokenStaked.balanceOf(devWallet)).to.be.bignumber.that.equals(percents.div(_TWO))

        expect((await Staking.getPoolInfo())._stakedSum).to.be.bignumber.equals(TEN.add(FIVE).sub(TROI))
        expect((await Staking.getUserInfo(eva)).amount).to.be.bignumber.equals(FIVE)
        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(TEN.add(FIVE).sub(TROI))
        
        value = (N.mul(_FIFTEEN).mul(DAY).mul(DECIMAL).div(FIVE).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(FIVE.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TWO).mul(DECIMAL).div(TEN.add(FIVE)).div(DECIMAL))
        value = value.add(N.mul(_FIVE).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TEN).mul(DAY).mul(DECIMAL).div(TEN.add(TEN).add(FIVE)).div(DECIMAL))
        value = value.add(N.mul(_TEN).mul(DAY).mul(DECIMAL).div(TEN.add(TEN)).div(DECIMAL))
        value = value.add(N.mul(_TWO).mul(DECIMAL).div(TEN.add(TEN).sub(TROI)).div(DECIMAL))
        
   
        expect(Math.abs((await Staking.getPoolInfo())._globalKoeff-value)).to.be.lessThan(90*2)

        before_bob = await tokenReward.balanceOf(bob)
        before_eva = await tokenReward.balanceOf(eva)
        
        await time.increase(time.duration.days(5))

        await expectRevert(
            Staking.claim({ from: alice }),
            "Staking: deposit == 0"
        );
        
        await Staking.claim({ from: bob })
        await Staking.claim({ from: eva })
        
        after_bob = await tokenReward.balanceOf(bob)
        after_eva = await tokenReward.balanceOf(eva)

        value = N.mul(_FIVE).mul(DAY).mul(TEN.sub(TROI)).div(TEN.add(FIVE).sub(TROI)).div(DECIMAL)

        expect(Math.abs((after_bob - before_bob)-value)).to.be.lessThan(90*2)

        value = N.mul(_FIVE).mul(DAY).mul(FIVE).div(TEN.add(FIVE).sub(TROI)).div(DECIMAL)

        expect(Math.abs((after_eva - before_eva)-value)).to.be.lessThan(90*2)

    })
  
    it('#10 increase tome to end of year and check closing of process', async () => {
        
        before_bob = await tokenReward.balanceOf(bob)
        before_eva = await tokenReward.balanceOf(eva)

        await time.increase(time.duration.days(305))

        await expectRevert(
            Staking.deposit(FIVE, { from: alice }),
            "Staking: out of time"
        )
        await expectRevert(
            Staking.deposit(FIVE, { from: bob }),
            "Staking: out of time"
        )
        await expectRevert(
            Staking.deposit(FIVE, { from: eva }),
            "Staking: out of time"
        )

        await Staking.claim({ from: bob })
        await Staking.withdraw( TROI, { from: eva })

        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(FIVE.sub(TROI))
        
        after_bob = await tokenReward.balanceOf(bob)
        after_eva = await tokenReward.balanceOf(eva)
        
        value = N.mul(((_THREE.mul(_STO)).add(_FIVE)).mul(DAY)).mul(TEN.sub(TROI)).div(TEN.add(FIVE).sub(TROI)).div(DECIMAL)
      
        expect(after_bob - before_bob).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_FOUR).div(DECIMAL)
        })

        value = N.mul(((_THREE.mul(_STO)).add(_FIVE)).mul(DAY)).mul(FIVE).div(TEN.add(FIVE).sub(TROI)).div(DECIMAL)
       
        expect(after_eva - before_eva).to.satisfy(function(num) {
            return Math.abs(num - value) < N.mul(_FOUR).div(DECIMAL)
        })
    })
    
    it('#11 check prevent claiming after end of process', async () =>{
        expect(await Staking.calculateRewards(alice)).to.be.bignumber.that.equals(_ZERO)
        expect(await Staking.calculateRewards(bob)).to.be.bignumber.equals(_ZERO)
        expect(await Staking.calculateRewards(eva)).to.be.bignumber.that.equals(_ZERO)

        expect((await Staking.getUserInfo(eva)).amount).to.be.bignumber.equals((FIVE).sub(TROI))
        expect((await Staking.getUserInfo(bob)).amount).to.be.bignumber.equals(_ZERO)

        await expectRevert(
            Staking.claim({from:eva}),
            "Staking: rewards != 0"
        )

        await Staking.withdraw((FIVE).sub(TROI), {from:eva})


        expect(await tokenStaked.balanceOf(Staking.address)).to.be.bignumber.that.equals(_ZERO)
        expect(await tokenStaked.balanceOf(bob)).to.be.bignumber.that.equals(STO)
        expect(await tokenStaked.balanceOf(eva)).to.be.bignumber.that.equals(STO)

        value = await tokenReward.balanceOf(Staking.address) 
        expect(await tokenReward.balanceOf(Staking.address)).to.be.bignumber.that.lessThan(N.mul(_TWO).div(DECIMAL))
    })
    
})

