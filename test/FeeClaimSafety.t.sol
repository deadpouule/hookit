// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchpadTestBase, LaunchTokenLike} from "./utils/LaunchpadTestBase.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";

import {BitmaskConfig} from "../src/libraries/BitmaskConfig.sol";
import {ProtocolConstants} from "../src/libraries/ProtocolConstants.sol";
import {FixedPointMath} from "../src/libraries/FixedPointMath.sol";
import {GraduatedFeeHook} from "../src/GraduatedFeeHook.sol";
import {BondingLaunchFactory} from "../src/BondingLaunchFactory.sol";
import {CreatorFeeWallet, CreatorFeeWalletNoReceive} from "./mocks/CreatorFeeWallet.sol";

/// @notice End-to-end fee safety tests — money must move from trade → escrow → wallet.
///         Classic rail requires sweepQuote before claim (unlike UGH/PONS push-model traps).
contract FeeClaimSafetyTest is LaunchpadTestBase {
    using CurrencyLibrary for Currency;

    GraduatedFeeHook internal feeHook;
    BondingLaunchFactory internal bonding;

    address internal creator = address(0xC0FFEE);
    address internal trader = address(0xBEEF);
    address internal keeper = address(uint160(0x7337));

    Currency internal constant ETH = Currency.wrap(address(0));

    function setUp() public {
        deployProtocol();
        deployBondingRail();
        vm.deal(creator, 100 ether);
        vm.deal(trader, 100 ether);
        vm.deal(keeper, 10 ether);
    }

    function deployBondingRail() internal {
        uint160 flags =
            uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG);
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
        feeHook.setOperator(address(this), true);
    }

    // ─── Master rail: trade → escrow → claim (no intermediate trap) ─────────

    function test_MasterRail_SwapThenClaim_MovesEthToCreator() public {
        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 100;
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);
        token;

        buyExactIn(key, 5 ether);

        uint256 escrowBal = escrow.balanceOf(address(this), ETH);
        assertGt(escrowBal, 0, "fees must credit FeeEscrow on master rail");

        uint256 before = address(this).balance;
        escrow.claim(ETH);
        assertEq(address(this).balance - before, escrowBal, "claim must deliver full escrow balance");
        assertEq(escrow.balanceOf(address(this), ETH), 0);
    }

    function test_MasterRail_ProtocolFees_DistributePermissionless() public {
        (, address token,, PoolKey memory key) = launchToken(defaultModules(), 0, 1_000_000_000e18);
        token;

        buyExactIn(key, 3 ether);
        uint256 pending = distributor.pending(ETH);
        assertGt(pending, 0);

        uint256 opsBefore = ops.balance;
        vm.prank(keeper);
        distributor.distribute(ETH);
        assertGt(ops.balance, opsBefore, "anyone can trigger protocol distribute");
        assertEq(distributor.pending(ETH), 0);
    }

    /// @dev Plain Master launch (default modules): protocol share splits 20% ops / 80% buybackEth.
    function test_NormalToken_MasterRail_Protocol8020_OpsAndBuybackEth() public {
        (, address token,, PoolKey memory key) = launchToken(defaultModules(), 0, 1_000_000_000e18);
        token;

        buyExactIn(key, 5 ether);
        uint256 bal = LaunchTokenLike(token).balanceOf(address(this));
        sellExactIn(key, token, bal / 4);

        uint256 pending = distributor.pending(ETH);
        assertGt(pending, 0, "normal token accrues protocol fees");

        uint256 opsBefore = ops.balance;
        uint256 buybackBefore = distributor.buybackEth();
        distributor.distribute(ETH);

        uint256 opsReceived = ops.balance - opsBefore;
        uint256 buybackReceived = distributor.buybackEth() - buybackBefore;
        assertApproxEqRel(opsReceived, FixedPointMath.applyBps(pending, ProtocolConstants.OPS_SHARE_BPS), 0.02e18);
        assertApproxEqRel(buybackReceived, pending - opsReceived, 0.02e18);
        assertEq(distributor.pending(ETH), 0);
    }

    /// @dev Classic rail post-graduation: sweep then distribute → same 20% ops / 80% buybackEth.
    function test_ClassicRail_Protocol8020_OpsAndBuybackEth() public {
        (PoolKey memory key, PoolId poolId,) = _graduateClassicPool();

        vm.deal(trader, 10 ether);
        vm.prank(trader);
        swapRouter.swap{value: 2 ether}(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(2 ether), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );

        feeHook.sweepQuote(poolId);

        uint256 pending = distributor.pending(ETH);
        assertGt(pending, 0, "classic graduated fees reach distributor after sweep");

        uint256 opsBefore = ops.balance;
        uint256 buybackBefore = distributor.buybackEth();
        distributor.distribute(ETH);

        uint256 opsReceived = ops.balance - opsBefore;
        uint256 buybackReceived = distributor.buybackEth() - buybackBefore;
        assertApproxEqRel(opsReceived, FixedPointMath.applyBps(pending, ProtocolConstants.OPS_SHARE_BPS), 0.02e18);
        assertApproxEqRel(buybackReceived, pending - opsReceived, 0.02e18);
    }

    // ─── Contract creators CAN claim (Hookit uses pull escrow, not push) ───

    function test_ContractCreator_WithReceive_ClaimsFromEscrow() public {
        CreatorFeeWallet wallet = new CreatorFeeWallet();
        vm.deal(address(wallet), 10 ether);

        BitmaskConfig.Modules memory m = defaultModules();
        m.hookTaxBps = 50;
        uint256 bitmask = BitmaskConfig.pack(m);

        vm.prank(address(wallet));
        (uint256 launchId,,) = wallet.launchEth{value: ProtocolConstants.LAUNCH_FEE_WEI}(factory, bitmask, 1_000_000_000e18);
        PoolKey memory key = factory.poolKeyOf(launchId);

        vm.deal(trader, 5 ether);
        vm.startPrank(trader);
        swapRouter.swap{value: 2 ether}(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(2 ether), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
        vm.stopPrank();

        uint256 escrowBal = escrow.balanceOf(address(wallet), ETH);
        assertGt(escrowBal, 0, "contract creator accrues escrow like EOA");

        uint256 before = address(wallet).balance;
        wallet.claim(escrow, ETH);
        assertEq(address(wallet).balance - before, escrowBal);
        assertEq(escrow.balanceOf(address(wallet), ETH), 0);
    }

    function test_ContractCreator_NoReceive_RevertsOnNativeClaim() public {
        CreatorFeeWalletNoReceive wallet = new CreatorFeeWalletNoReceive();
        escrow.credit{value: 1 ether}(address(wallet), ETH, 1 ether);

        vm.expectRevert();
        wallet.claim(escrow, ETH);
    }

    function test_ClaimAll_MultipleCurrencies() public {
        escrow.credit{value: 1 ether}(creator, ETH, 1 ether);
        LaunchTokenMock usdc = LaunchTokenMock(_deployErc20("USDC", 6));
        usdc.mint(address(this), 100e6);
        IERC20Minimal(address(usdc)).approve(address(escrow), 50e6);
        escrow.credit(creator, Currency.wrap(address(usdc)), 50e6);

        Currency[] memory currencies = new Currency[](2);
        currencies[0] = ETH;
        currencies[1] = Currency.wrap(address(usdc));

        uint256 creatorBalBefore = creator.balance;
        vm.prank(creator);
        escrow.claimAll(currencies);
        assertEq(escrow.balanceOf(creator, ETH), 0);
        assertEq(escrow.balanceOf(creator, Currency.wrap(address(usdc))), 0);
        assertEq(creator.balance - creatorBalBefore, 1 ether);
        assertEq(usdc.balanceOf(creator), 50e6);
    }

    // ─── Classic rail: sweep required before claim (Pons-style accrual) ─────

    function test_ClassicRail_FeesNotInEscrowUntilSweep() public {
        (PoolKey memory key, PoolId poolId,) = _graduateClassicPool();

        uint256 escrowBeforeSwap = escrow.balanceOf(creator, ETH);

        vm.deal(trader, 10 ether);
        vm.prank(trader);
        swapRouter.swap{value: 1 ether}(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(1 ether), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );

        uint256 pending = feeHook.pendingFees(poolId, ETH) + feeHook.pendingCreatorTax(poolId, ETH);
        // Protocol share notifies distributor immediately; creator share stays pending until sweep.
        assertGt(feeHook.pendingCreatorTax(poolId, ETH), 0, "creator fees accrue on GraduatedFeeHook first");
        assertEq(feeHook.pendingFees(poolId, ETH), 0, "protocol share pushed to distributor on swap");
        assertGt(pending, 0, "creator share still pending pre-sweep");

        // UGH-class trap if you only watch FeeEscrow: balance stays flat until sweep.
        assertEq(escrow.balanceOf(creator, ETH), escrowBeforeSwap, "escrow unchanged until sweepQuote");

        feeHook.sweepQuote(poolId);
        assertGt(escrow.balanceOf(creator, ETH), escrowBeforeSwap, "sweep moves creator share into FeeEscrow");
    }

    function test_ClassicRail_SwapSweepClaim_EndToEnd() public {
        (PoolKey memory key, PoolId poolId,) = _graduateClassicPool();

        vm.deal(trader, 10 ether);
        vm.prank(trader);
        swapRouter.swap{value: 2 ether}(
            key,
            SwapParams({
                zeroForOne: true, amountSpecified: -int256(2 ether), sqrtPriceLimitX96: TickMath.MIN_SQRT_PRICE + 1
            }),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );

        vm.prank(keeper);
        feeHook.sweepQuote(poolId);

        uint256 claimable = escrow.balanceOf(creator, ETH);
        assertGt(claimable, 0);

        uint256 before = creator.balance;
        vm.prank(creator);
        escrow.claim(ETH);
        assertEq(creator.balance - before, claimable);
        assertEq(escrow.balanceOf(creator, ETH), 0);
    }

    function test_BondingRail_PreGraduationFeesClaimableWithoutSweep() public {
        vm.prank(creator);
        (uint256 launchId,) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Classic",
                symbol: "CLS",
                metadataURI: "",
                totalSupply: 0,
                quote: ETH,
                creatorTaxBps: 0,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
        launchId;

        vm.prank(trader);
        bonding.buy{value: 0.5 ether}(launchId, 0, 1);

        uint256 claimable = escrow.balanceOf(creator, ETH);
        assertGt(claimable, 0, "bonding fees go direct to FeeEscrow");

        uint256 before = creator.balance;
        vm.prank(creator);
        escrow.claim(ETH);
        assertEq(creator.balance - before, claimable);
    }

    function test_SeventyThirtySplit_OnMasterSwap() public {
        BitmaskConfig.Modules memory m = defaultModules();
        (, address token,, PoolKey memory key) = launchToken(m, 0, 1_000_000_000e18);
        token;

        buyExactIn(key, 10 ether);

        uint256 creatorBal = escrow.balanceOf(address(this), ETH);
        uint256 protoBal = distributor.pending(ETH);
        assertGt(creatorBal, 0);
        assertGt(protoBal, 0);

        uint256 expectedCreator = FixedPointMath.applyBps(10 ether, ProtocolConstants.BASE_FEE_BPS);
        expectedCreator = FixedPointMath.applyBps(expectedCreator, ProtocolConstants.CREATOR_SHARE_BPS);
        assertApproxEqRel(creatorBal, expectedCreator, 0.02e18);
        assertApproxEqRel(creatorBal + protoBal, FixedPointMath.applyBps(10 ether, ProtocolConstants.BASE_FEE_BPS), 0.02e18);
    }

    // ─── Helpers ────────────────────────────────────────────────────────────

    function _graduateClassicPool()
        internal
        returns (PoolKey memory key, PoolId poolId, address token)
    {
        vm.prank(creator);
        (uint256 launchId, address t) = bonding.launch{value: ProtocolConstants.LAUNCH_FEE_WEI}(
            BondingLaunchFactory.LaunchParams({
                name: "Classic",
                symbol: "CLS",
                metadataURI: "",
                totalSupply: 0,
                quote: ETH,
                creatorTaxBps: 0,
                devBuyQuoteIn: 0,
                minDevBuyTokensOut: 0
            })
        );
        token = t;

        vm.prank(trader);
        bonding.buy{value: 4.25 ether}(launchId, 0, 1);

        key = bonding.poolKeyOf(launchId);
        poolId = key.toId();
    }

    function _deployErc20(string memory name, uint8 decimals) internal returns (address) {
        LaunchTokenMock t = new LaunchTokenMock(name, decimals);
        return address(t);
    }
}

/// @dev Minimal mintable ERC-20 for claimAll test.
contract LaunchTokenMock is IERC20Minimal {
    string public n;
    uint8 public d;
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public override allowance;
    uint256 public totalSupply;

    constructor(string memory name_, uint8 decimals_) {
        n = name_;
        d = decimals_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}
