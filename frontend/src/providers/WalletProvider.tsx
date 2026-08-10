import { useMemo, type ReactNode } from 'react';
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare';
import { clusterApiUrl } from '@solana/web3.js';

interface Props {
  children: ReactNode;
}

/**
 * SolanaWalletProvider wraps the application with Solana wallet connectivity.
 *
 * Uses Devnet RPC for balance lookups.
 * Phantom can be on any network — we only need the wallet address.
 * The PUMP balance lives on Pumpchain (our backend), not on Solana.
 */
export function WalletProvider({ children }: Props) {
  // Use Helius mainnet RPC for wallet balance lookups
  const endpoint = useMemo(() => 'https://mainnet.helius-rpc.com/?api-key=d50b7d5a-2a55-4abf-aa03-0f679bd4d7a7', []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
