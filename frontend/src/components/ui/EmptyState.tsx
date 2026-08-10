interface Props {
  title?: string;
  message?: string;
}

export function EmptyState({ title = 'No data', message = 'Nothing to display yet.' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-gray-800 flex items-center justify-center mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-600"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <p className="text-sm font-medium text-gray-400">{title}</p>
      <p className="text-xs text-gray-600 mt-1">{message}</p>
    </div>
  );
}
