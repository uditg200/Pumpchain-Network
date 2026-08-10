import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AddressLink, TableSkeleton, EmptyState } from '../components/ui/index.js';
import { fetchApiWithMeta, formatPump } from '../lib/api.js';

interface TokenHolder {
  address: string;
  tokenSymbol: string;
  balance: string;
}

export function TokenDetailPage() {
  const { symbol } = useParams<{ symbol: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ['token-holders', symbol],
    queryFn: () => fetchApiWithMeta<TokenHolder[]>(`/explorer/tokens/${symbol}?page=1&pageSize=50`),
    enabled: !!symbol,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">{symbol?.toUpperCase()}</h2>
        <p className="text-sm text-gray-400">Pumpchain Native Gas Token &middot; 9 Decimals</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Symbol" value={symbol?.toUpperCase() ?? ''} />
        <StatCard label="Decimals" value="9" />
        <StatCard label="Type" value="Native" />
        <StatCard label="Holders" value={data?.meta.totalItems.toString() ?? '0'} />
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300">Holders</h3>
        </div>
        {isLoading && <div className="p-4"><TableSkeleton rows={5} cols={3} /></div>}
        {data && data.data.length === 0 && <EmptyState title="No holders" />}
        {data && data.data.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-left">
                <th className="px-4 py-2 text-xs text-gray-500">#</th>
                <th className="px-4 py-2 text-xs text-gray-500">Address</th>
                <th className="px-4 py-2 text-xs text-gray-500 text-right">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {data.data.map((h, i) => (
                <tr key={h.address} className="hover:bg-gray-800/50">
                  <td className="px-4 py-2 text-gray-500">{i + 1}</td>
                  <td className="px-4 py-2"><AddressLink address={h.address} /></td>
                  <td className="px-4 py-2 text-right font-mono text-gray-200">{formatPump(h.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-lg font-mono font-bold text-white">{value}</p>
    </div>
  );
}

