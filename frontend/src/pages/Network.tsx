import { useQuery } from '@tanstack/react-query';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Skeleton, ErrorState } from '../components/ui/index.js';
import { fetchApi } from '../lib/api.js';

interface Stats {
  totalBlocks: number;
  totalTransactions: number;
  totalAccounts: number;
  totalGasUsed: string;
  totalGasFees: string;
  avgBlockTime: number;
  avgTxPerBlock: number;
  tps: number;
  latestBlockTime: string | null;
}

interface SequencerMetrics {
  blocksProduced: number;
  totalTransactionsProcessed: number;
  totalGasUsed: number;
  avgBlockTimeMs: number;
  avgTransactionsPerBlock: number;
  avgGasPerBlock: number;
  currentTps: number;
  cumulativeTransactions: number;
  lastBlockTimes: number[];
}

export function NetworkPage() {
  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<Stats>({
    queryKey: ['network-stats'],
    queryFn: () => fetchApi('/explorer/stats'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: metrics } = useQuery<SequencerMetrics>({
    queryKey: ['sequencer-metrics'],
    queryFn: () => fetchApi('/network/metrics'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  if (statsLoading) return <Skeleton className="h-96 w-full" />;
  if (statsError) return <ErrorState message={statsError.message} />;
  if (!stats) return null;

  // Generate chart data from block times
  const blockTimeData = (metrics?.lastBlockTimes ?? []).map((t, i) => ({
    block: i + 1,
    time: t,
  }));

  // Simulated TPS data
  const tpsData = Array.from({ length: 30 }, (_, i) => ({
    second: i,
    tps: metrics?.currentTps ?? 0,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-bold text-white">Network</h2>
        <p className="text-sm text-gray-400">Pumpchain Testnet health and performance</p>
      </div>

      {/* Health Status */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-3 h-3 rounded-full bg-green-400 animate-pulse" />
          <span className="text-lg font-semibold text-white">Network Healthy</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MiniStat label="Block Height" value={stats.totalBlocks.toLocaleString()} />
          <MiniStat label="Total Transactions" value={stats.totalTransactions.toLocaleString()} />
          <MiniStat label="Accounts" value={stats.totalAccounts.toLocaleString()} />
          <MiniStat label="Avg Block Time" value={`${stats.avgBlockTime}ms`} />
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Block Production */}
        <ChartCard title="Block Production Time (ms)">
          {blockTimeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={blockTimeData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="block" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} />
                <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} labelStyle={{ color: '#9ca3af' }} />
                <Area type="monotone" dataKey="time" stroke="#22c55e" fill="#22c55e" fillOpacity={0.1} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-center text-gray-500 py-10">No data yet</p>}
        </ChartCard>

        {/* TPS */}
        <ChartCard title="Transactions Per Second">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={tpsData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="second" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
              <Line type="monotone" dataKey="tps" stroke="#8b5cf6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Gas Usage */}
        <ChartCard title="Gas Usage">
          <div className="flex items-center justify-center h-[200px]">
            <div className="text-center">
              <p className="text-3xl font-mono font-bold text-white">{(metrics?.totalGasUsed ?? 0).toLocaleString()}</p>
              <p className="text-sm text-gray-500 mt-1">Total Gas Consumed</p>
              <p className="text-xs text-gray-600 mt-2">Avg per block: {(metrics?.avgGasPerBlock ?? 0).toLocaleString()}</p>
            </div>
          </div>
        </ChartCard>

        {/* Active Accounts */}
        <ChartCard title="Active Accounts">
          <div className="flex items-center justify-center h-[200px]">
            <div className="text-center">
              <p className="text-3xl font-mono font-bold text-white">{stats.totalAccounts}</p>
              <p className="text-sm text-gray-500 mt-1">Total Accounts</p>
              <p className="text-xs text-gray-600 mt-2">Avg txs/block: {metrics?.avgTransactionsPerBlock.toFixed(2) ?? '0'}</p>
            </div>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-mono font-bold text-white">{value}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h4 className="text-sm font-medium text-gray-400 mb-4">{title}</h4>
      {children}
    </div>
  );
}
