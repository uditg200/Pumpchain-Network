import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Pagination, TableSkeleton, EmptyState, ErrorState, HashDisplay } from '../components/ui/index.js';
import { fetchApiWithMeta, timeAgo } from '../lib/api.js';

interface Block {
  blockNumber: number;
  blockHash: string;
  parentHash: string;
  timestamp: string;
  sequencer: string;
  transactionCount: number;
  gasUsed: number;
  gasLimit: number;
}

export function BlocksPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['explorer-blocks', page],
    queryFn: () => fetchApiWithMeta<Block[]>(`/blocks?page=${page}&pageSize=20`),
    staleTime: Infinity, // Never auto-refetch — user manually navigates pages
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Blocks</h2>

      {isLoading && <TableSkeleton rows={10} cols={5} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}

      {data && data.data.length === 0 && <EmptyState title="No blocks yet" />}

      {data && data.data.length > 0 && (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Block</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Age</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Txs</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Gas Used</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Sequencer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.data.map((block) => (
                  <tr key={block.blockNumber} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <Link to={`/blocks/${block.blockNumber}`} className="text-pump-400 hover:text-pump-300 font-mono">
                        #{block.blockNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{timeAgo(block.timestamp)}</td>
                    <td className="px-4 py-3 text-gray-300">{block.transactionCount}</td>
                    <td className="px-4 py-3 text-gray-300 font-mono">{block.gasUsed.toLocaleString()}</td>
                    <td className="px-4 py-3"><HashDisplay hash={block.sequencer} truncate copyable={false} linkable={false} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.meta.page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        </>
      )}
    </div>
  );
}
