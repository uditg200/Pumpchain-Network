import { useState } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnectButton, WalletBalance, WalletAddress } from './wallet/index.js';
import { NetworkIndicator } from './NetworkIndicator.js';
import { usePumpchainWebSocket } from '../hooks/usePumpchainWebSocket.js';

const navLinks = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/blocks', label: 'Explorer' },
  { to: '/tx', label: 'Transactions' },
  { to: '/network', label: 'Network' },
  { to: '/bridge', label: 'Bridge' },
  { to: '/wallet', label: 'Wallet' },
];

export function Layout() {
  const { connected } = useWallet();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  usePumpchainWebSocket();

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-white">
      {/* Top Bar */}
      <header className="border-b border-gray-800 sticky top-0 z-40 bg-gray-950/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 flex items-center justify-between h-14">
          {/* Left: Menu + Logo */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 text-gray-400 hover:text-white rounded-md"
              aria-label="Open menu"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <NavLink to="/" className="text-base font-bold text-pump-400 hover:text-pump-300" aria-label="Home">
              ANSEM NETWORK
            </NavLink>
          </div>

          {/* Center: Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Main navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) =>
                  `px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    isActive
                      ? 'text-pump-400 bg-pump-950/50'
                      : 'text-gray-500 hover:text-gray-200 hover:bg-gray-800/50'
                  }`
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>

          {/* Right: Wallet */}
          <div className="flex items-center gap-2">
            {connected && (
              <div className="hidden md:flex items-center gap-2">
                <WalletBalance />
              </div>
            )}
            <WalletConnectButton />
          </div>
        </div>
      </header>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-gray-950 border-r border-gray-800 flex flex-col animate-slide-in">
            <div className="flex items-center justify-between px-4 h-14 border-b border-gray-800">
              <span className="text-sm font-bold text-pump-400">ANSEM NETWORK</span>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 text-gray-400 hover:text-white" aria-label="Close menu">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5" aria-label="Mobile navigation">
              {navLinks.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end={link.end}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `block px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      isActive ? 'text-pump-400 bg-pump-950/40' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="px-4 py-3 border-t border-gray-800 space-y-3">
              {connected && (
                <div className="space-y-2">
                  <WalletAddress />
                  <WalletBalance />
                </div>
              )}
              <NetworkIndicator />
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 lg:px-6 lg:py-8" role="main">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-auto" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-600">
          <span>Ansem Network</span>
          <NetworkIndicator />
        </div>
      </footer>
    </div>
  );
}
