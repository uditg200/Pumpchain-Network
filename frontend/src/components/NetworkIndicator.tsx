/**
 * Compact network indicator — shows both chain environments.
 */
export function NetworkIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-purple-900/40 text-purple-300 border border-purple-800/40">
        <span className="w-1 h-1 rounded-full bg-purple-400" aria-hidden="true" />
        Solana
      </span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded bg-green-900/40 text-green-300 border border-green-800/40">
        <span className="w-1 h-1 rounded-full bg-green-400" aria-hidden="true" />
        Ansem
      </span>
    </div>
  );
}
