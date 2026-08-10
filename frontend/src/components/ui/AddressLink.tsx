import { Link } from 'react-router-dom';
import { CopyButton } from './CopyButton.js';

interface Props {
  address: string;
  truncate?: boolean;
  copyable?: boolean;
}

export function AddressLink({ address, truncate = true, copyable = true }: Props) {
  if (!address) return <span className="text-sm text-gray-500">—</span>;
  const display = truncate && address.length > 12 ? `${address.slice(0, 6)}...${address.slice(-4)}` : address;

  return (
    <span className="inline-flex items-center gap-1">
      <Link to={`/address/${address}`} className="font-mono text-sm text-blue-400 hover:text-blue-300 transition-colors" title={address}>
        {display}
      </Link>
      {copyable && <CopyButton text={address} />}
    </span>
  );
}
