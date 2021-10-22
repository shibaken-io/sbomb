const {
    BN,
    time,
    expectRevert,
} = require('@openzeppelin/test-helpers');
const { expect } = require("chai");

const _ZERO = new BN('0')
const _TWO = new BN('2')
const _THREE = new BN('3')
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
        
        Staking = await _Staking.new(tokenStaked.address, tokenReward.address, devWallet, REWARDS, YEAR, { from: owner })

        await tokenReward.transfer(Staking.address, REWARDS, {from: owner})
    })

    it('#1 check conditions and transfer stakedtokens to each account and make approve for Staking ', async () => {

        expect((await Staking.getPoolInfo())._stakedToken).to.be.equals(tokenStaked.address)
        expect((await Staking.getPoolInfo())._devWallet).to.be.equals(devWallet)
        expect((await Staking.getPoolInfo())._globalKoeff).to.be.bignumber.equals(_ZERO)
        //expect((await Staking.getPoolInfo())._token_speed).to.be.bignumber.equals(_STO.sub(_TEN))
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
    })
     
    it('#2 deposit 5 tokens from  and 10 from bob', async () => {
        
        await Staking.deposit(FIVE, { from: alice })

        value = (await Staking.getPoolInfo())._token_speed
        console.log(value.toString())

       // await Staking.deposit(TEN, { from: bob })  
        
        await time.increase(YEAR+2)

        value = await tokenReward.balanceOf(Staking.address)
        console.log(value.toString(), REWARDS.toString())

        value = await Staking.calculateRewards(alice)
        console.log(value.toString())
       // value = await Staking.calculateRewards(bob)
       // console.log(value.toString())  
    }) 

})