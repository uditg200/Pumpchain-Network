interface Props {
  blockNumber: number | null;
  className?: string;
}

/**
 * Displays block confirmation status.
 * Shows block number if confirmed, or "Pending" if null.
 */
export function BlockStatus({ blockNumber, className = '' }: Props) {
  if (blockNumber === null) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-yellow-400 ${className}`} role="status">
        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" aria-hidden="true" />
        Pending
      </span>
    );
  }

  return (
    <span className={`text-xs font-mono text-gray-300 ${className}`}>
      Block #{blockNumber.toLocaleString()}
    </span>
  );
}
