// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {Owned} from "./base/Owned.sol";
import {UnlockTaker} from "./base/UnlockTaker.sol";
import {ProtocolConstants} from "./libraries/ProtocolConstants.sol";

interface IERC20Balance {
    function balanceOf(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/// @title HolderAirdropVault
/// @notice Accrues quote-only launch fees and pushes them to token holders on a fixed epoch.
/// @dev Caller supplies the holder set (from an indexer). Distribution reverts unless the
///      provided balances cover all circulating supply (totalSupply minus excluded addresses).
contract HolderAirdropVault is Owned, UnlockTaker {
    using CurrencyLibrary for Currency;

    uint256 public constant EPOCH = ProtocolConstants.HOLDER_AIRDROP_EPOCH;

    mapping(address => bool) public operators;
    mapping(address => uint256) public reserve;
    mapping(address => Currency) public quoteOf;
    mapping(address => uint64) public lastAirdropAt;
    /// @dev token => account => excluded from airdrop (pool, hook, vaults, …).
    mapping(address => mapping(address => bool)) public excluded;
    mapping(address => address[]) private _excludeList;

    event OperatorSet(address indexed operator, bool allowed);
    event ExcludedSet(address indexed token, address indexed account, bool excluded);
    event Deposited(address indexed token, Currency indexed quote, uint256 amount, uint256 newReserve);
    event Airdropped(
        address indexed token, Currency indexed quote, uint256 pot, uint256 distributed, uint256 holders, address caller
    );

    error NotOperator();
    error ZeroAmount();
    error QuoteMismatch();
    error QuoteNotSet();
    error EpochNotElapsed();
    error EmptyHolders();
    error IncompleteHolderSet();
    error DuplicateHolder();
    error ExcludedHolder();
    error NativeMismatch();
    error TransferFailed();

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

    function setExcluded(address token, address account, bool isExcluded) external onlyOperator {
        if (excluded[token][account] == isExcluded) return;
        excluded[token][account] = isExcluded;
        if (isExcluded) {
            _excludeList[token].push(account);
        } else {
            address[] storage list = _excludeList[token];
            for (uint256 i; i < list.length; ++i) {
                if (list[i] == account) {
                    list[i] = list[list.length - 1];
                    list.pop();
                    break;
                }
            }
        }
        emit ExcludedSet(token, account, isExcluded);
    }

    function excludeList(address token) external view returns (address[] memory) {
        return _excludeList[token];
    }

    /// @dev Credits reserves using quote already sitting on this contract (hook `transfer` path).
    function depositInternal(address token, Currency quote, uint256 amount) external onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _bindQuote(token, quote);
        reserve[token] += amount;
        emit Deposited(token, quote, amount, reserve[token]);
    }

    function deposit(address token, Currency quote, uint256 amount) external payable onlyOperator {
        if (amount == 0) revert ZeroAmount();
        _bindQuote(token, quote);

        if (quote.isAddressZero()) {
            if (msg.value != amount) revert NativeMismatch();
        } else {
            if (msg.value != 0) revert NativeMismatch();
            _safeTransferFrom(Currency.unwrap(quote), msg.sender, address(this), amount);
        }

        reserve[token] += amount;
        emit Deposited(token, quote, amount, reserve[token]);
    }

    /// @notice Push accrued quote to holders pro-rata by token balances. Permissionless after epoch.
    /// @param holders Complete set of addresses that hold circulating supply (excludes already configured).
    function airdrop(address token, address[] calldata holders) external returns (uint256 distributed) {
        uint256 pot = reserve[token];
        if (pot == 0) revert ZeroAmount();

        uint64 last = lastAirdropAt[token];
        if (last != 0 && block.timestamp < uint256(last) + EPOCH) revert EpochNotElapsed();
        if (holders.length == 0) revert EmptyHolders();

        Currency quote = quoteOf[token];

        IERC20Balance erc20 = IERC20Balance(token);
        uint256 circulating = erc20.totalSupply();
        address[] storage excl = _excludeList[token];
        for (uint256 i; i < excl.length; ++i) {
            circulating -= erc20.balanceOf(excl[i]);
        }

        uint256 totalBal;
        uint256[] memory bals = new uint256[](holders.length);
        for (uint256 i; i < holders.length; ++i) {
            address account = holders[i];
            if (excluded[token][account]) revert ExcludedHolder();
            for (uint256 j; j < i; ++j) {
                if (holders[j] == account) revert DuplicateHolder();
            }
            uint256 bal = erc20.balanceOf(account);
            bals[i] = bal;
            totalBal += bal;
        }

        if (totalBal != circulating) revert IncompleteHolderSet();
        if (totalBal == 0) revert EmptyHolders();

        _materializeQuote(quote, pot);

        uint256 paid;
        for (uint256 i; i < holders.length; ++i) {
            uint256 share = pot * bals[i] / totalBal;
            if (share == 0) continue;
            paid += share;
            quote.transfer(holders[i], share);
        }

        // Dust from rounding stays for the next epoch.
        reserve[token] = pot - paid;
        lastAirdropAt[token] = uint64(block.timestamp);
        distributed = paid;

        emit Airdropped(token, quote, pot, distributed, holders.length, msg.sender);
    }

    function secondsUntilAirdrop(address token) external view returns (uint256) {
        uint64 last = lastAirdropAt[token];
        if (last == 0) return 0;
        uint256 next = uint256(last) + EPOCH;
        if (block.timestamp >= next) return 0;
        return next - block.timestamp;
    }

    function _bindQuote(address token, Currency quote) private {
        Currency stored = quoteOf[token];
        if (Currency.unwrap(stored) == address(0) && reserve[token] == 0 && lastAirdropAt[token] == 0) {
            // First bind — allow native (address(0)) or ERC-20.
            quoteOf[token] = quote;
            return;
        }
        if (Currency.unwrap(stored) != Currency.unwrap(quote)) revert QuoteMismatch();
    }

    function _materializeQuote(Currency quote, uint256 amount) private {
        if (amount == 0 || address(claimsManager) == address(0)) return;
        uint256 claims = claimsManager.balanceOf(address(this), quote.toId());
        if (claims == 0) return;
        uint256 pull = claims < amount ? claims : amount;
        _redeemClaims(quote, address(this), pull);
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
