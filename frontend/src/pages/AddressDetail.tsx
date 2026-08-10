import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CopyButton, HashDisplay, StatusBadge, Skeleton, ErrorState, EmptyState } from '../components/ui/index.js';
import { fetchApi, formatPump, timeAgo } from '../lib/api.js';

interface AccountData {
  address: string;
  accountType: string;
  balance: string;
  nonce: number;
  createdAt: string;
  updatedAt: string;
}

interface Tx {
  txHash: string;
  blockNumber: number | null;
  sender: string;
  recipient: string;
  amount: string;
  status: string;
  timestamp: string;
}

export function AddressDetailPage() {
  const { address } = useParams<{ address: string }>();

  const { data: account, isLoading, error } = useQuery<AccountData>({
    queryKey: ['account-detail', address],
    queryFn: () => fetchApi(`/explorer/accounts/${address}`),
    enabled: !!address,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: txData } = useQuery<{ transactions: Tx[]; total: number }>({
    queryKey: ['account-txs', address],
    queryFn: async () => {
      const res = await fetch(`/api/accounts/${address}/transactions?page=1&pageSize=10`);
      const json = await res.json();
      if (!json.success) return { transactions: [], total: 0 };
      return { transactions: json.data ?? [], total: json.meta?.totalItems ?? 0 };
    },
    enabled: !!address,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (error) return <ErrorState message={error.message} />;
  if (!account) return <ErrorState message="Account not found" />;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Address</h2>

      {/* Account Info */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
        <Row label="Address">
          <span className="font-mono text-sm text-gray-300 break-all">{account.address}</span>
          <CopyButton text={account.address} />
        </Row>
        <Row label="PUMP Balance" value={`${formatPump(account.balance)} PUMP`} />
        <Row label="Nonce" value={account.nonce.toString()} />
        <Row label="Type" value={account.accountType} />
        <Row label="Transaction Count" value={txData?.total.toString() ?? '0'} />
        <Row label="First Seen" value={new Date(account.createdAt).toLocaleString()} />
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-gray-300">Recent Activity</h3>
        </div>
        {(!txData || txData.transactions.length === 0) ? (
          <EmptyState title="No transactions" />
        ) : (
          <div className="divide-y divide-gray-800">
            {txData.transactions.map((tx) => (
              <div key={tx.txHash} className="px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge status={tx.status} />
                  <div>
                    <HashDisplay hash={tx.txHash} type="tx" />
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(tx.timestamp)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-mono text-white">{formatPump(tx.amount)} PUMP</p>
                  <p className="text-xs text-gray-500">
                    {tx.sender === address ? 'Sent' : 'Received'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
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


