// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IUniswapV2Router.sol";
import "./interfaces/IUniswapV2Factory.sol";
import "./interfaces/IUniswapV2Pair.sol";
import "./pancake-swap/libraries/TransferHelper.sol";

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
contract sBombToken is ERC20, Ownable {
    IUniswapV2Router public dexRouter;
    address public immutable SHIBAKEN;
    address public teamWallet;
    address public lotteryContract;

    //buy/sell taxes for deflationary token
    uint256 public constant LOTTERY_BUY_TAX = 5;
    uint256 public constant SHIBAK_BUY_TAX = 1;
    uint256 public constant SHIBAK_SELL_TAX = 10;
    uint256 public constant TEAM_SELL_TAX = 5;
    uint256 public constant LIQ_SELL_TAX = 5;

    address private constant DEAD_ADDRESS =
        address(0x000000000000000000000000000000000000dEaD);

    bool private inSwap;

    event BuyTaxTaken(uint256 toLottery, uint256 toBurn, uint256 total);
    event SellTaxTaken(
        uint256 toBurn,
        uint256 toTeam,
        uint256 toLiquidity,
        uint256 total
    );

    modifier lockTheSwap() {
        inSwap = true;
        _;
        inSwap = false;
    }

    constructor(address _shibakenToken, IUniswapV2Router _dex)
        ERC20("sBOMB", "SBOMB")
    {
        SHIBAKEN = _shibakenToken;
        dexRouter = _dex;

        uint256 initialSupply = 10**8 * 10**uint256(decimals());
        _mint(_msgSender(), initialSupply);
    }

    receive() external payable {}

    /** @dev Owner function for setting lottery contarct address
     * @param _lottery lottery contract address
     */
    function setLotteryContarct(address _lottery) external onlyOwner {
        require(_lottery != address(0));
        lotteryContract = _lottery;
    }

    /** @dev Owner function for setting team wallet address
     * @param _wallet team wallet address
     */
    function changeTeamWallet(address _wallet) external onlyOwner {
        require(_wallet != address(0));
        teamWallet = _wallet;
    }

    /** @dev Owner function for setting DEX router address
     * @param _dex DEX router address
     */
    function setDexRouter(IUniswapV2Router _dex) external onlyOwner {
        require(address(_dex) != address(0));
        dexRouter = _dex;
    }

    /** @dev Public payable function for adding liquidity in SBOMB-ETH pair without 20% fee
     * @param tokenAmount sBomb token amount
     * @param amountTokenMin min sBomb amount going to pool
     * @param amountETHMin min ETH amount going to pool
     * @param to address for LP-tokens
     */
    function noFeeAddLiquidityETH(
        uint256 tokenAmount,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to
    ) external payable lockTheSwap {
        require(msg.value > 0 && tokenAmount > 0, "ZERO");
        TransferHelper.safeTransferFrom(address(this), _msgSender(), address(this), tokenAmount);
        _approve(address(this), address(dexRouter), tokenAmount);
        (uint256 token, uint256 eth, ) = dexRouter.addLiquidityETH{value: msg.value}(
            address(this),
            tokenAmount,
            amountTokenMin,
            amountETHMin,
            to,
            block.timestamp
        );
        if(tokenAmount > token)
            TransferHelper.safeTransfer(address(this), _msgSender(), tokenAmount - token);
        if(msg.value > eth)
            payable(_msgSender()).transfer(msg.value - eth);
    }

    /** @dev Public payable function for adding liquidity in SBOMB-<TOKEN> pair without 20% fee
     * @param token1 another token address
     * @param tokenAmount0 sBomb token amount
     * @param tokenAmount1 another token amount
     * @param amountToken0Min min sBomb amount going to pool
     * @param amountToken0Min min <TOKEN> amount going to pool
     * @param to address for LP-tokens
     */
    function noFeeAddLiquidity(
        address token1,
        uint256 tokenAmount0,
        uint256 tokenAmount1,
        uint256 amountToken0Min,
        uint256 amountToken1Min,
        address to
    ) external lockTheSwap {
        require(tokenAmount0 > 0 && tokenAmount1 > 0, "ZERO");
        TransferHelper.safeTransferFrom(address(this), _msgSender(), address(this), tokenAmount0);
        _approve(address(this), address(dexRouter), tokenAmount0);
        TransferHelper.safeTransferFrom(token1, _msgSender(), address(this), tokenAmount1);
        TransferHelper.safeApprove(token1, address(dexRouter), tokenAmount1);
        (uint256 finalToken0, uint256 finalToken1, ) = dexRouter.addLiquidity(
            address(this),
            token1,
            tokenAmount0,
            tokenAmount1,
            amountToken0Min,
            amountToken1Min,
            to,
            block.timestamp
        );

        if(finalToken0 < tokenAmount0)
            TransferHelper.safeTransfer(address(this), _msgSender(), tokenAmount0 - finalToken0);

        if(finalToken1 < tokenAmount1)
            TransferHelper.safeTransfer(token1, _msgSender(), tokenAmount1 - finalToken1);
    }

    function _swapTokensForEth(
        uint256 tokenAmount,
        address to,
        address[] memory path
    ) internal lockTheSwap {
        dexRouter.swapExactTokensForETHSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            to,
            block.timestamp
        );
    }

    function _swapTokensForTokens(
        uint256 tokenAmount,
        address to,
        address[] memory path
    ) internal lockTheSwap {
        dexRouter.swapExactTokensForTokensSupportingFeeOnTransferTokens(
            tokenAmount,
            0,
            path,
            to,
            block.timestamp
        );
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal virtual override {
        uint256 totalFee;

        if (!inSwap) {
            if (_pairCheck(sender)) {
                uint256 lotteryFee = (LOTTERY_BUY_TAX * amount) / 100;
                uint256 burnFee = (SHIBAK_BUY_TAX * amount) / 100;
                totalFee = lotteryFee + burnFee;

                super._transfer(sender, address(this), totalFee);
                _approve(address(this), address(dexRouter), totalFee);

                //LOTTERY FEE
                if (
                    sender ==
                    address(
                        IUniswapV2Factory(dexRouter.factory()).getPair(
                            address(this),
                            dexRouter.WETH()
                        )
                    )
                ) {
                    address[] memory path = new address[](3);
                    path[0] = address(this);
                    path[1] = SHIBAKEN;
                    path[2] = dexRouter.WETH();

                    if (_pairExisting(path))
                        _swapTokensForEth(lotteryFee, lotteryContract, path);
                } else {
                    address[] memory path = new address[](2);
                    path[0] = address(this);
                    path[1] = dexRouter.WETH();
                    if (_pairExisting(path))
                        _swapTokensForEth(lotteryFee, lotteryContract, path);
                }

                //BURN FEE
                if (
                    sender ==
                    address(
                        IUniswapV2Factory(dexRouter.factory()).getPair(
                            address(this),
                            SHIBAKEN
                        )
                    )
                ) {
                    address[] memory path = new address[](3);
                    path[0] = address(this);
                    path[1] = dexRouter.WETH();
                    path[2] = SHIBAKEN;
                    if (_pairExisting(path))
                        _swapTokensForTokens(burnFee, DEAD_ADDRESS, path);
                } else {
                    address[] memory path = new address[](2);
                    path[0] = address(this);
                    path[1] = SHIBAKEN;
                    if (_pairExisting(path))
                        _swapTokensForTokens(burnFee, DEAD_ADDRESS, path);
                }

                emit BuyTaxTaken(lotteryFee, burnFee, totalFee);
            } else if (
                _pairCheck(recipient) && address(dexRouter) == _msgSender()
            ) {
                uint256 burnFee = (SHIBAK_SELL_TAX * amount) / 100;
                uint256 toTeam = (TEAM_SELL_TAX * amount) / 100;
                uint256 toLiquidity = (LIQ_SELL_TAX * amount) / 100;
                totalFee = burnFee + toTeam + toLiquidity;

                //BURN FEE
                address[] memory path = new address[](2);
                path[0] = address(this);
                path[1] = SHIBAKEN;
                if (_pairExisting(path)) {
                    super._transfer(sender, address(this), burnFee);
                    _approve(address(this), address(dexRouter), burnFee);
                    _swapTokensForTokens(burnFee, DEAD_ADDRESS, path);
                }

                //TEAM FEE
                path[1] = dexRouter.WETH();
                if (_pairExisting(path)) {
                    super._transfer(sender, address(this), toTeam);
                    _approve(address(this), address(dexRouter), toTeam);
                    _swapTokensForEth(toTeam, teamWallet, path);
                }

                //LIQUIDITY FEE
                if (_pairExisting(path)) {
                    super._transfer(sender, address(this), toLiquidity);
                    _approve(address(this), address(dexRouter), toLiquidity);
                    uint256 half = toLiquidity / 2;
                    uint256 anotherHalf = toLiquidity - half;
                    _swapTokensForEth(half, address(this), path);
                    inSwap = true;
                    (uint256 tokenAmount , , ) = dexRouter.addLiquidityETH{value: address(this).balance}(
                        address(this),
                        anotherHalf,
                        0,
                        0,
                        DEAD_ADDRESS,
                        block.timestamp + 15 minutes
                    );
                    if (tokenAmount < anotherHalf)
                        super._transfer(address(this), recipient, anotherHalf - tokenAmount);
                    inSwap = false;
                }

                emit SellTaxTaken(burnFee, toTeam, toLiquidity, totalFee);
            }
        }

        super._transfer(sender, recipient, amount - totalFee);
    }

    function _pairExisting(address[] memory path) internal view returns (bool) {
        uint8 len = uint8(path.length);

        IUniswapV2Factory factory = IUniswapV2Factory(dexRouter.factory());
        address pair;
        uint256 reserve0;
        uint256 reserve1;

        for (uint8 i; i < len - 1; i++) {
            pair = factory.getPair(path[i], path[i + 1]);
            if (pair != address(0)) {
                (reserve0, reserve1, ) = IUniswapV2Pair(pair).getReserves();
                if ((reserve0 == 0 || reserve1 == 0)) return false;
            } else {
                return false;
            }
        }

        return true;
    }

    function _pairCheck(address _token) internal view returns (bool) {
        address token0;
        address token1;

        if (isContract(_token)) {
            try IUniswapV2Pair(_token).token0() returns (address _token0) {
                token0 = _token0;
            } catch {
                return false;
            }

            try IUniswapV2Pair(_token).token1() returns (address _token1) {
                token1 = _token1;
            } catch {
                return false;
            }

            address goodPair = IUniswapV2Factory(
                IUniswapV2Router(dexRouter).factory()
            ).getPair(token0, token1);
            if (goodPair != _token) {
                return false;
            }

            if (token0 == address(this) || token1 == address(this)) return true;
            else return false;
        } else return false;
    }

    function isContract(address addr) internal view returns (bool) {
        uint256 size;
        assembly {
            size := extcodesize(addr)
        }
        return size > 0;
    }
}
