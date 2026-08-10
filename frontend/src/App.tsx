import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletProvider } from './providers/WalletProvider.js';
import { ToastProvider } from './components/ui/index.js';
import { Layout } from './components/Layout.js';
import { HomePage } from './pages/Home.js';
import { FaucetPage } from './pages/Faucet.js';
import { BridgePage } from './pages/Bridge.js';
import { BlocksPage } from './pages/Blocks.js';
import { BlockDetailPage } from './pages/BlockDetail.js';
import { TransactionsPage } from './pages/Transactions.js';
import { TransactionDetailPage } from './pages/TransactionDetail.js';
import { AddressDetailPage } from './pages/AddressDetail.js';
import { TokensPage } from './pages/Tokens.js';
import { TokenDetailPage } from './pages/TokenDetail.js';
import { SearchPage } from './pages/Search.js';
import { NetworkPage } from './pages/Network.js';
import { WalletPage } from './pages/Wallet.js';
import { DevelopersPage } from './pages/Developers.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <ToastProvider>
          <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<HomePage />} />
              <Route path="blocks" element={<BlocksPage />} />
              <Route path="blocks/:blockNumber" element={<BlockDetailPage />} />
              <Route path="tx" element={<TransactionsPage />} />
              <Route path="tx/:hash" element={<TransactionDetailPage />} />
              <Route path="address/:address" element={<AddressDetailPage />} />
              <Route path="tokens" element={<TokensPage />} />
              <Route path="token/:symbol" element={<TokenDetailPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="network" element={<NetworkPage />} />
              <Route path="faucet" element={<FaucetPage />} />
              <Route path="bridge" element={<BridgePage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="developers" element={<DevelopersPage />} />
            </Route>
          </Routes>
        </BrowserRouter>
        </ToastProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
