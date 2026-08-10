interface Props {
  network: 'solana' | 'pumpchain';
  className?: string;
}

/**
 * Compact network badge showing which chain an item belongs to.
 */
export function NetworkBadge({ network, className = '' }: Props) {
  const styles = network === 'solana'
    ? 'bg-purple-900/40 text-purple-300 border-purple-700/50'
    : 'bg-green-900/40 text-green-300 border-green-700/50';

  const label = network === 'solana' ? 'Solana' : 'Pumpchain';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${styles} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${network === 'solana' ? 'bg-purple-400' : 'bg-green-400'}`} aria-hidden="true" />
      {label}
    </span>
  );
}
