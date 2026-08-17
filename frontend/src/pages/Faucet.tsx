import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WalletConnectButton } from '../components/wallet/index.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

interface FaucetData {
  eligible: boolean;
  nextClaimAt: string | null;
  claimAmount: string;
  totalClaims: number;
  balance: string;
  history: Array<{
    amount: string;
    asset: string;
    claimTimestamp: string;
    cooldownUntil: string;
  }>;
}

interface ClaimResult {
  success: boolean;
  amount: string;
  asset: string;
  walletAddress: string;
  nextClaimAt: string;
  transactionHash: string;
}

function formatPump(lamports: string): string {
  const value = BigInt(lamports);
  const whole = value / 1_000_000_000n;
  const frac = value % 1_000_000_000n;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(9, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

export function FaucetPage() {
  const { publicKey, connected } = useWallet();
  const queryClient = useQueryClient();
  const walletAddress = publicKey?.toBase58() ?? '';

  const [countdown, setCountdown] = useState<string | null>(null);

  // Single API call fetches everything: status, balance, and history
  const { data, isLoading } = useQuery<FaucetData>({
    queryKey: ['faucet-data', walletAddress],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/faucet/status/${walletAddress}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Failed');
      return json.data;
    },
    enabled: !!walletAddress,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Claim mutation
  const claimMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/faucet/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Claim failed');
      return json.data as ClaimResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['faucet-data', walletAddress] });
    },
  });

  // Cooldown timer
  useEffect(() => {
    if (!data?.nextClaimAt) {
      setCountdown(null);
      return;
    }

    const target = new Date(data.nextClaimAt).getTime();

    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      if (diff <= 0) {
        setCountdown(null);
        queryClient.invalidateQueries({ queryKey: ['faucet-data', walletAddress] });
        return;
      }
      const hours = Math.floor(diff / 3_600_000);
      const minutes = Math.floor((diff % 3_600_000) / 60_000);
      const seconds = Math.floor((diff % 60_000) / 1000);
      setCountdown(
        `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`,
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [data?.nextClaimAt, walletAddress, queryClient]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">ANSEM NETWORK FAUCET</h2>
        <p className="text-gray-400">
          Get free ANSEM tokens for testing on the Ansem Network
        </p>
        <div className="inline-block px-3 py-1 rounded-full bg-yellow-900/30 border border-yellow-700/50">
          <span className="text-xs text-yellow-400">
            Testnet only — Not needed on mainnet. Bridge real PUMP from Solana instead.
          </span>
        </div>
      </div>

      {/* Connect Wallet */}
      {!connected && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center space-y-4">
          <p className="text-gray-400">Connect your Solana wallet to claim ANSEM</p>
          <WalletConnectButton />
        </div>
      )}

      {/* Faucet Card */}
      {connected && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
          {/* Wallet Address */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Wallet Address</label>
            <p className="font-mono text-sm text-gray-300 bg-gray-800 rounded-lg px-3 py-2 break-all">
              {walletAddress}
            </p>
          </div>

          {/* Current Balance */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 uppercase tracking-wide">
              Current ANSEM Balance
            </label>
            <p className="text-2xl font-mono font-bold text-pump-400">
              {data ? formatPump(data.balance) : '0'} ANSEM
            </p>
          </div>

          {/* Claim Amount */}
          <div className="space-y-1">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Claim Amount</label>
            <p className="text-lg font-mono text-white">
              {data ? formatPump(data.claimAmount) : '...'} ANSEM
            </p>
          </div>

          {/* Claim Button */}
          <button
            onClick={() => claimMutation.mutate()}
            disabled={!data?.eligible || claimMutation.isPending || isLoading}
            className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-pump-600 hover:bg-pump-700 active:bg-pump-800"
          >
            {claimMutation.isPending
              ? 'Claiming...'
              : data?.eligible
                ? 'CLAIM ANSEM'
                : 'Cooldown Active'}
          </button>

          {/* Success Message */}
          {claimMutation.isSuccess && (
            <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4 space-y-1">
              <p className="text-sm text-green-400 font-medium">Claim successful!</p>
              <p className="text-xs text-green-500 font-mono break-all">
                TX: {claimMutation.data.transactionHash}
              </p>
              <p className="text-xs text-green-600">
                +{formatPump(claimMutation.data.amount)} {claimMutation.data.asset}
              </p>
            </div>
          )}

          {/* Error Message */}
          {claimMutation.isError && (
            <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
              <p className="text-sm text-red-400">
                {claimMutation.error instanceof Error
                  ? claimMutation.error.message
                  : 'Claim failed'}
              </p>
            </div>
          )}

          {/* Cooldown Timer */}
          {countdown && (
            <div className="bg-gray-800 rounded-lg p-4 text-center space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                Next Claim Available In
              </p>
              <p className="text-3xl font-mono font-bold text-white">{countdown}</p>
            </div>
          )}
        </div>
      )}

      {/* Claim History */}
      {connected && data?.history && data.history.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
            Recent Claims
          </h3>
          <div className="space-y-2">
            {data.history.map((claim, i) => (
              <div
                key={i}
                className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-pump-400" />
                  <span className="text-sm text-white font-mono">
                    +{formatPump(claim.amount)} {claim.asset}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(claim.claimTimestamp).toLocaleDateString()}{' '}
                  {new Date(claim.claimTimestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 space-y-2">
        <p className="text-xs text-gray-500 leading-relaxed">
          This faucet is for <strong className="text-gray-400">testnet/development use only</strong>.
          On mainnet, users should bridge real ANSEM tokens from Solana using the{' '}
          <a href="/bridge" className="text-pump-400 hover:underline">Bridge</a>.
          Faucet claims are rate-limited and tokens distributed here are for testing the network functionality.
        </p>
      </div>
    </div>
  );
}


