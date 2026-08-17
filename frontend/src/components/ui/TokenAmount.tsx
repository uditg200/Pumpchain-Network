interface Props {
  amount: string;
  symbol?: string;
  decimals?: number;
  className?: string;
}

/**
 * Displays a token amount formatted from base units to human-readable.
 * Uses integer math only — no floating point.
 */
export function TokenAmount({ amount, symbol = 'ANSEM', decimals = 9, className = '' }: Props) {
  const formatted = formatFromBase(amount, decimals);
  return (
    <span className={`font-mono ${className}`}>
      {formatted} {symbol}
    </span>
  );
}

function formatFromBase(baseUnits: string, decimals: number): string {
  try {
    const value = BigInt(baseUnits);
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const frac = value % divisor;
    if (frac === 0n) return whole.toLocaleString();
    const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
    return `${whole.toLocaleString()}.${fracStr}`;
  } catch {
    return '0';
  }
}
