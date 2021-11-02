// SPDX-License-Identifier: MIT
pragma solidity 0.8.9;

interface ITimeBomb {

    function register(address account, uint256 _sBombAmount) external payable;
}