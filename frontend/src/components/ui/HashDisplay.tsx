import { Link } from 'react-router-dom';
import { CopyButton } from './CopyButton.js';

interface Props {
  hash: string;
  type?: 'tx' | 'block';
  truncate?: boolean;
  copyable?: boolean;
  linkable?: boolean;
}

export function HashDisplay({ hash, type = 'tx', truncate = true, copyable = true, linkable = true }: Props) {
  if (!hash) return <span className="text-sm text-gray-500">—</span>;
  const display = truncate && hash.length > 16 ? `${hash.slice(0, 8)}...${hash.slice(-8)}` : hash;
  const href = type === 'tx' ? `/tx/${hash}` : `/blocks/${hash}`;

  const content = linkable ? (
    <Link to={href} className="font-mono text-sm text-pump-400 hover:text-pump-300 transition-colors" title={hash}>
      {display}
    </Link>
  ) : (
    <span className="font-mono text-sm text-gray-300" title={hash}>{display}</span>
  );

  return (
    <span className="inline-flex items-center gap-1">
      {content}
      {copyable && <CopyButton text={hash} />}
    </span>
  );
}
