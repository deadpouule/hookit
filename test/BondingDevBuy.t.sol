// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {FeeEscrow} from "../src/FeeEscrow.sol";
import {ProtocolRevenueDistributor} from "../src/ProtocolRevenueDistributor.sol";
import {GraduatedFeeHook} from "../src/GraduatedFeeHook.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {LaunchToken} from "../src/LaunchToken.sol";

contract BondingDevBuyTest is Test, Deployers {
    using CurrencyLibrary for Currency;

    FeeEscrow internal escrow;
    ProtocolRevenueDistributor internal distributor;
    GraduatedFeeHook internal feeHook;
    BondingLaunchFactory internal bonding;

    address internal ops = address(0xB0B);
    address internal creator = address(0xC0FFEE);

    function setUp() public {
        deployFreshManagerAndRouters();
        vm.deal(creator, 100 ether);

        escrow = new FeeEscrow(address(this), manager);
        distributor = new ProtocolRevenueDistributor(address(this), ops, manager);

        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
        );
        address hookAddr = address(flags | (uint160(0xB0AD) << 144));
        bytes memory args = abi.encode(manager, escrow, distributor, address(this));
        deployCodeTo("GraduatedFeeHook.sol:GraduatedFeeHook", args, hookAddr);
        feeHook = GraduatedFeeHook(payable(hookAddr));

        bonding = new BondingLaunchFactory(manager, feeHook, escrow, distributor, address(this), ops);
        feeHook.setFactory(address(bonding));

        escrow.setOperator(address(bonding), true);
        escrow.setOperator(address(feeHook), true);
        distributor.setOperator(address(bonding), true);
        distributor.setOperator(address(feeHook), true);
    }

    function test_AtomicDevBuyOnLaunch() public {
        uint256 devBuy = 0.05 ether;
        vm.prank(creator);
        (uint256 launchId, address token) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI + devBuy}(
            BondingLaunchFactory.LaunchParams({
                name: "Dev",
                symbol: "DEV",
                metadataURI: "",
                totalSupply: 0,
                quote: Currency.wrap(address(0)),
                creatorTaxBps: 0,
                devBuyQuoteIn: devBuy,
                minDevBuyTokensOut: 1
            })
        );

        assertGt(IERC20Minimal(token).balanceOf(creator), 0);
        (,,,,,, uint256 tokensSold,,,,,,,) = bonding.launches(launchId);
        assertGt(tokensSold, 0);
    }
}
