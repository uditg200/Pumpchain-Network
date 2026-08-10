import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pagination, TableSkeleton, EmptyState, ErrorState, HashDisplay, AddressLink, StatusBadge } from '../components/ui/index.js';
import { fetchApiWithMeta, formatPump, timeAgo } from '../lib/api.js';

interface Tx {
  txHash: string;
  blockNumber: number | null;
  sender: string;
  recipient: string;
  amount: string;
  fee: string;
  status: string;
  gasUsed: number;
  timestamp: string;
}

export function TransactionsPage() {
  const [page, setPage] = useState(1);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['explorer-txs', page],
    queryFn: () => fetchApiWithMeta<Tx[]>(`/explorer/transactions?page=${page}&pageSize=20&sort=latest`),
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Transactions</h2>

      {isLoading && <TableSkeleton rows={10} cols={7} />}
      {error && <ErrorState message={error.message} onRetry={() => refetch()} />}
      {data && data.data.length === 0 && <EmptyState title="No transactions yet" />}

      {data && data.data.length > 0 && (
        <>
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-left">
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Transaction</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Block</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">From</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">To</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Value</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Fee</th>
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {data.data.map((tx) => (
                  <tr key={tx.txHash} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-4 py-3"><HashDisplay hash={tx.txHash} type="tx" /></td>
                    <td className="px-4 py-3 text-gray-400 font-mono">{tx.blockNumber ?? '-'}</td>
                    <td className="px-4 py-3"><AddressLink address={tx.sender} copyable={false} /></td>
                    <td className="px-4 py-3"><AddressLink address={tx.recipient} copyable={false} /></td>
                    <td className="px-4 py-3 text-gray-200 font-mono">{formatPump(tx.amount)}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{formatPump(tx.fee)}</td>
                    <td className="px-4 py-3"><StatusBadge status={tx.status} /></td>
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

