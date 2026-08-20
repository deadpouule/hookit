// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {Owned} from "./base/Owned.sol";
import {UnlockTaker} from "./base/UnlockTaker.sol";
import {IProtocolRevenueDistributor} from "./interfaces/IProtocolRevenueDistributor.sol";
import {IFloorVault} from "./interfaces/IFloorVault.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

/// @title ProtocolRevenueDistributor
/// @notice Splits protocol fees 20% ops / 80% native-token floor flywheel.
contract ProtocolRevenueDistributor is Owned, UnlockTaker, IProtocolRevenueDistributor {
    using CurrencyLibrary for Currency;

    enum FlywheelMode {
        DepositFloor,
        TwapBuybackBurn
    }

    address public override opsTreasury;
    address public override nativeToken;
    IFloorVault public nativeFloorVault;
    FlywheelMode public flywheelMode;

    mapping(address => bool) public operators;
    mapping(Currency => uint256) public pending;

    event OperatorSet(address indexed operator, bool allowed);
    event OpsTreasurySet(address indexed treasury);
    event NativeTokenSet(address indexed token, address indexed vault);
    event FlywheelModeSet(FlywheelMode mode);
    event Notified(Currency indexed currency, uint256 amount);
    event Distributed(Currency indexed currency, uint256 opsAmount, uint256 flywheelAmount);
    event BuybackBurned(uint256 tokenAmount);

    error NotOperator();
    error ZeroAmount();
    error NativeMismatch();
    error ZeroAddress();
    error TransferFailed();
    error NoNativeToken();

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

    /// @dev Accrues protocol share already sitting on this contract.
    function notifyInternal(Currency currency, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        pending[currency] += amount;
        emit Notified(currency, amount);
    }

    /// @inheritdoc IProtocolRevenueDistributor
    function distribute(Currency currency) public {
        uint256 amount = pending[currency];
        if (amount == 0) revert ZeroAmount();
        pending[currency] = 0;

        uint256 claims = address(claimsManager) == address(0)
            ? 0
            : claimsManager.balanceOf(address(this), currency.toId());
        if (claims >= amount) {
            _redeemClaims(currency, address(this), amount);
        }

        uint256 opsAmount = FixedPointMath.applyBps(amount, ProtocolConstants.OPS_SHARE_BPS);
        uint256 flywheelAmount = amount - opsAmount;

        currency.transfer(opsTreasury, opsAmount);
        _routeFlywheel(currency, flywheelAmount);
        emit Distributed(currency, opsAmount, flywheelAmount);
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
            // Permissionless executor pulls quote and is expected to TWAP-buy + burn off-chain / via a keeper.
            // Quote is parked on this contract under `pendingFlywheel` semantics: send to ops-controlled
            // buyback executor by transferring to `opsTreasury` tagged as flywheel until a swap adapter is set.
            currency.transfer(opsTreasury, amount);
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        bool ok = IERC20Minimal(token).transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }
}
