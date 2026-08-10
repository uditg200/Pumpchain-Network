import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface Props {
  className?: string;
  placeholder?: string;
}

export function SearchBar({ className = '', placeholder = 'Search by Transaction / Address / Block / Token' }: Props) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    navigate(`/search?q=${encodeURIComponent(q)}`);
    setQuery('');
  }, [query, navigate]);

  return (
    <form onSubmit={handleSearch} className={`relative ${className}`}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 pl-10 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-pump-500 transition-colors"
      />
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>
      <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 text-xs bg-pump-600 hover:bg-pump-700 text-white rounded transition-colors">
        Search
      </button>
    </form>
  );
}
