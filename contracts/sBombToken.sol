// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IUniswapV2Router.sol";

contract sBombToken is ERC20, Ownable{

    address public dexRouter;
    address public immutable SHIBAKEN;
    address public teamWallet;
    address public lotteryContract;

    uint256 public constant LOTTERY_BUY_TAX = 5;
    uint256 public constant SHIBAK_BUY_TAX = 1;
    uint256 public constant SHIBAK_SELL_TAX = 10;
    uint256 public constant TEAM_SELL_TAX = 5;
    uint256 public constant LIQ_SELL_TAX = 5;

    constructor(address _shibakenToken, address _dex) ERC20("sBOMB", "SBOMB") {
        SHIBAKEN = _shibakenToken;
        dexRouter = _dex;

        uint256 initialSupply = 10 ** 8 * 10 ** uint256(decimals());
        _mint(_msgSender(), initialSupply);
    }

    function setLotteryContarct(address _lottery) external onlyOwner{
        lotteryContract = _lottery;
    }

    function changeTeamWallet(address _wallet) external onlyOwner{
        require(_wallet != address(0));
        teamWallet = _wallet;
    }

    function _transfer(address sender, address recipient, uint256 amount) internal virtual override {
        _beforeTokenTransfer(sender, recipient, amount);
        uint256 totalFee;
        if(sender == dexRouter) {
            uint256 lotteryFee = amount * LOTTERY_BUY_TAX / 100;
            uint256 burnFee = amount * SHIBAK_BUY_TAX / 100;
            //totalFee = burnFee + lotteryFee;

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
            //payable(lotteryContract).transfer(amounts[1]);
            //super._transfer(sender, lotteryContract, amounts[1]);
            //TODO: 1% SHIBAK buy and burn

            totalFee = burnFee + amounts[0];
        }
        else if(recipient == dexRouter) {
            uint256 burnFee = amount * SHIBAK_SELL_TAX / 100;
            uint256 toTeam = amount * TEAM_SELL_TAX / 100;
            uint256 toLiquidity = amount * LIQ_SELL_TAX / 100;
            //totalFee = burnFee + toTeam + toLiquidity;

            //TODO: 10% SHIBAK buy and burn
            super._transfer(sender, teamWallet, toTeam);
            IUniswapV2Router router = IUniswapV2Router(dexRouter);
            address[] memory path = new address[](2);
            path[0] = address(this);
            path[1] = router.WETH();
            uint256[] memory amounts = router.swapExactTokensForETH(
                toLiquidity/2,
                0,
                path,
                address(this),
                block.timestamp + 15 minutes
            );
            router.addLiquidityETH{
                value: amounts[1]
            }(
                address(this),
                toLiquidity-amounts[0],
                0,
                0,
                address(this),
                block.timestamp + 15 minutes
            );

            totalFee = burnFee + toTeam + toLiquidity;
        }
        super._transfer(sender, recipient, amount - totalFee);
    }
}