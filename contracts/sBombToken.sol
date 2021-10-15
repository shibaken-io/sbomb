// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Factory.sol";

/**
 * @dev Implementation of the sBomb Token.
 *
 * Deflationary token mechanics:
 *
 * When buy/sell on Sushiswap or Pancakeswap:
 *
 * Buy tax: 6%, =
 * 5% Lottery (see below). Need to be converted to ETH or BNB and sent to the lottery contract.
 * 1% SHIBAK buy and burn 
 * 
 * Sell tax: 20%, =
 * 10% SHIBAK buy and burn
 * 5% to team wallet
 * 5% to sBOMB liquidity pool
 */
contract sBombToken is ERC20, Ownable{

    address public dexRouter;
    address public immutable SHIBAKEN;
    address public teamWallet;
    address public lotteryContract;

    //buy/sell taxes for deflationary token
    uint256 public constant LOTTERY_BUY_TAX = 5;
    uint256 public constant SHIBAK_BUY_TAX = 1;
    uint256 public constant SHIBAK_SELL_TAX = 10;
    uint256 public constant TEAM_SELL_TAX = 5;
    uint256 public constant LIQ_SELL_TAX = 5;

    address private constant DEAD_ADDRESS = address(0x000000000000000000000000000000000000dEaD);

    constructor(address _shibakenToken, address _dex) ERC20("sBOMB", "SBOMB") {
        SHIBAKEN = _shibakenToken;
        dexRouter = _dex;

        uint256 initialSupply = 10 ** 8 * 10 ** uint256(decimals());
        _mint(_msgSender(), initialSupply);
    }

    function setLotteryContarct(address _lottery) external onlyOwner{
        require(_lottery != address(0));
        lotteryContract = _lottery;
    }

    function changeTeamWallet(address _wallet) external onlyOwner{
        require(_wallet != address(0));
        teamWallet = _wallet;
    }

    function setDexRouter(address _dex) external onlyOwner{
        require(_dex != address(0));
        dexRouter = _dex;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        _beforeTokenTransfer(sender, recipient, amount);
        uint256 totalFee;
        if(sender == dexRouter) {
            uint256 lotteryFee = _sendLotteryFee(amount);
            uint256 burnFee = _sendBurnFee(true, amount);

            //count total fee, buy tax ~= 6%
            totalFee = burnFee + lotteryFee;
        }
        else if(recipient == dexRouter) {
            uint256 burnFee = _sendBurnFee(false, amount);
            uint256 toTeam = _sendTeamFee(amount);
            uint256 toLiquidity = _sendLiqFee(amount);

            //count total fee, sell tax ~= 20%
            totalFee = burnFee + toTeam + toLiquidity;
        }
        super._transfer(sender, recipient, amount - totalFee);
    }

    function _sendLotteryFee(uint256 amount) private returns(uint256 lotteryFee) {
        lotteryFee = amount * LOTTERY_BUY_TAX / 100;

        //swap sBomb to ETH/BNB and send to the lottery contract
        IUniswapV2Router router = IUniswapV2Router(dexRouter);
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();
        uint256[] memory amounts = router.swapExactTokensForETH(
            lotteryFee,
            0,
            path,
            address(this),
            block.timestamp + 15 minutes
        );
        require(amounts[1] > 0, "Zero ETH");
        bool success;
        (success, ) = payable(lotteryContract).call{
            value: amounts[1]
        }("");
        require(success, "Lottery fee transfer error");
        lotteryFee = amounts[0];
    }

    function _sendBurnFee(bool isBuyTax, uint256 amount) private returns(uint256 burnFee){
        burnFee = isBuyTax ? amount * SHIBAK_BUY_TAX / 100 : amount * SHIBAK_SELL_TAX / 100;

        //swap sBomb to Shibaken and burn it
        IUniswapV2Router router = IUniswapV2Router(dexRouter);
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = SHIBAKEN;
        uint256[] memory amounts = router.swapExactTokensForTokens(
            burnFee,
            0,
            path,
            DEAD_ADDRESS,
            block.timestamp + 15 minutes
        );
        burnFee = amounts[0];
    }

    function _sendTeamFee(uint256 amount) private returns(uint256 teamFee){
        teamFee = amount * TEAM_SELL_TAX / 100;

        //swap sBomb token to ETH/BNB and send to the team wallet
        IUniswapV2Router router = IUniswapV2Router(dexRouter);
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();
        uint256[] memory amounts = router.swapExactTokensForETH(
            teamFee,
            0,
            path,
            teamWallet,
            block.timestamp + 15 minutes
        );
        teamFee = amounts[0];
    }

    function _sendLiqFee(uint256 amount) private returns(uint256 liqFee){
        liqFee = amount * LIQ_SELL_TAX / 100;

        //swap 1/2 of toLiquidity-sBomb token, add liquidity into ETH/BNB-sBomb pair and burn LP tokens
        IUniswapV2Router router = IUniswapV2Router(dexRouter);
        address[] memory path = new address[](2);
        path[0] = address(this);
        path[1] = router.WETH();
        uint256[] memory amounts = router.swapExactTokensForETH(
            liqFee/2,
            0,
            path,
            address(this),
            block.timestamp + 15 minutes
        );

        router.addLiquidityETH{
            value: amounts[1]
        }(
            address(this),
            liqFee-amounts[0],
            0,
            0,
            DEAD_ADDRESS,
            block.timestamp + 15 minutes
        );
    }
}