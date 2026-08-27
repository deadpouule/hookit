// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {Owned} from "./base/Owned.sol";
import {UnlockTaker} from "./base/UnlockTaker.sol";
import {IProtocolRevenueDistributor} from "./interfaces/IProtocolRevenueDistributor.sol";
import {IHkitBuybackSource} from "./interfaces/IHkitBuybackSource.sol";
import {IFloorVault} from "./interfaces/IFloorVault.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {QuotronBridge} from "./libraries/QuotronBridge.sol";
import {FeeEthRail} from "./FeeEthRail.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @title ProtocolRevenueDistributor
/// @notice Splits protocol fees 20% ops / 80% flywheel.
/// @dev BuybackBurn flywheel: ETH accrues in `buybackEth` (pulled by `HkitBuyback`); Quotrons
///      wStock fees are swapped to USDG via `FeeEthRail` and sent to `buybackExecutor`.
contract ProtocolRevenueDistributor is Owned, UnlockTaker, IProtocolRevenueDistributor, IHkitBuybackSource {
    using CurrencyLibrary for Currency;

    enum FlywheelMode {
        DepositFloor,
        BuybackBurn
    }

    address public override opsTreasury;
    address public override nativeToken;
    IFloorVault public nativeFloorVault;
    FlywheelMode public flywheelMode;
    FeeEthRail public feeRail;
    address public buybackExecutor;

    /// @dev ETH reserved for permissionless HKIT buyback+burn.
    uint256 public override buybackEth;
    /// @dev ERC-6909 / unsettled buyback credits (HKIT creator fees), ETH only.
    mapping(Currency => uint256) public pendingBuyback;

    mapping(address => bool) public operators;
    mapping(Currency => uint256) public pending;

    event OperatorSet(address indexed operator, bool allowed);
    event OpsTreasurySet(address indexed treasury);
    event NativeTokenSet(address indexed token, address indexed vault);
    event FlywheelModeSet(FlywheelMode mode);
    event FeeRailSet(address indexed rail);
    event BuybackExecutorSet(address indexed executor);
    event Notified(Currency indexed currency, uint256 amount);
    event BuybackNotified(Currency indexed currency, uint256 amount);
    event Distributed(Currency indexed currency, uint256 opsAmount, uint256 flywheelAmount);
    event BuybackFlushed(uint256 amount);
    event BuybackPulled(uint256 amount, address indexed executor);
    event RailedToUsdg(Currency indexed from, uint256 amountIn, uint256 usdgOut);
    event BuybackUsdgSent(uint256 amount, address indexed wallet);

    error NotOperator();
    error NotBuybackExecutor();
    error ZeroAmount();
    error NativeMismatch();
    error ZeroAddress();
    error TransferFailed();
    error NoNativeToken();
    error NoFeeRail();
    error ApproveFailed();
    error InsufficientBuyback();
    error NoBuybackWallet();
    error UnsupportedFeeAsset();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner) revert NotOperator();
        _;
    }

    constructor(address owner_, address opsTreasury_, IPoolManager manager_)
        Owned(owner_)
        UnlockTaker(manager_)
    {
        if (opsTreasury_ == address(0)) revert ZeroAddress();
        opsTreasury = opsTreasury_;
        flywheelMode = FlywheelMode.BuybackBurn;
    }

    receive() external payable {}

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setOpsTreasury(address treasury) external onlyOwner {
        if (treasury == address(0)) revert ZeroAddress();
        opsTreasury = treasury;
        emit OpsTreasurySet(treasury);
    }

    function setNativeToken(address token, IFloorVault vault) external onlyOwner {
        nativeToken = token;
        nativeFloorVault = vault;
        emit NativeTokenSet(token, address(vault));
    }

    function setFlywheelMode(FlywheelMode mode) external onlyOwner {
        flywheelMode = mode;
        emit FlywheelModeSet(mode);
    }

    function setFeeRail(FeeEthRail rail) external onlyOwner {
        feeRail = rail;
        emit FeeRailSet(address(rail));
    }

    function setBuybackExecutor(address executor) external onlyOwner {
        buybackExecutor = executor;
        emit BuybackExecutorSet(executor);
    }

    /// @inheritdoc IProtocolRevenueDistributor
    function notify(Currency currency, uint256 amount) external payable onlyOperator {
        if (amount == 0) revert ZeroAmount();
        if (currency.isAddressZero()) {
            if (msg.value != amount) revert NativeMismatch();
        } else {
            if (msg.value != 0) revert NativeMismatch();
            _safeTransferFrom(Currency.unwrap(currency), msg.sender, address(this), amount);
        }
        pending[currency] += amount;
        emit Notified(currency, amount);
    }

    /// @dev Accrues protocol share already sitting on this contract (ERC-6909 claims path).
    function notifyInternal(Currency currency, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        pending[currency] += amount;
        emit Notified(currency, amount);
    }

/// @dev HKIT creator fees → 100% buyback pot (no ops cut). ETH accrues in `buybackEth`; ERC-20 → `buybackExecutor`.
    function notifyBuybackInternal(Currency currency, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        pendingBuyback[currency] += amount;
        emit BuybackNotified(currency, amount);
    }

    /// @inheritdoc IProtocolRevenueDistributor
    function distribute(Currency currency) public {
        uint256 amount = _materializePending(currency);
        _splitAndRoute(currency, amount);
    }

    /// @notice Route pending fees to ops (20%) + buyback (80%).
    /// @dev ETH → `buybackEth` pot. Quotrons wStock → USDG via rail, then USDG to `buybackExecutor`.
    ///      Native USDG pending is split the same way (no swap).
    function distributeToBuyback(Currency currency, uint256 minUsdgOut) public {
        uint256 amount = _materializePending(currency);
        if (currency.isAddressZero()) {
            _splitAndRoute(currency, amount);
            return;
        }

        address token = Currency.unwrap(currency);
        if (address(feeRail) == address(0)) revert NoFeeRail();

        if (QuotronBridge.isQuotronStock(token)) {
            _approveRail(token, amount);
            uint256 usdgOut = feeRail.stockToUsdg(token, amount, minUsdgOut, address(this), address(this));
            emit RailedToUsdg(currency, amount, usdgOut);
            _splitAndRoute(Currency.wrap(feeRail.usdg()), usdgOut);
            return;
        }

        if (token == feeRail.usdg()) {
            _splitAndRoute(currency, amount);
            return;
        }

        revert UnsupportedFeeAsset();
    }

    /// @dev Deprecated alias — wStock/USDG go to buyback as USDG (no ETH hop).
    function distributeAsEth(Currency currency, uint256 minOut) external {
        distributeToBuyback(currency, minOut);
    }

    /// @notice Consolidate a Quotrons wStock pending balance into USDG pending (no split yet).
    function railStockToUsdg(address stock, uint256 minUsdgOut) external returns (uint256 usdgOut) {
        if (address(feeRail) == address(0)) revert NoFeeRail();
        Currency currency = Currency.wrap(stock);
        uint256 amount = _materializePending(currency);
        _approveRail(stock, amount);
        usdgOut = feeRail.stockToUsdg(stock, amount, minUsdgOut, address(this), address(this));
        pending[Currency.wrap(feeRail.usdg())] += usdgOut;
        emit RailedToUsdg(currency, amount, usdgOut);
    }

    /// @inheritdoc IHkitBuybackSource
    function flushBuybackEth() public override returns (uint256 flushed) {
        return flushBuyback(Currency.wrap(address(0)));
    }

    /// @notice Flush HKIT creator-fee buyback credits for any currency.
    /// @dev ETH → `buybackEth` pot; USDG / other ERC-20 → `buybackExecutor` (manual ETH conversion off-chain).
    function flushBuyback(Currency currency) public returns (uint256 flushed) {
        flushed = pendingBuyback[currency];
        if (flushed == 0) return 0;
        pendingBuyback[currency] = 0;

        uint256 claims = address(claimsManager) == address(0)
            ? 0
            : claimsManager.balanceOf(address(this), currency.toId());
        if (claims >= flushed) {
            _redeemClaims(currency, address(this), flushed);
        }

        if (currency.isAddressZero()) {
            buybackEth += flushed;
            emit BuybackFlushed(flushed);
        } else {
            if (buybackExecutor == address(0)) revert NoBuybackWallet();
            currency.transfer(buybackExecutor, flushed);
            emit BuybackUsdgSent(flushed, buybackExecutor);
        }
    }

    /// @inheritdoc IHkitBuybackSource
    function pullBuybackEth(uint256 amount) external override returns (uint256 pulled) {
        if (msg.sender != buybackExecutor) revert NotBuybackExecutor();
        if (amount == 0) revert ZeroAmount();
        if (amount > buybackEth) revert InsufficientBuyback();
        buybackEth -= amount;
        pulled = amount;
        CurrencyLibrary.ADDRESS_ZERO.transfer(msg.sender, amount);
        emit BuybackPulled(amount, msg.sender);
    }

    /// @inheritdoc IHkitBuybackSource
    function returnBuybackEth() external payable override {
        if (msg.sender != buybackExecutor) revert NotBuybackExecutor();
        buybackEth += msg.value;
    }

    function _materializePending(Currency currency) private returns (uint256 amount) {
        amount = pending[currency];
        if (amount == 0) revert ZeroAmount();
        pending[currency] = 0;

        uint256 claims = address(claimsManager) == address(0)
            ? 0
            : claimsManager.balanceOf(address(this), currency.toId());
        if (claims >= amount) {
            _redeemClaims(currency, address(this), amount);
        }
    }

    function _splitAndRoute(Currency currency, uint256 amount) private {
        uint256 opsAmount = FixedPointMath.applyBps(amount, ProtocolConstants.OPS_SHARE_BPS);
        uint256 flywheelAmount = amount - opsAmount;

        currency.transfer(opsTreasury, opsAmount);
        _routeFlywheel(currency, flywheelAmount);
        emit Distributed(currency, opsAmount, flywheelAmount);
    }

    function _approveRail(address token, uint256 amount) private {
        address rail = address(feeRail);
        (bool ok1,) = token.call(abi.encodeWithSelector(IERC20Minimal.approve.selector, rail, 0));
        (bool ok2,) = token.call(abi.encodeWithSelector(IERC20Minimal.approve.selector, rail, amount));
        if (!ok1 || !ok2) revert ApproveFailed();
    }

    function _routeFlywheel(Currency currency, uint256 amount) private {
        if (amount == 0) return;
        if (flywheelMode == FlywheelMode.DepositFloor) {
            if (address(nativeFloorVault) == address(0) || nativeToken == address(0)) revert NoNativeToken();
            if (currency.isAddressZero()) {
                nativeFloorVault.deposit{value: amount}(nativeToken, currency, amount);
            } else {
                IERC20Minimal(Currency.unwrap(currency)).approve(address(nativeFloorVault), amount);
                nativeFloorVault.deposit(nativeToken, currency, amount);
            }
        } else {
            // BuybackBurn: ETH pot for HKIT buyback; USDG (and other ERC-20) → buyback wallet.
            if (currency.isAddressZero()) {
                buybackEth += amount;
            } else {
                if (buybackExecutor == address(0)) revert NoBuybackWallet();
                currency.transfer(buybackExecutor, amount);
                emit BuybackUsdgSent(amount, buybackExecutor);
            }
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        bool ok = IERC20Minimal(token).transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }
}
