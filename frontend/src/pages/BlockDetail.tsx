import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { HashDisplay, CopyButton, Skeleton, ErrorState } from '../components/ui/index.js';
import { fetchApi, timeAgo } from '../lib/api.js';

interface BlockData {
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  stateRoot: string;
  timestamp: string;
  sequencer: string;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
}

export function BlockDetailPage() {
  const { blockNumber } = useParams<{ blockNumber: string }>();

  const { data, isLoading, error } = useQuery<BlockData>({
    queryKey: ['block-detail', blockNumber],
    queryFn: () => fetchApi(`/explorer/blocks/${blockNumber}`),
    enabled: !!blockNumber,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState message={error.message} />;
  if (!data) return <ErrorState message="Block not found" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-white">Block #{data.blockNumber}</h2>
        {data.blockNumber > 0 && (
          <Link to={`/blocks/${data.blockNumber - 1}`} className="text-xs text-gray-400 hover:text-white">← Prev</Link>
        )}
        <Link to={`/blocks/${data.blockNumber + 1}`} className="text-xs text-gray-400 hover:text-white">Next →</Link>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
        <DetailRow label="Block Number" value={`#${data.blockNumber}`} />
        <DetailRow label="Block Hash">
          <span className="font-mono text-sm text-gray-300 break-all">{data.blockHash}</span>
          <CopyButton text={data.blockHash} />
        </DetailRow>
        <DetailRow label="Parent Hash">
          <HashDisplay hash={data.parentHash} type="block" truncate={false} />
        </DetailRow>
        <DetailRow label="Timestamp" value={`${new Date(data.timestamp).toLocaleString()} (${timeAgo(data.timestamp)})`} />
        <DetailRow label="Sequencer">
          <span className="font-mono text-sm text-gray-300">{data.sequencer}</span>
        </DetailRow>
        <DetailRow label="Transaction Count" value={data.transactionCount.toString()} />
        <DetailRow label="Gas Used" value={`${data.gasUsed.toLocaleString()} / ${data.gasLimit.toLocaleString()}`} />
        <DetailRow label="Gas Limit" value={data.gasLimit.toLocaleString()} />
        <DetailRow label="State Root">
          <span className="font-mono text-xs text-gray-400 break-all">{data.stateRoot}</span>
          <CopyButton text={data.stateRoot} />
        </DetailRow>
      </div>
    </div>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3">
      <span className="text-xs text-gray-500 sm:w-40 shrink-0">{label}</span>
      <div className="flex items-center gap-2 min-w-0">
        {value ? <span className="text-sm text-gray-200">{value}</span> : children}
      </div>
    </div>
  );
}
