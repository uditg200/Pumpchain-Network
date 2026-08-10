interface Props {
  status: string;
  className?: string;
}

const config: Record<string, { color: string; icon: string; label: string }> = {
  PENDING: { color: 'text-yellow-400', icon: '◷', label: 'Pending' },
  CONFIRMED: { color: 'text-green-400', icon: '✓', label: 'Confirmed' },
  FAILED: { color: 'text-red-400', icon: '✗', label: 'Failed' },
  REJECTED: { color: 'text-red-400', icon: '⊘', label: 'Rejected' },
  EXECUTING: { color: 'text-blue-400', icon: '⟳', label: 'Executing' },
  VALIDATING: { color: 'text-blue-400', icon: '⟳', label: 'Validating' },
};

export function TransactionStatus({ status, className = '' }: Props) {
  const cfg = config[status.toUpperCase()] ?? { color: 'text-gray-400', icon: '?', label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.color} ${className}`} role="status">
      <span aria-hidden="true">{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}
