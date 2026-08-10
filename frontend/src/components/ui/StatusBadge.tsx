interface Props {
  status: string;
}

const colors: Record<string, string> = {
  CONFIRMED: 'bg-green-900/40 text-green-400 border-green-700/50',
  PENDING: 'bg-yellow-900/40 text-yellow-400 border-yellow-700/50',
  PROCESSING: 'bg-blue-900/40 text-blue-400 border-blue-700/50',
  FAILED: 'bg-red-900/40 text-red-400 border-red-700/50',
  REJECTED: 'bg-red-900/40 text-red-400 border-red-700/50',
  CANCELLED: 'bg-gray-800 text-gray-400 border-gray-700',
};

export function StatusBadge({ status }: Props) {
  const color = colors[status.toUpperCase()] ?? 'bg-gray-800 text-gray-400 border-gray-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded border ${color}`}>
      {status}
    </span>
  );
}
