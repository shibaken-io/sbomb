const { expect } = require('chai');
const { BN, expectEvent, expectRevert, makeInterfaceId, time } = require('@openzeppelin/test-helpers');
const { string } = require('yargs');
const { bigNumberify } = require('ethers/utils');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const { zeroAddress } = require('ethereumjs-util');
const Lottery = artifacts.require('Lottery');
const LINK = artifacts.require('LINKMock');

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
const TWENTY = new BN(20);

const DECIMALS = new BN(18);
const ONE_TOKEN = TEN.pow(DECIMALS);
const TWO_TOKEN = ONE_TOKEN.mul(TWO);

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_BYTES32 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
let VALID_AMOUNT;
let BALANCE = ONE_TOKEN.mul(TEN).mul(TEN).mul(FIVE);

require('dotenv').config();

contract (
    'Lottery',
    ([
        deployer,
        admin,
        register,
        VRFCoordinator,
        user1,
        user2,
        user3,
        user4,
        user5,
        throwawayuser
    ]) => {

        beforeEach (async () => {

            VALID_AMOUNT = ONE_TOKEN.div(TEN).div(TEN);

            LINKInst = await LINK.new(
                "LINK",
                "LINK"
            );

            LotteryInst = await Lottery.new(
                VRFCoordinator,
                LINKInst.address,
                MAX_BYTES32,
                ONE_TOKEN,
                VALID_AMOUNT
            );

            await LotteryInst.grantRole(await LotteryInst.DEFAULT_ADMIN_ROLE(), admin);
            await LotteryInst.grantRole(await LotteryInst.REGISTER_ROLE(), register);
            await LotteryInst.renounceRole(await LotteryInst.DEFAULT_ADMIN_ROLE(), deployer);

            await LINKInst.mint(LotteryInst.address, ONE_TOKEN.mul(new BN(100)));
        })

        it('One user lottery test', async () => {

            for (let i = 0; i < (await LotteryInst.txInit()).toNumber(); i++) {
                await LotteryInst.register(user1, {from: register, value: VALID_AMOUNT});
            }
            expect(await LotteryInst.currentQueue()).bignumber.equal(ONE);
            expect(await LotteryInst.lastRequested()).bignumber.equal(ONE);
            expect(await LotteryInst.lastFulfilled()).bignumber.equal(ONE);
            expect(await LotteryInst.lastWinner()).equal(user1);
            expect(new BN(await web3.eth.getBalance(user1))).bignumber.equal(await ONE_TOKEN.mul(new BN(100)).add(new BN(await LotteryInst.txInit()).mul(VALID_AMOUNT)));
            BALANCE = BALANCE.add(new BN(await web3.eth.getBalance(user1))).sub(ONE_TOKEN.mul(new BN(100)));
        })

        it('Zero users lottery test', async () => {

            for (let i = 0; i < (await LotteryInst.txInit()).toNumber(); i++) {
                await LotteryInst.register(user2, {from: register, value: VALID_AMOUNT.sub(ONE)});
            }
            expect(await LotteryInst.currentQueue()).bignumber.equal(ONE);
            expect(await LotteryInst.lastRequested()).bignumber.equal(ONE);
            expect(await LotteryInst.lastFulfilled()).bignumber.equal(ONE);
            expect(await LotteryInst.lastWinner()).equal(ZERO_ADDRESS);
            for (let i = 0; i < (await LotteryInst.txInit()).toNumber(); i++) {
                await LotteryInst.register(user2, {from: register, value: VALID_AMOUNT});
            }
            expect(await LotteryInst.currentQueue()).bignumber.equal(TWO);
            expect(await LotteryInst.lastRequested()).bignumber.equal(TWO);
            expect(await LotteryInst.lastFulfilled()).bignumber.equal(TWO);
            expect(await LotteryInst.lastWinner()).equal(user2);
            expect(new BN(await web3.eth.getBalance(user2))).bignumber.equal(await ONE_TOKEN.mul(new BN(100)).add(new BN(await LotteryInst.txInit()).mul(VALID_AMOUNT).add(VALID_AMOUNT.sub(ONE).mul(await LotteryInst.txInit()))));
            BALANCE = BALANCE.add(new BN(await LotteryInst.txInit()).mul(VALID_AMOUNT).add(VALID_AMOUNT.sub(ONE).mul(await LotteryInst.txInit())));
        })

        it('Different users lottery and setters test', async () => {

            let OLD_TX = await LotteryInst.txInit();
            VALID_AMOUNT = VALID_AMOUNT.div(TEN);
            await LotteryInst.setValidAmount(ONE_TOKEN.div(TEN).div(TEN).div(TEN), {from: admin});
            await LotteryInst.setTxInit(THREE, {from: admin});
            expect(await LotteryInst.txInit()).bignumber.equal(THREE);

            for (let i = 0; i < OLD_TX.toNumber(); i++) {
                await LotteryInst.register(throwawayuser, {from: register, value: ZERO});
            }

            expect(await LotteryInst.currentQueue()).bignumber.equal(ONE);
            expect(await LotteryInst.lastRequested()).bignumber.equal(ONE);
            expect(await LotteryInst.lastFulfilled()).bignumber.equal(ONE);
            expect(await LotteryInst.lastWinner()).equal(ZERO_ADDRESS);

            await LotteryInst.register(user3, {from: register, value: VALID_AMOUNT});
            await LotteryInst.register(user4, {from: register, value: VALID_AMOUNT});
            await LotteryInst.register(user5, {from: register, value: VALID_AMOUNT});

            expect(await LotteryInst.currentQueue()).bignumber.equal(TWO);
            expect(await LotteryInst.lastRequested()).bignumber.equal(TWO);
            expect(await LotteryInst.lastFulfilled()).bignumber.equal(ONE);
            expect(await LotteryInst.lastWinner()).equal(ZERO_ADDRESS);

            await LotteryInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});

            expect(await LotteryInst.currentQueue()).bignumber.equal(TWO);
            expect(await LotteryInst.lastRequested()).bignumber.equal(TWO);
            expect(await LotteryInst.lastFulfilled()).bignumber.equal(TWO);
            expect(await LotteryInst.lastWinner()).equal(user3);
        })

        it('Gas test', async () => {

            const LotteryGas = artifacts.require('LotteryGas');

            LotteryInst = await LotteryGas.new(
                VRFCoordinator,
                LINKInst.address,
                MAX_BYTES32,
                ONE_TOKEN,
                VALID_AMOUNT
            );

            await LotteryInst.grantRole(await LotteryInst.DEFAULT_ADMIN_ROLE(), admin);
            await LotteryInst.grantRole(await LotteryInst.REGISTER_ROLE(), register);
            await LotteryInst.renounceRole(await LotteryInst.DEFAULT_ADMIN_ROLE(), deployer);

            await LINKInst.mint(LotteryInst.address, ONE_TOKEN.mul(new BN(100)));

            await LotteryInst.register(user1, {from: register, value: VALID_AMOUNT});
            for (let i = 0; i < (await LotteryInst.txInit()).toNumber() - 1; i++) {
                await LotteryInst.register(user2, {from: register, value: VALID_AMOUNT});
            }

            expect(await LotteryInst.currentQueue()).bignumber.equal(TWO.pow(new BN(256)).sub(ONE));
            expect(await LotteryInst.lastRequested()).bignumber.equal(TWO.pow(new BN(256)).sub(ONE));
            expect(await LotteryInst.lastFulfilled()).bignumber.equal(TWO.pow(new BN(256)).sub(TWO));
            expect(await LotteryInst.lastWinner()).equal(ZERO_ADDRESS);

            let tx = await LotteryInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});
            expect(new BN(tx.receipt.gasUsed)).bignumber.lt(new BN(200000));
            console.log(tx.receipt.gasUsed);
        })

        it('Gas test #2', async () => {

            await LotteryInst.register(user1, {from: register, value: VALID_AMOUNT});
            for (let i = 0; i < (await LotteryInst.txInit()).toNumber() - 1; i++) {
                await LotteryInst.register(user2, {from: register, value: VALID_AMOUNT});
            }

            expect(await LotteryInst.currentQueue()).bignumber.equal(ONE);
            expect(await LotteryInst.lastRequested()).bignumber.equal(ONE);
            expect(await LotteryInst.lastFulfilled()).bignumber.equal(ZERO);
            expect(await LotteryInst.lastWinner()).equal(ZERO_ADDRESS);

            let tx = await LotteryInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});
            expect(new BN(tx.receipt.gasUsed)).bignumber.lt(new BN(200000));
            console.log(tx.receipt.gasUsed);
        })
    }
)