const {
    BN,
    time,          
    expectRevert, 
} = require('@openzeppelin/test-helpers');

/*const STO = new BN((100*10**18).toString())
const FIVE = new BN((5*10**18).toString())
const FIVE_ = new BN((5).toString())
const THREE = new BN('3')
const TEN = new BN((10*10**18).toString())
const REWARDS = new BN((60*60*24*30*12*10**18).toString())
const YEAR = new BN((60*60*24*30*12).toString())
const DAY = new BN((60*60*24*30).toString())
const N = REWARDS.div(YEAR)*/

const STO = new BN((100*10**18).toString())
const FIVE = new BN((5*10**18).toString())
const FIVE_ = new BN((5).toString())
const THREE = new BN('3')
const TEN = new BN((10*10**18).toString())
const REWARDS = new BN((60*60*24*30*12*10**18).toString())
const YEAR = new BN((60*60*24*30*12).toString())
const DAY = new BN((60*60*24).toString())
const N = REWARDS.div(YEAR)

const _Staking = artifacts.require("Staking");
const TestToken = artifacts.require("TestToken_ERC");

contract('Staking', (accounts) => {
    let value, tokenReward, tokenStaked, Staking

    before(async () => { 
        tokenReward = await TestToken.new('TEST_reward', 'T_r', {from:accounts[0]})
        tokenStaked = await TestToken.new('TEST_staked', 'T_s', {from:accounts[0]})
      
        Staking = await _Staking.new({from:accounts[0]})

        await tokenReward.transfer(Staking.address, REWARDS)
        await Staking.init(tokenStaked.address, tokenReward.address, {from:accounts[0]})
    })

    it('transfer stakedtokens to each account and make approve for Staking ', async () => {
        let i = 1;
        while( i < 10){
            await tokenStaked.transfer(accounts[i], STO, {from:accounts[0]})
            await tokenStaked.approve(Staking.address , STO, {from:accounts[i]})
            value = await tokenStaked.balanceOf(accounts[i])
            assert.equal(value.toString(), STO)
            value = await tokenStaked.allowance(accounts[i], Staking.address)
            assert.equal(value.toString(), STO)
            i = i + 1
        }  
    })

    it('deposit 5 tokens from account 1 and after 15 days 10 tokens from account 2', async () => {
        await Staking.deposit(FIVE, {from:accounts[1]})

        value = await tokenStaked.balanceOf(accounts[1])
        assert.equal(value.toString(), (STO.sub(FIVE)).toString())

        value = await tokenStaked.balanceOf(Staking.address)
        assert.equal(value.toString(), (FIVE).toString())
        
        await time.increase(time.duration.days(15))
        
        await Staking.deposit(TEN, {from:accounts[2]})     
        
        value = await tokenStaked.balanceOf(accounts[2])
        assert.equal(value.toString(), (STO.sub(TEN)).toString())

        value = await tokenStaked.balanceOf(Staking.address)
        assert.equal(value.toString(), (FIVE.add(TEN)).toString())
    })

    it('increase time on 5 days and claim for accouns 1 and 5', async () => {
        await time.increase(time.duration.days(5))

        await Staking.claim({from:accounts[1]})

        value = await tokenReward.balanceOf(accounts[1])
        console.log('expect equal:', value.toString(),' and ', (((N.mul(DAY).mul(THREE).mul(FIVE_).mul(FIVE)).div(FIVE)).add((N.mul(FIVE).mul(DAY).mul(FIVE_)).div(FIVE.add(TEN)))).toString())

        await Staking.claim({from:accounts[2]})

        value = await tokenReward.balanceOf(accounts[2])
        console.log('expect equal:', value.toString(),' and ', ((N.mul(DAY).mul(FIVE_).mul(TEN)).div(FIVE.add(TEN))).toString()) 
    })
    /*
    it('deposit 5 tokens for account 3 then increase time on 5 days and second claim for accouns 1 and 5', async () => {
       
        await Staking.deposit(FIVE, {from:accounts[3]})     
        
        value = await tokenStaked.balanceOf(accounts[3])
        assert.equal(value.toString(), (STO.sub(FIVE)).toString())

        value = await tokenStaked.balanceOf(Staking.address)
        assert.equal(value.toString(), (FIVE.add(TEN).add(FIVE)).toString())
       
        await time.increase(time.duration.days(5))


        value = await Staking.getGlobal()
        console.log(value.toString())

        await Staking.claim({from:accounts[1]})
        value = await tokenReward.balanceOf(accounts[1])
        console.log('expect equal:', value.toString(),' and ', ((N.mul(FIVE).mul(DAY).mul(FIVE_)).div(TEN.add(TEN))).toString())


        await Staking.claim({from:accounts[2]})
        value = await tokenReward.balanceOf(accounts[2])
        console.log('expect equal:', value.toString(),' and ', ((N.mul(TEN).mul(DAY).mul(FIVE_)).div(TEN.add(TEN))).toString())
        
        await Staking.claim({from:accounts[3]})
        value = await tokenReward.balanceOf(accounts[3])
        console.log('expect equal:', value.toString(),' and ', ((N.mul(DAY).mul(FIVE_).mul(TEN)).div(TEN.add(TEN))).toString()) 
    })*/
 
})



