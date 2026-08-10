import { useWallet } from '@solana/wallet-adapter-react';
import { useCallback, useState } from 'react';

/**
 * WalletAddress displays the connected wallet address with:
 * - Truncated display
 * - Copy to clipboard
 * - Open on Solana Explorer (Devnet)
 */
export function WalletAddress() {
  const { publicKey } = useWallet();
  const [copied, setCopied] = useState(false);

  const address = publicKey?.toBase58() ?? '';
  const truncated = address ? `${address.slice(0, 4)}...${address.slice(-4)}` : '';

  const copyAddress = useCallback(async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [address]);

  const openExplorer = useCallback(() => {
    if (!address) return;
    const url = `https://explorer.solana.com/address/${address}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [address]);

  if (!publicKey) return null;

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={copyAddress}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm font-mono text-gray-300 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 hover:text-white transition-colors"
        title="Copy full address"
      >
        <span>{truncated}</span>
        <span className="text-xs text-gray-500">
          {copied ? '✓' : '⎘'}
        </span>
      </button>
      <button
        onClick={openExplorer}
        className="p-1.5 text-gray-500 hover:text-purple-400 transition-colors"
        title="View on Solana Explorer (Devnet)"
        aria-label="Open on Solana Explorer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
    </div>
  );
}
