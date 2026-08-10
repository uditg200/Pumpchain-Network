import { useState } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { WalletConnectButton } from '../components/wallet/index.js';
import { CopyButton } from '../components/ui/index.js';
import { fetchApi } from '../lib/api.js';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

interface BridgeStats {
  totalBridged: string;
  pendingTransfers: number;
  completedTransfers: number;
  totalOperations: number;
}

interface BridgeInfo {
  pumpMint: string;
  bridgeDepositAddress: string;
  solanaDecimals: number;
  pumpchainDecimals: number;
  buyLink: string;
}

interface BridgeOperation {
  id: string;
  direction: string;
  sourceChain: string;
  destinationChain: string;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  walletAddress: string;
  asset: string;
  amount: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
}

interface PumpBalance {
  amount: string;
  uiAmount: number;
}

function formatAmount(lamports: string, decimals: number = 9): string {
  const value = BigInt(lamports);
  const divisor = BigInt(10 ** decimals);
  const whole = value / divisor;
  const frac = value % divisor;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}.${fracStr}`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'CONFIRMED': return 'text-green-400';
    case 'PROCESSING': case 'DETECTED': return 'text-yellow-400';
    case 'INITIATED': return 'text-blue-400';
    case 'FAILED': case 'CANCELLED': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

export function BridgePage() {
  const { publicKey, connected, wallet } = useWallet();
  const { connection } = useConnection();
  const queryClient = useQueryClient();
  const walletAddress = publicKey?.toBase58() ?? '';

  const [direction, setDirection] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('');

  // Bridge info (mint address, deposit address, buy link)
  const { data: bridgeInfo } = useQuery<BridgeInfo>({
    queryKey: ['bridge-info'],
    queryFn: () => fetchApi('/solana/bridge-info'),
    staleTime: 300_000,
    refetchOnWindowFocus: false,
  });

  // Solana PUMP balance
  const { data: solanaPumpBalance } = useQuery<PumpBalance>({
    queryKey: ['solana-pump-balance', walletAddress],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/solana/pump-balance/${walletAddress}`);
      const json = await res.json();
      if (!json.success) return { amount: '0', uiAmount: 0 };
      return json.data;
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Pumpchain PUMP balance
  const { data: pumpchainBalance } = useQuery<string>({
    queryKey: ['pumpchain-balance-bridge', walletAddress],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/accounts/${walletAddress}`);
      const json = await res.json();
      if (!json.success) return '0';
      return json.data?.balance ?? '0';
    },
    enabled: !!walletAddress,
    staleTime: 5_000, // Short stale time so balance refreshes quickly after bridge
    refetchOnWindowFocus: false,
  });

  // Bridge stats
  const { data: stats } = useQuery<BridgeStats>({
    queryKey: ['bridge-stats'],
    queryFn: () => fetchApi('/bridge/stats'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Bridge history
  const { data: historyData } = useQuery<{ operations: BridgeOperation[] }>({
    queryKey: ['bridge-history', walletAddress],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/bridge/history/${walletAddress}`);
      const json = await res.json();
      if (!json.success) return { operations: [] };
      return { operations: json.data };
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Deposit mutation — creates a REAL Solana SPL token transfer
  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!publicKey || !wallet?.adapter?.sendTransaction) {
        throw new Error('Wallet not connected or does not support signing');
      }

      const amountBaseUnits = BigInt(Math.floor(parseFloat(amount) * 1_000_000)).toString(); // 6 decimals

      // 1. Create the real SPL token transfer transaction
      const { createBridgeDepositTransaction } = await import('../lib/solana-bridge.js');
      const transaction = await createBridgeDepositTransaction(
        connection,
        publicKey,
        amount,
      );

      // 2. User signs and sends via Phantom (real Solana transaction)
      const signature = await wallet.adapter.sendTransaction(transaction, connection);

      // 3. Wait for confirmation on Solana
      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }, 'confirmed');

      // 4. Send the real signature to our backend for bridge credit
      const res = await fetch(`${API_BASE}/bridge/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          asset: 'PUMP',
          amount: amountBaseUnits,
          solanaSignature: signature,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Deposit failed');
      return json.data;
    },
    onSuccess: () => {
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['bridge-stats'] });
      queryClient.invalidateQueries({ queryKey: ['bridge-history', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['pumpchain-balance-bridge', walletAddress], refetchType: 'all' });
      queryClient.invalidateQueries({ queryKey: ['solana-pump-balance', walletAddress], refetchType: 'all' });
    },
  });

  // Withdraw mutation
  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const amountBaseUnits = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000)).toString(); // 9 decimals

      const res = await fetch(`${API_BASE}/bridge/withdraw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          walletAddress,
          asset: 'PUMP',
          amount: amountBaseUnits,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error?.message ?? 'Withdrawal failed');
      return json.data;
    },
    onSuccess: () => {
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['bridge-stats'] });
      queryClient.invalidateQueries({ queryKey: ['bridge-history', walletAddress] });
      queryClient.invalidateQueries({ queryKey: ['pumpchain-balance-bridge', walletAddress] });
    },
  });

  const activeMutation = direction === 'deposit' ? depositMutation : withdrawMutation;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-white">PUMPCHAIN BRIDGE</h2>
        <p className="text-gray-400">Bridge PUMP between Solana and Pumpchain</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Bridged" value={stats ? formatAmount(stats.totalBridged, 6) + ' PUMP' : '0'} />
        <StatCard label="Pending" value={stats?.pendingTransfers.toString() ?? '0'} />
        <StatCard label="Completed" value={stats?.completedTransfers.toString() ?? '0'} />
        <StatCard label="Operations" value={stats?.totalOperations.toString() ?? '0'} />
      </div>

      {/* Connect */}
      {!connected && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center space-y-4">
          <p className="text-gray-400">Connect your wallet to use the bridge</p>
          <WalletConnectButton />
        </div>
      )}

      {connected && (
        <>
          {/* Balances Overview */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Your PUMP Balances</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-purple-400 mb-1">Solana (SPL Token)</p>
                <p className="text-xl font-mono font-bold text-white">
                  {solanaPumpBalance?.uiAmount.toFixed(2) ?? '0'} PUMP
                </p>
              </div>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-xs text-green-400 mb-1">Pumpchain (Native)</p>
                <p className="text-xl font-mono font-bold text-white">
                  {pumpchainBalance ? formatAmount(pumpchainBalance) : '0'} PUMP
                </p>
              </div>
            </div>
            {/* Buy PUMP link */}
            {bridgeInfo?.buyLink && (
              <div className="mt-3 flex items-center gap-2">
                <a
                  href={bridgeInfo.buyLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-pump-400 hover:text-pump-300 underline"
                >
                  Buy PUMP on Jupiter →
                </a>
                <span className="text-xs text-gray-600">|</span>
                <span className="text-xs text-gray-500">
                  Mint: {bridgeInfo.pumpMint.slice(0, 8)}...
                </span>
                <CopyButton text={bridgeInfo.pumpMint} />
              </div>
            )}
          </div>

          {/* Bridge Form */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-6">
            {/* Direction Toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              <button
                onClick={() => setDirection('deposit')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  direction === 'deposit' ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Deposit (Solana → Pumpchain)
              </button>
              <button
                onClick={() => setDirection('withdraw')}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  direction === 'withdraw' ? 'bg-pump-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Withdraw (Pumpchain → Solana)
              </button>
            </div>

            {/* Deposit Instructions */}
            {direction === 'deposit' && bridgeInfo && (
              <div className="bg-gray-800 rounded-lg p-4 space-y-2">
                <p className="text-xs text-gray-400">To deposit, send PUMP tokens to the bridge address on Solana:</p>
                <div className="flex items-center gap-2 bg-gray-900 px-3 py-2 rounded">
                  <code className="text-xs font-mono text-purple-300 break-all">{bridgeInfo.bridgeDepositAddress}</code>
                  <CopyButton text={bridgeInfo.bridgeDepositAddress} />
                </div>
                <p className="text-xs text-gray-500">Or use the form below (prototype mode):</p>
              </div>
            )}

            {/* Chain Info */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-gray-500">From</p>
                <p className="text-sm font-medium text-white">
                  {direction === 'deposit' ? 'Solana' : 'Pumpchain'}
                </p>
              </div>
              <div className="text-gray-600">→</div>
              <div className="text-center">
                <p className="text-xs text-gray-500">To</p>
                <p className="text-sm font-medium text-white">
                  {direction === 'deposit' ? 'Pumpchain' : 'Solana'}
                </p>
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase tracking-wide">Amount (PUMP)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.1"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-lg focus:outline-none focus:border-pump-500"
              />
            </div>

            {/* Submit */}
            <button
              onClick={() => activeMutation.mutate()}
              disabled={!amount || parseFloat(amount) <= 0 || activeMutation.isPending}
              className="w-full py-3 px-4 rounded-lg font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-pump-600 hover:bg-pump-700"
            >
              {activeMutation.isPending ? 'Processing...' : direction === 'deposit' ? 'Bridge to Pumpchain' : 'Bridge to Solana'}
            </button>

            {/* Success */}
            {activeMutation.isSuccess && (
              <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-4">
                <p className="text-sm text-green-400">Bridge operation successful!</p>
                <p className="text-xs text-green-500 font-mono mt-1">ID: {(activeMutation.data as BridgeOperation).id}</p>
              </div>
            )}

            {/* Error */}
            {activeMutation.isError && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4">
                <p className="text-sm text-red-400">
                  {activeMutation.error instanceof Error ? activeMutation.error.message : 'Bridge operation failed'}
                </p>
              </div>
            )}
          </div>

          {/* Recent Transfers */}
          {historyData?.operations && historyData.operations.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Recent Transfers</h3>
              <div className="space-y-2">
                {historyData.operations.map((op) => (
                  <div key={op.id} className="flex items-center justify-between px-4 py-3 bg-gray-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                        {op.direction === 'DEPOSIT' ? 'Sol → Pump' : 'Pump → Sol'}
                      </span>
                      <span className="text-sm text-white font-mono">
                        {formatAmount(op.amount, op.direction === 'DEPOSIT' ? 6 : 9)} PUMP
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-xs font-medium ${statusColor(op.status)}`}>{op.status}</span>
                      <span className="text-xs text-gray-600">{new Date(op.createdAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Disclaimer */}
      <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          This is a <strong className="text-gray-400">bridge prototype</strong> demonstrating cross-chain PUMP token movement
          between Solana (settlement layer) and Pumpchain (execution layer). In production, deposits would require
          sending PUMP SPL tokens to the bridge deposit address and providing the transaction signature for verification.
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-mono font-bold text-white">{value}</p>
    </div>
  );
}
