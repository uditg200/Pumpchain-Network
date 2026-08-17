import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HashDisplay, AddressLink, StatusBadge, CopyButton, Skeleton, ErrorState } from '../components/ui/index.js';
import { fetchApi, formatPump, timeAgo } from '../lib/api.js';

interface TxData {
  txHash: string;
  blockNumber: number | null;
  sender: string;
  recipient: string;
  amount: string;
  gasUsed: number;
  gasPrice: number;
  fee: string;
  status: string;
  nonce: number;
  timestamp: string;
}

export function TransactionDetailPage() {
  const { hash } = useParams<{ hash: string }>();

  const { data, isLoading, error } = useQuery<TxData>({
    queryKey: ['tx-detail', hash],
    queryFn: () => fetchApi(`/explorer/transactions/${hash}`),
    enabled: !!hash,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return <ErrorState message="Transaction not found" />;

  const gasLimit = data.gasUsed > 0 ? data.gasUsed : 21000;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Transaction Details</h2>

      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
        <Row label="Transaction Hash">
          <span className="font-mono text-sm text-gray-300 break-all">{data.txHash}</span>
          <CopyButton text={data.txHash} />
        </Row>
        <Row label="Status"><StatusBadge status={data.status} /></Row>
        <Row label="Block" value={data.blockNumber?.toString() ?? 'Pending'} />
        <Row label="Timestamp" value={`${new Date(data.timestamp).toLocaleString()} (${timeAgo(data.timestamp)})`} />
        <Row label="From"><AddressLink address={data.sender} truncate={false} /></Row>
        <Row label="To"><AddressLink address={data.recipient} truncate={false} /></Row>
        <Row label="Amount" value={`${formatPump(data.amount)} ANSEM`} />
        <Row label="Gas Limit" value={gasLimit.toLocaleString()} />
        <Row label="Gas Used" value={data.gasUsed.toLocaleString()} />
        <Row label="Gas Price" value={`${data.gasPrice} lamports`} />
        <Row label="Fee" value={`${formatPump(data.fee)} ANSEM`} />
        <Row label="Nonce" value={data.nonce.toString()} />
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
      <span className="text-xs text-gray-500 sm:w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {value ? <span className="text-sm text-gray-200">{value}</span> : children}
      </div>
    </div>
  );
}



