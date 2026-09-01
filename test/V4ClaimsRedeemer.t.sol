// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {IUnlockCallback} from "@uniswap/v4-core/src/interfaces/callback/IUnlockCallback.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {CurrencySettler} from "@uniswap/v4-core/test/utils/CurrencySettler.sol";

import {V4ClaimsRedeemer} from "../src/V4ClaimsRedeemer.sol";

contract _ClaimsMintHelper is IUnlockCallback {
    using CurrencyLibrary for Currency;

    IPoolManager immutable mgr;

    constructor(IPoolManager manager_) {
        mgr = manager_;
    }

    function mintClaims(address to, Currency currency, uint256 amount) external payable {
        mgr.unlock(abi.encode(to, currency, amount));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(mgr));
        (address to, Currency currency, uint256 amount) = abi.decode(data, (address, Currency, uint256));
        if (currency.isAddressZero()) {
            mgr.sync(currency);
            mgr.settle{value: amount}();
        } else {
            CurrencySettler.settle(currency, mgr, address(this), amount, false);
        }
        mgr.mint(to, currency.toId(), amount);
        return "";
    }
}

contract V4ClaimsRedeemerTest is Test, Deployers {
    using CurrencyLibrary for Currency;

    V4ClaimsRedeemer internal redeemer;
    _ClaimsMintHelper internal minter;
    address internal alice = address(0xA11CE);

    function setUp() public {
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();
        redeemer = new V4ClaimsRedeemer(manager);
        minter = new _ClaimsMintHelper(manager);
        vm.deal(address(this), 10 ether);
        vm.deal(alice, 1 ether);
    }

    function testClaimNativeClaims() public {
        Currency native = CurrencyLibrary.ADDRESS_ZERO;
        uint256 amount = 0.25 ether;
        minter.mintClaims{value: amount}(alice, native, amount);
        assertEq(manager.balanceOf(alice, native.toId()), amount);

        uint256 before = alice.balance;
        vm.prank(alice);
        manager.setOperator(address(redeemer), true);
        vm.prank(alice);
        uint256 redeemed = redeemer.claim(native);
        assertEq(redeemed, amount);
        assertEq(manager.balanceOf(alice, native.toId()), 0);
        assertEq(alice.balance, before + amount);
    }

    function testClaimErc20Claims() public {
        uint256 amount = 1e18;
        IERC20Minimal(Currency.unwrap(currency1)).transfer(address(minter), amount);
        minter.mintClaims(alice, currency1, amount);
        assertEq(manager.balanceOf(alice, currency1.toId()), amount);

        vm.prank(alice);
        manager.setOperator(address(redeemer), true);
        vm.prank(alice);
        uint256 redeemed = redeemer.claim(currency1);
        assertEq(redeemed, amount);
        assertEq(IERC20Minimal(Currency.unwrap(currency1)).balanceOf(alice), amount);
    }

    function testClaimPartial() public {
        Currency native = CurrencyLibrary.ADDRESS_ZERO;
        uint256 amount = 1 ether;
        minter.mintClaims{value: amount}(alice, native, amount);

        vm.prank(alice);
        manager.setOperator(address(redeemer), true);
        vm.prank(alice);
        uint256 redeemed = redeemer.claim(native, 0.4 ether);
        assertEq(redeemed, 0.4 ether);
        assertEq(manager.balanceOf(alice, native.toId()), 0.6 ether);
    }
}
