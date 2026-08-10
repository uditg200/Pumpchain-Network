import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { SearchBar, HashDisplay, AddressLink, Skeleton, EmptyState } from '../components/ui/index.js';
import { fetchApi } from '../lib/api.js';

interface SearchResult {
  type: 'block' | 'transaction' | 'account' | 'token' | 'unknown';
  found: boolean;
  data: unknown;
}

export function SearchPage() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  const { data, isLoading } = useQuery<SearchResult>({
    queryKey: ['search', query],
    queryFn: () => fetchApi(`/explorer/search?q=${encodeURIComponent(query)}`),
    enabled: !!query,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Search</h2>
      <SearchBar />

      {!query && <EmptyState title="Enter a search term" message="Search by transaction hash, address, block number, or token symbol" />}
      {isLoading && <Skeleton className="h-40 w-full" />}

      {data && !data.found && (
        <EmptyState title="No results found" message={`Nothing found for "${query}"`} />
      )}

      {data && data.found && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-3">
          <p className="text-xs text-gray-500 uppercase">Result Type: {data.type}</p>
          <ResultDisplay type={data.type} data={data.data} />
        </div>
      )}
    </div>
  );
}

function ResultDisplay({ type, data }: { type: string; data: unknown }) {
  const d = data as Record<string, unknown>;

  if (type === 'block') {
    return (
      <div className="space-y-2">
        <p className="text-white font-medium">Block #{String(d['blockNumber'])}</p>
        <HashDisplay hash={String(d['blockHash'])} type="block" truncate={false} />
      </div>
    );
  }

  if (type === 'transaction') {
    return (
      <div className="space-y-2">
        <p className="text-white font-medium">Transaction</p>
        <HashDisplay hash={String(d['txHash'])} type="tx" truncate={false} />
      </div>
    );
  }

  if (type === 'account') {
    return (
      <div className="space-y-2">
        <p className="text-white font-medium">Account</p>
        <AddressLink address={String(d['address'])} truncate={false} />
      </div>
    );
  }

  return <p className="text-gray-400">Found: {JSON.stringify(data)}</p>;
}
