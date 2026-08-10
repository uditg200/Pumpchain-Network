import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useQuery } from '@tanstack/react-query';

/**
 * Compact SOL balance display for the header.
 */
export function WalletBalance() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();

  const { data: balance, isLoading } = useQuery({
    queryKey: ['solana-balance', publicKey?.toBase58()],
    queryFn: async () => {
      if (!publicKey) return null;
      const lamports = await connection.getBalance(publicKey);
      return lamports / LAMPORTS_PER_SOL;
    },
    enabled: !!publicKey,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (!publicKey) return null;

  return (
    <span className="text-xs font-mono text-gray-400">
      {isLoading ? '...' : `${balance?.toFixed(4) ?? '0'} SOL`}
    </span>
  );
}
