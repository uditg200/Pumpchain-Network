import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SearchBar, HashDisplay, AddressLink, StatusBadge, TableSkeleton, EmptyState, CopyButton } from '../components/ui/index.js';
import { fetchApi, formatPump, timeAgo } from '../lib/api.js';

interface ExplorerOverview {
  currentBlock: number;
  latestBlockHash: string;
  totalTransactions: number;
  tps: number;
  activeAccounts: number;
  totalGasUsed: string;
  totalGasFees: string;
  networkUptime: number;
  latestBlocks: Array<{
    blockNumber: number;
    blockHash: string;
    timestamp: string;
    sequencer: string;
    transactionCount: number;
    gasUsed: number;
  }>;
  latestTransactions: Array<{
    txHash: string;
    blockNumber: number | null;
    sender: string;
    recipient: string;
    amount: string;
    fee: string;
    status: string;
    timestamp: string;
  }>;
}

interface SequencerMetrics {
  blocksProduced: number;
  totalTransactionsProcessed: number;
  currentTps: number;
  lastBlockTimes: number[];
}

interface BridgeStats {
  totalBridged: string;
  pendingTransfers: number;
  completedTransfers: number;
  totalOperations: number;
}

export function HomePage() {
  const { data, isLoading } = useQuery<ExplorerOverview>({
    queryKey: ['explorer-overview'],
    queryFn: () => fetchApi('/explorer/overview'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: metrics } = useQuery<SequencerMetrics>({
    queryKey: ['sequencer-metrics-home'],
    queryFn: () => fetchApi('/network/metrics'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: bridgeStats } = useQuery<BridgeStats>({
    queryKey: ['bridge-stats-home'],
    queryFn: () => fetchApi('/bridge/stats'),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const chartData = (metrics?.lastBlockTimes ?? []).map((t, i) => ({ i, ms: t }));

  return (
    <div className="space-y-12">
      {/* ─── Hero Section ─── */}
      <section className="relative py-12 md:py-16">
        <div className="absolute inset-0 bg-gradient-to-b from-pump-950/40 to-transparent rounded-2xl" />
        <div className="relative text-center space-y-6 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            PUMPCHAIN NETWORK
          </h1>
          <p className="text-lg text-gray-300 leading-relaxed">
            The SVM Layer 2 for the PUMP ecosystem.
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 text-sm text-gray-400">
            <span>Solana settlement.</span>
            <span>Pumpchain execution.</span>
            <span>PUMP-powered network economics.</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <Link to="/network" className="px-5 py-2.5 bg-pump-600 hover:bg-pump-700 text-white rounded-lg font-medium text-sm transition-colors">
              Explore Network
            </Link>
            <Link to="/bridge" className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm border border-gray-700 transition-colors">
              Bridge Assets
            </Link>
            <Link to="/faucet" className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium text-sm border border-gray-700 transition-colors">
              Get PUMP
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Network Status Banner ─── */}
      <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-sm font-semibold text-green-400">NETWORK STATUS</span>
            </div>
            <span className="text-sm text-gray-300">Operational</span>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <InfoPair label="Network" value="Pumpchain Mainnet" />
            <InfoPair label="Settlement" value="Solana Mainnet" />
            <InfoPair label="Native Asset" value="PUMP" />
          </div>
        </div>
      </section>

      {/* ─── Search ─── */}
      <SearchBar />

      {/* ─── Statistics Cards ─── */}
      {isLoading && <TableSkeleton rows={1} cols={6} />}
      {data && (
        <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Current Block" value={data.currentBlock.toLocaleString()} accent />
          <StatCard label="TPS" value={data.tps.toString()} />
          <StatCard label="Transactions" value={data.totalTransactions.toLocaleString()} />
          <StatCard label="Active Wallets" value={data.activeAccounts.toLocaleString()} />
          <StatCard label="PUMP in Circulation" value={formatPump(data.totalGasFees)} />
          <StatCard label="Total Gas Used" value={formatPump(data.totalGasUsed)} />
        </section>
      )}

      {/* ─── Latest Blocks & Transactions ─── */}
      {data && (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latest Blocks */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300">Latest Blocks</h3>
              <Link to="/blocks" className="text-xs text-pump-400 hover:text-pump-300">View All →</Link>
            </div>
            {data.latestBlocks.length === 0 ? (
              <EmptyState title="No blocks yet" />
            ) : (
              <div className="divide-y divide-gray-800">
                {data.latestBlocks.map((block) => (
                  <div key={block.blockNumber} className="px-4 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center text-xs font-mono text-pump-400 border border-gray-700">
                        {block.blockNumber}
                      </div>
                      <div>
                        <Link to={`/blocks/${block.blockNumber}`} className="text-sm text-white hover:text-pump-300 transition-colors">
                          Block #{block.blockNumber}
                        </Link>
                        <p className="text-xs text-gray-500">{timeAgo(block.timestamp)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{block.transactionCount} txs</p>
                      <p className="text-xs text-gray-600">{block.gasUsed.toLocaleString()} gas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Latest Transactions */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <h3 className="text-sm font-semibold text-gray-300">Latest Transactions</h3>
              <Link to="/tx" className="text-xs text-pump-400 hover:text-pump-300">View All →</Link>
            </div>
            {data.latestTransactions.length === 0 ? (
              <EmptyState title="No transactions yet" message="Submit a transaction or claim from the faucet" />
            ) : (
              <div className="divide-y divide-gray-800">
                {data.latestTransactions.slice(0, 6).map((tx) => (
                  <div key={tx.txHash} className="px-4 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors">
                    <div className="flex items-center gap-3">
                      <StatusBadge status={tx.status} />
                      <div>
                        <HashDisplay hash={tx.txHash} type="tx" />
                        {/* <p className="text-xs text-gray-500 mt-0.5">
                          <AddressLink address={tx.sender} copyable={false} /> → <AddressLink address={tx.recipient} copyable={false} />
                        </p> */}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-white font-mono">{formatPump(tx.amount)} PUMP</p>
                      <p className="text-xs text-gray-500">{timeAgo(tx.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Network Activity Chart ─── */}
      {chartData.length > 0 && (
        <section className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4">Network Activity — Block Production Time (ms)</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <XAxis dataKey="i" stroke="#4b5563" fontSize={10} />
              <YAxis stroke="#4b5563" fontSize={10} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', fontSize: 12 }} />
              <Line type="monotone" dataKey="ms" stroke="#22c55e" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>
      )}

      {/* ─── Bridge & Faucet Activity ─── */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Bridge Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Bridge Activity</h3>
            <Link to="/bridge" className="text-xs text-pump-400 hover:text-pump-300">Open Bridge →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Total Bridged" value={bridgeStats ? formatPump(bridgeStats.totalBridged) : '0'} />
            <MiniStat label="Pending" value={bridgeStats?.pendingTransfers.toString() ?? '0'} />
            <MiniStat label="Completed" value={bridgeStats?.completedTransfers.toString() ?? '0'} />
            <MiniStat label="Operations" value={bridgeStats?.totalOperations.toString() ?? '0'} />
          </div>
        </div>

        {/* Faucet Activity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-300">Faucet Activity</h3>
            <Link to="/faucet" className="text-xs text-pump-400 hover:text-pump-300">Get PUMP →</Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MiniStat label="Claim Amount" value="2 PUMP" />
            <MiniStat label="Cooldown" value="None" />
            <MiniStat label="Status" value="Active" />
            <MiniStat label="Asset" value="PUMP" />
          </div>
        </div>
      </section>

    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl p-4 border ${accent ? 'bg-pump-950/30 border-pump-800/50' : 'bg-gray-900 border-gray-800'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-mono font-bold ${accent ? 'text-pump-400' : 'text-white'}`}>{value}</p>
    </div>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className="text-gray-200">{value}</span>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-mono font-semibold text-white">{value}</p>
    </div>
  );
}




