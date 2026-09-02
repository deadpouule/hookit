// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {FeeEscrow} from "../../src/FeeEscrow.sol";
import {LaunchFactory} from "../../src/LaunchFactory.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {ProtocolConstants} from "../../src/libraries/ProtocolConstants.sol";

/// @notice Creator wallet that can receive ETH and pull from FeeEscrow.
contract CreatorFeeWallet {
    receive() external payable {}

    function claim(FeeEscrow escrow, Currency currency) external {
        escrow.claim(currency);
    }

    function claimAll(FeeEscrow escrow, Currency[] calldata currencies) external {
        escrow.claimAll(currencies);
    }

    function launchEth(
        LaunchFactory factory,
        uint256 bitmask,
        uint256 totalSupply
    ) external payable returns (uint256 launchId, address token, PoolId poolId) {
        return factory.launch{value: msg.value}(
            LaunchFactory.LaunchParams({
                name: "Contract",
                symbol: "CTR",
                metadataURI: "",
                totalSupply: totalSupply,
                quote: Currency.wrap(address(0)),
                tickSpacing: 60,
                startingTick: 0,
                bitmask: bitmask,
                customHook: IHooks(address(0)),
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
    }
}

/// @notice Contract creator without receive() — claim reverts on native payouts (UGH-class trap).
contract CreatorFeeWalletNoReceive {
    function claim(FeeEscrow escrow, Currency currency) external {
        escrow.claim(currency);
    }
}
