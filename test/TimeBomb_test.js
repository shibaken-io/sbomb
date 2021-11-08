const { expect } = require('chai');
const { BN, expectEvent, expectRevert, makeInterfaceId, time } = require('@openzeppelin/test-helpers');
const { web3 } = require('@openzeppelin/test-helpers/src/setup');
const TimeBomb = artifacts.require('TimeBombTest');
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
    'TimeBomb',
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
        throwawayuser,
    ]) => {

        beforeEach (async () => {

            VALID_AMOUNT = ONE_TOKEN.div(TEN).div(TEN);

            sBombInst = await LINK.new(
                "sBomb",
                "sBomb"
            );

            LINKInst = await LINK.new(
                "LINK",
                "LINK"
            );

            TimeBombInst = await TimeBomb.new(
                VRFCoordinator,
                LINKInst.address,
                MAX_BYTES32,
                ONE_TOKEN,
                VALID_AMOUNT,
                sBombInst.address
            );

            await TimeBombInst.grantRole(await TimeBombInst.DEFAULT_ADMIN_ROLE(), admin);
            await TimeBombInst.grantRole(await TimeBombInst.REGISTER_ROLE(), register);
            await TimeBombInst.renounceRole(await TimeBombInst.DEFAULT_ADMIN_ROLE(), deployer);

            await LINKInst.mint(TimeBombInst.address, ONE_TOKEN.mul(new BN(100)));
        })

        it('One user TimeBomb test', async () => {

            for (let i = 0; i < (await TimeBombInst.txInit()).toNumber(); i++) {
                await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
                await TimeBombInst.register(user1, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            }
            expect(await TimeBombInst.currentQueue()).bignumber.equal(ONE);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(ONE);

            expect(new BN(await web3.eth.getBalance(user1))).bignumber.equal(await ONE_TOKEN.mul(new BN(100)).add(new BN(await TimeBombInst.txInit()).mul(VALID_AMOUNT)));
        })

        it('Zero users TimeBomb test', async () => {

            for (let i = 0; i < (await TimeBombInst.txInit()).toNumber(); i++) {
                await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
                await TimeBombInst.register(user2, VALID_AMOUNT, {from: register, value: VALID_AMOUNT.sub(ONE)});
            }
            expect(await TimeBombInst.currentQueue()).bignumber.equal(ONE);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(ONE);

            for (let i = 0; i < (await TimeBombInst.txInit()).toNumber(); i++) {
                await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
                await TimeBombInst.register(user2, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            }
            expect(await TimeBombInst.currentQueue()).bignumber.equal(TWO);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(TWO);

            expect(new BN(await web3.eth.getBalance(user2))).bignumber.equal(await ONE_TOKEN.mul(new BN(100)).add(new BN(await TimeBombInst.txInit()).mul(VALID_AMOUNT).add(VALID_AMOUNT.sub(ONE).mul(await TimeBombInst.txInit()))));
        })

        it('Different users TimeBomb and setters test', async () => {

            let OLD_TX = await TimeBombInst.txInit();
            VALID_AMOUNT = VALID_AMOUNT.div(TEN);
            await TimeBombInst.setValidAmount(ONE_TOKEN.div(TEN).div(TEN).div(TEN), {from: admin});
            await TimeBombInst.setTxInit(THREE, {from: admin});
            expect(await TimeBombInst.txInit()).bignumber.equal(THREE);

            for (let i = 0; i < OLD_TX.toNumber(); i++) {
                await TimeBombInst.register(throwawayuser, ZERO, {from: register, value: ZERO});
            }

            expect(await TimeBombInst.currentQueue()).bignumber.equal(ONE);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(ONE);

            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await TimeBombInst.register(user3, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            await TimeBombInst.register(user4, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            await TimeBombInst.register(user5, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});

            expect(await TimeBombInst.currentQueue()).bignumber.equal(TWO);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(TWO);

            await TimeBombInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});

            expect(await TimeBombInst.currentQueue()).bignumber.equal(TWO);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(TWO);
        })

        it('Not in order test', async () => {

            let OLD_TX = await TimeBombInst.txInit();
            await TimeBombInst.setValidAmount(ONE_TOKEN.div(TEN).div(TEN).div(TEN), {from: admin});
            await TimeBombInst.setTxInit(TWO, {from: admin});

            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await TimeBombInst.register(user1, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            await TimeBombInst.register(user2, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            for (let i = 0; i < OLD_TX.toNumber() - 2; i++) {
                await TimeBombInst.register(user1, ZERO, {from: register, value: ZERO});
            }

            expect(await TimeBombInst.currentQueue()).bignumber.equal(ONE);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(ONE);

            await TimeBombInst.register(user1, ZERO, {from: register, value: ZERO});
            await TimeBombInst.register(user1, ZERO, {from: register, value: ZERO});
            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await TimeBombInst.register(user1, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            await TimeBombInst.register(user1, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await TimeBombInst.register(user3, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            await TimeBombInst.register(user4, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});

            expect(await TimeBombInst.currentQueue()).bignumber.equal(FOUR);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(FOUR);
            expect((await TimeBombInst.allQueues(ZERO)).winner).equal(ZERO_ADDRESS);
            expect((await TimeBombInst.allQueues(ONE)).winner).equal(ZERO_ADDRESS);
            expect((await TimeBombInst.allQueues(TWO)).winner).equal(user1);
            expect((await TimeBombInst.allQueues(THREE)).winner).equal(ZERO_ADDRESS);

            await TimeBombInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});

            expect(await TimeBombInst.currentQueue()).bignumber.equal(FOUR);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(FOUR);
            expect((await TimeBombInst.allQueues(ZERO)).winner).equal(ZERO_ADDRESS);
            expect((await TimeBombInst.allQueues(ONE)).winner).equal(ZERO_ADDRESS);
            expect((await TimeBombInst.allQueues(TWO)).winner).equal(user1);
            expect((await TimeBombInst.allQueues(THREE)).winner).equal(user4);

            await TimeBombInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});

            expect(await TimeBombInst.currentQueue()).bignumber.equal(FOUR);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(FOUR);
            expect((await TimeBombInst.allQueues(ZERO)).winner).equal(user2);
            expect((await TimeBombInst.allQueues(ONE)).winner).equal(ZERO_ADDRESS);
            expect((await TimeBombInst.allQueues(TWO)).winner).equal(user1);
            expect((await TimeBombInst.allQueues(THREE)).winner).equal(user4);
        })

        it('Gas test', async () => {

            const TimeBombGas = artifacts.require('TimeBombGas');

            TimeBombInst = await TimeBombGas.new(
                VRFCoordinator,
                LINKInst.address,
                MAX_BYTES32,
                ONE_TOKEN,
                VALID_AMOUNT,
                sBombInst.address
            );

            await TimeBombInst.grantRole(await TimeBombInst.DEFAULT_ADMIN_ROLE(), admin);
            await TimeBombInst.grantRole(await TimeBombInst.REGISTER_ROLE(), register);
            await TimeBombInst.renounceRole(await TimeBombInst.DEFAULT_ADMIN_ROLE(), deployer);

            await LINKInst.mint(TimeBombInst.address, ONE_TOKEN.mul(new BN(100)));

            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await TimeBombInst.register(user1, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT.mul(await TimeBombInst.txInit()));
            for (let i = 0; i < (await TimeBombInst.txInit()).toNumber() - 1; i++) {
                await TimeBombInst.register(user2, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            }

            expect(await TimeBombInst.currentQueue()).bignumber.equal(TWO.pow(new BN(256)).sub(ONE));
            expect(await TimeBombInst.totalFinished()).bignumber.equal(TWO.pow(new BN(256)).sub(ONE));

            let tx = await TimeBombInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});
            expect(new BN(tx.receipt.gasUsed)).bignumber.lt(new BN(200000));
            console.log(tx.receipt.gasUsed);
        })

        it('Gas test #2', async () => {

            await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
            await TimeBombInst.register(user1, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            for (let i = 0; i < (await TimeBombInst.txInit()).toNumber() - 1; i++) {
                await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
                await TimeBombInst.register(user2, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            }

            expect(await TimeBombInst.currentQueue()).bignumber.equal(ONE);
            expect(await TimeBombInst.totalFinished()).bignumber.equal(ONE);

            let tx = await TimeBombInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});
            expect(new BN(tx.receipt.gasUsed)).bignumber.lt(new BN(200000));
            console.log(tx.receipt.gasUsed);
        })

        it('Gas test #3', async () => {

            const TimeBombGasTwo = artifacts.require('TimeBombGasTwo');

            TimeBombInst = await TimeBombGasTwo.new(
                VRFCoordinator,
                LINKInst.address,
                MAX_BYTES32,
                ONE_TOKEN,
                VALID_AMOUNT,
                sBombInst.address
            );

            await TimeBombInst.grantRole(await TimeBombInst.DEFAULT_ADMIN_ROLE(), admin);
            await TimeBombInst.grantRole(await TimeBombInst.REGISTER_ROLE(), register);
            await TimeBombInst.renounceRole(await TimeBombInst.DEFAULT_ADMIN_ROLE(), deployer);

            await LINKInst.mint(TimeBombInst.address, ONE_TOKEN.mul(new BN(100)));

            for (let i = 0; i < 50; i++) {
                await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
                await sBombInst.mint(TimeBombInst.address, VALID_AMOUNT);
                await TimeBombInst.register(user1, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
                await TimeBombInst.register(user2, VALID_AMOUNT, {from: register, value: VALID_AMOUNT});
            }

            expect(await TimeBombInst.currentQueue()).bignumber.equal(new BN(50));
            expect(await TimeBombInst.totalFinished()).bignumber.equal(new BN(50));

            for (let i = 0; i < 50; i++) {
                let tx = await TimeBombInst.rawFulfillRandomness(MAX_BYTES32, TWO.pow(new BN(256)).sub(ONE), {from: VRFCoordinator});
                expect(new BN(tx.receipt.gasUsed)).bignumber.lt(new BN(200000));
                console.log(tx.receipt.gasUsed);
            }
        })
    }
)