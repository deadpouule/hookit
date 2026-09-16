"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useEffect, useRef } from "react";
import { useAccount } from "wagmi";

/**
 * After email / Google / Twitter login, push the Privy embedded wallet into wagmi
 * so swap and launch keep using useAccount. If RainbowKit disconnects that wallet,
 * log out of Privy so it does not silently reconnect.
 */
export function PrivySessionBridge() {
  const { authenticated, ready, logout } = usePrivy();
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();
  const { isConnected } = useAccount();
  const sawWagmiConnect = useRef(false);
  const loggingOut = useRef(false);

  useEffect(() => {
    if (isConnected) sawWagmiConnect.current = true;
  }, [isConnected]);

  useEffect(() => {
    if (!ready || !authenticated || isConnected) return;
    const next =
      wallets.find((wallet) => wallet.walletClientType === "privy" || wallet.walletClientType === "privy-v2") ??
      wallets[0];
    if (!next) return;
    void setActiveWallet(next);
  }, [authenticated, isConnected, ready, setActiveWallet, wallets]);

  useEffect(() => {
    if (!ready || !authenticated || loggingOut.current) return;
    if (!sawWagmiConnect.current || isConnected) return;
    loggingOut.current = true;
    void logout().finally(() => {
      loggingOut.current = false;
      sawWagmiConnect.current = false;
    });
  }, [authenticated, isConnected, logout, ready]);

  return null;
}
