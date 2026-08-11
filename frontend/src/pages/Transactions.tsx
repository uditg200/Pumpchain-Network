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
  type: string;
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
                  <th className="px-4 py-3 text-xs text-gray-500 font-medium">Type</th>
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
                    <td className="px-4 py-3"><TxTypeBadge type={tx.type} /></td>
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


const typeLabels: Record<string, { label: string; color: string }> = {
  TRANSFER: { label: 'Transfer', color: 'bg-blue-900/40 text-blue-300 border-blue-700/50' },
  BRIDGE_DEPOSIT: { label: 'Bridge In', color: 'bg-purple-900/40 text-purple-300 border-purple-700/50' },
  BRIDGE_WITHDRAW: { label: 'Bridge Out', color: 'bg-orange-900/40 text-orange-300 border-orange-700/50' },
  FAUCET_CLAIM: { label: 'Faucet', color: 'bg-green-900/40 text-green-300 border-green-700/50' },
  CONTRACT_CALL: { label: 'Contract', color: 'bg-gray-800 text-gray-300 border-gray-700' },
};

function TxTypeBadge({ type }: { type: string }) {
  const cfg = typeLabels[type] ?? { label: type, color: 'bg-gray-800 text-gray-400 border-gray-700' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded border whitespace-nowrap ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}
