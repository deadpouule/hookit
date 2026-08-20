// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {Owned} from "./base/Owned.sol";
import {UnlockTaker} from "./base/UnlockTaker.sol";
import {IFloorVault} from "./interfaces/IFloorVault.sol";
import {ILaunchToken} from "./interfaces/ILaunchToken.sol";
import {FixedPointMath} from "./libraries/FixedPointMath.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

interface IERC20Supply {
    function totalSupply() external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @title FloorVault
/// @notice Isolated quote-collateral vault backing each launched token's redeemable floor.
/// @dev Ratchet: withdrawals use round-down `mulDiv` so P_floor never decreases.
contract FloorVault is Owned, UnlockTaker, IFloorVault {
    using CurrencyLibrary for Currency;

    mapping(address => bool) public operators;
    mapping(address => uint256) public override reserve;
    mapping(address => Currency) public override quoteOf;

    event OperatorSet(address indexed operator, bool allowed);
    event Deposited(address indexed token, Currency indexed quote, uint256 amount, uint256 newReserve);
    event Drawn(address indexed token, uint256 tokenAmount, uint256 quoteOut, address indexed recipient);
    event Redeemed(address indexed token, address indexed account, uint256 tokenAmount, uint256 quoteOut);

    error NotOperator();
    error ZeroAmount();
    error NativeMismatch();
    error QuoteMismatch();
    error InsufficientReserve();
    error FloorWouldDecrease();
    error TransferFailed();
    error QuoteNotSet();

    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner) revert NotOperator();
        _;
    }

    constructor(address owner_, IPoolManager manager_) Owned(owner_) UnlockTaker(manager_) {}

    receive() external payable {}

    function setOperator(address operator, bool allowed) external onlyOwner {
        operators[operator] = allowed;
        emit OperatorSet(operator, allowed);
    }

    function setQuote(address token, Currency quote) external onlyOperator {
        Currency existing = quoteOf[token];
        if (Currency.unwrap(existing) != address(0) && Currency.unwrap(existing) != Currency.unwrap(quote)) {
            revert QuoteMismatch();
        }
        quoteOf[token] = quote;
    }

    /// @inheritdoc IFloorVault
    function deposit(address token, Currency quote, uint256 amount) external payable onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _bindQuote(token, quote);

        uint256 priceBefore = _priceX18(token);

        if (quote.isAddressZero()) {
            if (msg.value != amount) revert NativeMismatch();
        } else {
            if (msg.value != 0) revert NativeMismatch();
            _safeTransferFrom(Currency.unwrap(quote), msg.sender, address(this), amount);
        }

        reserve[token] += amount;
        _assertRatchet(token, priceBefore);
        emit Deposited(token, quote, amount, reserve[token]);
    }

    /// @dev Credits reserves using quote already sitting on this contract (hook `take` path).
    function depositInternal(address token, Currency quote, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _bindQuote(token, quote);
        uint256 priceBefore = _priceX18(token);
        reserve[token] += amount;
        _assertRatchet(token, priceBefore);
        emit Deposited(token, quote, amount, reserve[token]);
    }

    /// @inheritdoc IFloorVault
    function drawForFloor(address token, Currency quote, uint256 tokenAmount, address recipient)
        external
        onlyOperator
        returns (uint256 quoteOut)
    {
        if (tokenAmount == 0) revert ZeroAmount();
        if (Currency.unwrap(quoteOf[token]) != Currency.unwrap(quote)) revert QuoteMismatch();

        uint256 priceBefore = _priceX18(token);
        uint256 supply = IERC20Supply(token).totalSupply();
        quoteOut = FixedPointMath.quoteAtFloor(tokenAmount, reserve[token], supply);
        if (quoteOut > reserve[token]) revert InsufficientReserve();

        _safeTransferFrom(token, msg.sender, address(this), tokenAmount);
        ILaunchToken(token).burn(tokenAmount);

        reserve[token] -= quoteOut;
        _assertRatchet(token, priceBefore);
        quote.transfer(recipient, quoteOut);
        emit Drawn(token, tokenAmount, quoteOut, recipient);
    }

    /// @inheritdoc IFloorVault
    function redeemFloor(address token, uint256 tokenAmount) external returns (uint256 quoteOut) {
        if (tokenAmount == 0) revert ZeroAmount();
        Currency quote = quoteOf[token];
        if (Currency.unwrap(quote) == address(0) && reserve[token] == 0) revert QuoteNotSet();

        uint256 priceBefore = _priceX18(token);
        uint256 supply = IERC20Supply(token).totalSupply();
        quoteOut = FixedPointMath.quoteAtFloor(tokenAmount, reserve[token], supply);
        if (quoteOut == 0) revert ZeroAmount();
        if (quoteOut > reserve[token]) revert InsufficientReserve();

        _safeTransferFrom(token, msg.sender, address(this), tokenAmount);
        ILaunchToken(token).burn(tokenAmount);

        reserve[token] -= quoteOut;
        _assertRatchet(token, priceBefore);
        _materializeQuote(quote, quoteOut);
        quote.transfer(msg.sender, quoteOut);
        emit Redeemed(token, msg.sender, tokenAmount, quoteOut);
    }

    function floorPriceX18(address token) external view returns (uint256) {
        return _priceX18(token);
    }

    function _bindQuote(address token, Currency quote) private {
        Currency stored = quoteOf[token];
        if (Currency.unwrap(stored) == address(0)) {
            quoteOf[token] = quote;
        } else if (Currency.unwrap(stored) != Currency.unwrap(quote)) {
            revert QuoteMismatch();
        }
    }

    function _priceX18(address token) private view returns (uint256) {
        uint256 supply = IERC20Supply(token).totalSupply();
        return FixedPointMath.floorPriceX18(reserve[token], supply);
    }

    function _assertRatchet(address token, uint256 priceBefore) private view {
        if (_priceX18(token) < priceBefore) revert FloorWouldDecrease();
    }

    function _materializeQuote(Currency quote, uint256 amount) private {
        if (amount == 0 || address(claimsManager) == address(0)) return;
        uint256 claims = claimsManager.balanceOf(address(this), quote.toId());
        if (claims == 0) return;
        uint256 pull = claims < amount ? claims : amount;
        _redeemClaims(quote, address(this), pull);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        bool ok = IERC20Supply(token).transferFrom(from, to, amount);
        if (!ok) revert TransferFailed();
    }
}
