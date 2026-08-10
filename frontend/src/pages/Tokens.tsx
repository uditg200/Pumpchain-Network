import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui/index.js';

export function TokensPage() {
  // PUMP is the native token
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white">Tokens</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-left">
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Token</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Symbol</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Decimals</th>
              <th className="px-4 py-3 text-xs text-gray-500 font-medium">Type</th>
            </tr>
          </thead>
          <tbody>
            <tr className="hover:bg-gray-800/50 transition-colors">
              <td className="px-4 py-3">
                <Link to="/token/PUMP" className="text-pump-400 hover:text-pump-300 font-medium">PUMP</Link>
              </td>
              <td className="px-4 py-3 text-gray-300 font-mono">PUMP</td>
              <td className="px-4 py-3 text-gray-400">9</td>
              <td className="px-4 py-3 text-gray-400">Native Gas Token</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

