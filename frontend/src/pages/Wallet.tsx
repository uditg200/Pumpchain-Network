import { useState, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { WalletConnectButton } from '../components/wallet/index.js';
import { HashDisplay, AddressLink, StatusBadge, EmptyState, CopyButton } from '../components/ui/index.js';
import { useTransactionConfirmation, type TxConfirmationStatus } from '../hooks/useTransactionConfirmation.js';
import { fetchApi, formatPump, timeAgo } from '../lib/api.js';

interface AccountData {
  address: string;
  balance: string;
  nonce: number;
}

interface GasEstimate {
  gasLimit: number;
  gasPrice: number;
  estimatedFee: string;
}

interface TxHistoryItem {
  txHash: string;
  sender: string;
  recipient: string;
  amount: string;
  status: string;
  type: string;
  blockNumber: number | null;
  timestamp: number;
}

const STATUS_LABELS: Record<TxConfirmationStatus, string> = {
  idle: '',
  preparing: 'Preparing transaction...',
  waiting_signature: 'Waiting for wallet signature...',
  submitted: 'Transaction submitted',
  pending: 'Waiting for confirmation...',
  confirmed: 'Transaction confirmed!',
  failed: 'Transaction failed',
};

export function WalletPage() {
  const { publicKey, connected } = useWallet();
  const queryClient = useQueryClient();
  const walletAddress = publicKey?.toBase58() ?? '';

  // Send form state
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  // Transaction confirmation hook
  const confirmation = useTransactionConfirmation();

  // Fetch account data (balance + nonce)
  const { data: account, refetch: refetchAccount } = useQuery<AccountData | null>({
    queryKey: ['wallet-account', walletAddress],
    queryFn: async () => {
      try {
        return await fetchApi<AccountData>(`/accounts/${walletAddress}`);
      } catch {
        return null;
      }
    },
    enabled: !!walletAddress,
    staleTime: 5_000,
    refetchOnMount: 'always', // Always fetch fresh data when navigating to wallet
    refetchOnWindowFocus: false,
  });

  // Fetch gas estimate
  const { data: gasEstimate } = useQuery<GasEstimate>({
    queryKey: ['gas-estimate'],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/transactions/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'TRANSFER' }),
      });
      const json = await res.json();
      return json.data;
    },
    staleTime: 120_000,
    refetchOnWindowFocus: false,
  });

  // Fetch transaction history
  const { data: txHistory } = useQuery<{ transactions: TxHistoryItem[]; total: number }>({
    queryKey: ['wallet-tx-history', walletAddress],
    queryFn: async () => {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/accounts/${walletAddress}/transactions?page=1&pageSize=10`);
      const json = await res.json();
      if (!json.success) return { transactions: [], total: 0 };
      return { transactions: json.data ?? [], total: json.meta?.totalItems ?? 0 };
    },
    enabled: !!walletAddress,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  // Submit transaction
  const handleSubmit = useCallback(async () => {
    if (!walletAddress || !recipient || !amount) return;

    confirmation.setStatus('preparing');
    setShowConfirm(false);

    try {
      // Convert to lamports
      const lamports = BigInt(Math.floor(parseFloat(amount) * 1_000_000_000));

      confirmation.setStatus('waiting_signature');

      // For the prototype, the signature is simulated
      // In production, this would be a wallet.signMessage() call
      const signature = `wallet_sig_${Date.now().toString(36)}`;

      confirmation.setStatus('submitted');

      // Submit to backend
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/transactions/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: walletAddress,
          recipient,
          nonce: account?.nonce ?? 0,
          type: 'TRANSFER',
          amount: lamports.toString(),
          gasLimit: gasEstimate?.gasLimit ?? 21000,
          gasPrice: gasEstimate?.gasPrice ?? 1,
          signature,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        confirmation.setStatus('failed');
        return;
      }

      const txHash = json.data.txHash;

      // Wait for confirmation via WebSocket/polling
      confirmation.waitForConfirmation(txHash);

      // DO NOT refresh balance here — only after confirmation
    } catch {
      confirmation.setStatus('failed');
    }
  }, [walletAddress, recipient, amount, account?.nonce, gasEstimate, confirmation]);

  // Refresh balance ONLY after confirmation
  const handleConfirmedRefresh = useCallback(() => {
    refetchAccount();
    queryClient.invalidateQueries({ queryKey: ['wallet-tx-history', walletAddress] });
  }, [refetchAccount, queryClient, walletAddress]);

  // When confirmed, trigger balance refresh
  if (confirmation.status === 'confirmed') {
    // Use a timeout to avoid calling during render
    setTimeout(() => handleConfirmedRefresh(), 500);
  }

  const totalFee = gasEstimate
    ? `${formatPump(gasEstimate.estimatedFee)} PUMP`
    : '...';

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h2 className="text-xl font-bold text-white">Wallet</h2>

      {/* Connect Prompt */}
      {!connected && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center space-y-4">
          <p className="text-gray-400">Connect your Solana wallet to manage PUMP</p>
          <WalletConnectButton />
        </div>
      )}

      {connected && (
        <>
          {/* Account Overview */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-400">Pumpchain Account</h3>
              <CopyButton text={walletAddress} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-500">Address</p>
                <p className="font-mono text-sm text-gray-300 truncate">{walletAddress}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">PUMP Balance</p>
                <p className="text-xl font-mono font-bold text-pump-400">
                  {account ? formatPump(account.balance) : '0'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Nonce</p>
                <p className="text-lg font-mono text-white">{account?.nonce ?? 0}</p>
              </div>
            </div>
          </div>

          {/* Send PUMP Form */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5">
            <h3 className="text-sm font-semibold text-gray-300">Send PUMP</h3>

            {/* Recipient */}
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Recipient Address</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Enter Pumpchain address..."
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-pump-500"
                disabled={confirmation.status !== 'idle'}
              />
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <label className="text-xs text-gray-500">Amount (PUMP)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                min="0"
                step="0.000000001"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white font-mono placeholder-gray-500 focus:outline-none focus:border-pump-500"
                disabled={confirmation.status !== 'idle'}
              />
            </div>

            {/* Gas Info */}
            <div className="grid grid-cols-3 gap-3 px-3 py-2.5 bg-gray-800 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Estimated Gas</p>
                <p className="text-sm font-mono text-gray-300">{gasEstimate?.gasLimit ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Gas Price</p>
                <p className="text-sm font-mono text-gray-300">{gasEstimate?.gasPrice ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Fee</p>
                <p className="text-sm font-mono text-gray-200">{totalFee}</p>
              </div>
            </div>

            {/* Confirmation Dialog */}
            {showConfirm && (
              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-yellow-300">Confirm transaction?</p>
                <p className="text-xs text-gray-400">
                  Send <strong className="text-white">{amount} PUMP</strong> to{' '}
                  <span className="font-mono text-xs">{recipient.slice(0, 8)}...{recipient.slice(-4)}</span>
                </p>
                <p className="text-xs text-gray-500">Fee: {totalFee}</p>
                <div className="flex gap-3">
                  <button
                    onClick={handleSubmit}
                    className="px-4 py-2 bg-pump-600 hover:bg-pump-700 text-white rounded-lg text-sm font-medium"
                  >
                    Confirm & Send
                  </button>
                  <button
                    onClick={() => setShowConfirm(false)}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Send Button */}
            {!showConfirm && confirmation.status === 'idle' && (
              <button
                onClick={() => setShowConfirm(true)}
                disabled={!recipient || !amount || parseFloat(amount) <= 0}
                className="w-full py-3 bg-pump-600 hover:bg-pump-700 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                SEND PUMP
              </button>
            )}

            {/* Transaction Status */}
            {confirmation.status !== 'idle' && (
              <TxStatusDisplay
                status={confirmation.status}
                txHash={confirmation.txHash}
                blockNumber={confirmation.blockNumber}
                error={confirmation.error}
                onReset={() => {
                  confirmation.reset();
                  setRecipient('');
                  setAmount('');
                }}
              />
            )}
          </div>

          {/* Transaction History */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300">Recent Transactions</h3>
            </div>
            {(!txHistory || txHistory.transactions.length === 0) ? (
              <EmptyState title="No transactions" message="Send PUMP or claim from the faucet" />
            ) : (
              <div className="divide-y divide-gray-800">
                {txHistory.transactions.map((tx) => (
                  <div key={tx.txHash} className="px-4 py-3 flex items-center justify-between hover:bg-gray-800/30">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={tx.status} />
                      <div>
                        <HashDisplay hash={tx.txHash} type="tx" />
                        <p className="text-xs text-gray-500 mt-0.5">
                          {tx.sender === walletAddress ? 'Sent to ' : 'From '}
                          <AddressLink address={tx.sender === walletAddress ? tx.recipient : tx.sender} copyable={false} />
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-xs font-mono ${tx.sender === walletAddress ? 'text-red-400' : 'text-green-400'}`}>
                        {tx.sender === walletAddress ? '-' : '+'}{formatPump(tx.amount)} PUMP
                      </p>
                      <p className="text-xs text-gray-600">{timeAgo(tx.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function TxStatusDisplay({
  status,
  txHash,
  blockNumber,
  error,
  onReset,
}: {
  status: TxConfirmationStatus;
  txHash: string | null;
  blockNumber: number | null;
  error: string | null;
  onReset: () => void;
}) {
  const isTerminal = status === 'confirmed' || status === 'failed';
  const isSuccess = status === 'confirmed';

  return (
    <div className={`rounded-lg p-4 space-y-3 border ${
      isSuccess
        ? 'bg-green-900/20 border-green-700/50'
        : status === 'failed'
          ? 'bg-red-900/20 border-red-700/50'
          : 'bg-gray-800 border-gray-700'
    }`}>
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        {!isTerminal && <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />}
        {isSuccess && <div className="w-2 h-2 rounded-full bg-green-400" />}
        {status === 'failed' && <div className="w-2 h-2 rounded-full bg-red-400" />}
        <span className={`text-sm font-medium ${isSuccess ? 'text-green-400' : status === 'failed' ? 'text-red-400' : 'text-gray-300'}`}>
          {STATUS_LABELS[status]}
        </span>
      </div>

      {/* Tx hash */}
      {txHash && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">TX:</span>
          <HashDisplay hash={txHash} type="tx" />
        </div>
      )}

      {/* Block */}
      {blockNumber && (
        <p className="text-xs text-gray-400">
          Included in <Link to={`/blocks/${blockNumber}`} className="text-pump-400 hover:text-pump-300">Block #{blockNumber}</Link>
        </p>
      )}

      {/* Error */}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Reset */}
      {isTerminal && (
        <button onClick={onReset} className="text-xs text-gray-400 hover:text-white underline">
          New transaction
        </button>
      )}
    </div>
  );
}


