import { TableSkeleton } from './Skeleton.js';
import { EmptyState } from './EmptyState.js';
import { ErrorState } from './ErrorState.js';

interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  isLoading?: boolean;
  error?: Error | null;
  emptyTitle?: string;
  emptyMessage?: string;
  onRetry?: () => void;
  keyFn: (row: T) => string;
}

/**
 * Reusable data table with loading, empty, and error states.
 * Responsive with horizontal scroll on mobile.
 */
export function DataTable<T>({ columns, data, isLoading, error, emptyTitle, emptyMessage, onRetry, keyFn }: Props<T>) {
  if (isLoading) return <TableSkeleton rows={8} cols={columns.length} />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (!data || data.length === 0) return <EmptyState title={emptyTitle} message={emptyMessage} />;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto" role="table">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left" role="row">
            {columns.map((col) => (
              <th key={col.key} className={`px-4 py-3 text-xs text-gray-500 font-medium whitespace-nowrap ${col.className ?? ''}`} role="columnheader" scope="col">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {data.map((row) => (
            <tr key={keyFn(row)} className="hover:bg-gray-800/40 transition-colors" role="row">
              {columns.map((col) => (
                <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`} role="cell">
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
