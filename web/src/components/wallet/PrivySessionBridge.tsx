"use client";

import { type ConnectedWallet, usePrivy, useWallets } from "@privy-io/react-auth";
import { useSetActiveWallet } from "@privy-io/wagmi";
import { useEffect, useRef } from "react";
import { type Config, useAccount, useConfig } from "wagmi";
import { injected } from "wagmi/connectors";

function toWalletConnectorId(wallet: ConnectedWallet): string {
  return wallet.walletClientType === "privy"
    ? `${wallet.meta.id}.${wallet.address}`
    : wallet.meta.id;
}

async function ensurePrivyConnector(config: Config, wallet: ConnectedWallet) {
  const id = toWalletConnectorId(wallet);
  const existing = config.connectors.find((connector) => connector.id === id);
  if (existing) return existing;

  const provider = await wallet.getEthereumProvider();
  const connector = injected({
    target: {
      // Privy's EIP1193 provider is compatible at runtime; wagmi's injected types are stricter.
      provider: provider as never,
      id,
      name: wallet.meta.name,
      icon: typeof wallet.meta.icon === "string" ? wallet.meta.icon : undefined,
    },
  });

  return config._internal.connectors.setup(connector);
}

/**
 * After email / Google / Twitter login, push the Privy embedded wallet into wagmi
 * so swap and launch keep using useAccount. If RainbowKit disconnects that wallet,
 * log out of Privy so it does not silently reconnect.
 */
export function PrivySessionBridge() {
  const config = useConfig();
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

    void (async () => {
      await ensurePrivyConnector(config, next);
      await setActiveWallet(next);
    })();
  }, [authenticated, config, isConnected, ready, setActiveWallet, wallets]);

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
