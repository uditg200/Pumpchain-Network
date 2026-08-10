import { useState, useCallback, useEffect, useRef } from 'react';
import { CopyButton } from '../components/ui/index.js';

const RPC_URL = `${import.meta.env.VITE_API_BASE_URL || window.location.origin + '/api'}/rpc`;

const SECTIONS = [
  'Quick Start',
  'Network Config',
  'RPC',
  'Transactions',
  'Accounts',
  'Explorer API',
  'Bridge API',
  'Faucet API',
  'SDK',
  'Examples',
] as const;

export function DevelopersPage() {
  const [activeSection, setActiveSection] = useState<string>('Quick Start');

  const scrollToSection = useCallback((section: string) => {
    setActiveSection(section);
    const el = document.getElementById(section);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  // Auto-detect which section is in view on scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );

    for (const section of SECTIONS) {
      const el = document.getElementById(section);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex gap-8">
      {/* Sidebar */}
      <aside className="hidden lg:block w-48 shrink-0">
        <nav className="sticky top-8 space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => scrollToSection(s)}
              className={`block w-full text-left px-3 py-1.5 text-sm rounded transition-colors ${
                activeSection === s
                  ? 'text-pump-400 bg-pump-950/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </nav>
      </aside>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-10">
        <header>
          <h1 className="text-2xl font-bold text-white">Developer Portal</h1>
          <p className="text-sm text-gray-400 mt-1">
            Build on Pumpchain Testnet — the SVM Layer 2 execution network
          </p>
        </header>

        {/* Network Info Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <InfoCard label="Network" value="Pumpchain Mainnet" />
          <InfoCard label="Chain ID" value="pumpchain-mainnet" copiable />
          <InfoCard label="Native Token" value="PUMP" />
          <InfoCard label="Settlement" value="Solana Mainnet" />
        </div>

        {/* Quick Start */}
        <Section id="Quick Start" title="Quick Start">
          <p className="text-sm text-gray-400 mb-4">
            Get started with Pumpchain in 3 steps:
          </p>
          <ol className="list-decimal list-inside space-y-3 text-sm text-gray-300">
            <li>Get PUMP from the <a href="/faucet" className="text-pump-400 hover:underline">Faucet</a></li>
            <li>Use the JSON-RPC endpoint to query the network</li>
            <li>Submit your first transaction</li>
          </ol>
          <CodeBlock title="Check your balance" code={`curl -X POST ${RPC_URL} \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "chain_getBalance",
    "params": ["YOUR_ADDRESS"]
  }'`} />
        </Section>

        {/* Network Configuration */}
        <Section id="Network Config" title="Network Configuration">
          <div className="space-y-2">
            <ConfigRow label="RPC Endpoint" value={RPC_URL} />
            <ConfigRow label="Chain ID" value="pumpchain-mainnet" />
            <ConfigRow label="Network Name" value="Pumpchain Network" />
            <ConfigRow label="Native Token" value="PUMP" />
            <ConfigRow label="Decimals" value="9" />
            <ConfigRow label="Block Time" value="~2000ms" />
            <ConfigRow label="Settlement Layer" value="Solana Mainnet" />
            <ConfigRow label="Gas Token" value="PUMP" />
          </div>
        </Section>

        {/* RPC */}
        <Section id="RPC" title="JSON-RPC API">
          <p className="text-sm text-gray-400 mb-4">
            Pumpchain exposes a JSON-RPC 2.0 compatible endpoint. All requests use POST.
          </p>
          <ConfigRow label="Endpoint" value={`POST ${RPC_URL}`} />

          <h4 className="text-sm font-semibold text-gray-300 mt-6 mb-3">Available Methods</h4>

          <RpcMethod
            method="chain_getBlockNumber"
            description="Returns the current block height"
            request={`{
  "jsonrpc": "2.0", "id": 1,
  "method": "chain_getBlockNumber"
}`}
            response={`{
  "jsonrpc": "2.0", "id": 1,
  "result": 42
}`}
          />

          <RpcMethod
            method="chain_getBlock"
            description="Returns block data by number"
            request={`{
  "jsonrpc": "2.0", "id": 1,
  "method": "chain_getBlock",
  "params": [0]
}`}
            response={`{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "blockNumber": 0,
    "blockHash": "8e91...",
    "parentHash": "0000...0000",
    "timestamp": 1700000000000,
    "proposer": "PumpGenesis...",
    "transactionCount": 0,
    "gasUsed": 0,
    "gasLimit": 50000000,
    "stateRoot": "832f..."
  }
}`}
          />

          <RpcMethod
            method="chain_getBalance"
            description="Returns balance and nonce for an address"
            request={`{
  "jsonrpc": "2.0", "id": 1,
  "method": "chain_getBalance",
  "params": ["YOUR_ADDRESS"]
}`}
            response={`{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "address": "YOUR_ADDRESS",
    "balance": "10000000000",
    "nonce": 0
  }
}`}
          />

          <RpcMethod
            method="chain_getTransaction"
            description="Returns transaction by hash"
            request={`{
  "jsonrpc": "2.0", "id": 1,
  "method": "chain_getTransaction",
  "params": ["TX_HASH"]
}`}
            response={`{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "txHash": "...",
    "sender": "...",
    "recipient": "...",
    "amount": "500000000",
    "status": "CONFIRMED",
    "blockNumber": 5,
    "gasUsed": 5000,
    "fee": "5000"
  }
}`}
          />

          <RpcMethod
            method="chain_getNetworkInfo"
            description="Returns network status and stats"
            request={`{
  "jsonrpc": "2.0", "id": 1,
  "method": "chain_getNetworkInfo"
}`}
            response={`{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "networkId": "pumpchain-mainnet",
    "chainName": "Pumpchain Network",
    "nativeSymbol": "PUMP",
    "environment": "mainnet",
    "currentBlockHeight": 100,
    "tps": 0,
    "status": "online"
  }
}`}
          />

          <RpcMethod
            method="chain_sendTransaction"
            description="Submits a new transaction"
            request={`{
  "jsonrpc": "2.0", "id": 1,
  "method": "chain_sendTransaction",
  "params": [{
    "sender": "SENDER_ADDRESS",
    "recipient": "RECIPIENT_ADDRESS",
    "amount": "1000000000",
    "nonce": 0,
    "gasLimit": 21000,
    "gasPrice": 1,
    "signature": "WALLET_SIGNATURE"
  }]
}`}
            response={`{
  "jsonrpc": "2.0", "id": 1,
  "result": {
    "txHash": "abc123...",
    "status": "PENDING",
    "nonce": 0
  }
}`}
          />
        </Section>

        {/* Transactions */}
        <Section id="Transactions" title="Transactions">
          <p className="text-sm text-gray-400 mb-4">Transaction lifecycle on Pumpchain:</p>
          <div className="bg-gray-800 rounded-lg p-4 font-mono text-xs text-gray-300 space-y-1">
            <p>PENDING → VALIDATING → EXECUTING → CONFIRMED</p>
            <p className="text-red-400">                              └→ FAILED</p>
            <p className="text-red-400">         └→ REJECTED</p>
          </div>
          <h4 className="text-sm font-semibold text-gray-300 mt-6 mb-2">Transaction Types</h4>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside">
            <li><code className="text-gray-300">TRANSFER</code> — Send PUMP between accounts</li>
            <li><code className="text-gray-300">BRIDGE_DEPOSIT</code> — Solana → Pumpchain</li>
            <li><code className="text-gray-300">BRIDGE_WITHDRAW</code> — Pumpchain → Solana</li>
            <li><code className="text-gray-300">FAUCET_CLAIM</code> — Testnet faucet drip</li>
            <li><code className="text-gray-300">CONTRACT_CALL</code> — Smart contract interaction (future)</li>
          </ul>
        </Section>

        {/* Accounts */}
        <Section id="Accounts" title="Accounts">
          <p className="text-sm text-gray-400 mb-4">
            Pumpchain accounts use base58 addresses (same format as Solana).
            Each account has a balance (PUMP) and sequential nonce.
          </p>
          <CodeBlock title="Get account info" code={`GET /api/accounts/{address}

Response:
{
  "address": "...",
  "balance": "10000000000",
  "nonce": 3
}`} />
        </Section>

        {/* Explorer API */}
        <Section id="Explorer API" title="Explorer API">
          <p className="text-sm text-gray-400 mb-3">REST endpoints for querying blockchain data:</p>
          <div className="space-y-1 font-mono text-xs">
            <ApiRow method="GET" path="/api/explorer/overview" />
            <ApiRow method="GET" path="/api/explorer/blocks?page=1&pageSize=20&sort=latest" />
            <ApiRow method="GET" path="/api/explorer/blocks/{blockNumber}" />
            <ApiRow method="GET" path="/api/explorer/transactions?page=1&pageSize=20" />
            <ApiRow method="GET" path="/api/explorer/transactions/{hash}" />
            <ApiRow method="GET" path="/api/explorer/accounts/{address}" />
            <ApiRow method="GET" path="/api/explorer/search?q={query}" />
            <ApiRow method="GET" path="/api/explorer/stats" />
          </div>
        </Section>

        {/* Bridge API */}
        <Section id="Bridge API" title="Bridge API">
          <p className="text-sm text-gray-400 mb-3">Bridge between Solana Devnet and Pumpchain Testnet:</p>
          <div className="space-y-1 font-mono text-xs">
            <ApiRow method="POST" path="/api/bridge/deposit" />
            <ApiRow method="POST" path="/api/bridge/withdraw" />
            <ApiRow method="GET" path="/api/bridge/stats" />
            <ApiRow method="GET" path="/api/bridge/history/{walletAddress}" />
            <ApiRow method="GET" path="/api/bridge/{id}" />
          </div>
        </Section>

        {/* Faucet API */}
        <Section id="Faucet API" title="Faucet API">
          <p className="text-sm text-gray-400 mb-3">Get free PUMP for testing (testnet only):</p>
          <CodeBlock title="Claim PUMP" code={`POST /api/faucet/claim
Content-Type: application/json

{ "walletAddress": "YOUR_ADDRESS" }

Response:
{
  "amount": "10000000000",
  "asset": "PUMP",
  "transactionHash": "...",
  "nextClaimAt": "2026-08-11T..."
}`} />
        </Section>

        {/* SDK */}
        <Section id="SDK" title="SDK (Coming Soon)">
          <p className="text-sm text-gray-400">
            A TypeScript SDK for Pumpchain is under development. It will provide:
          </p>
          <ul className="text-sm text-gray-400 space-y-1 list-disc list-inside mt-3">
            <li>Type-safe RPC client</li>
            <li>Transaction builders</li>
            <li>Account management</li>
            <li>WebSocket subscriptions</li>
            <li>Bridge helpers</li>
          </ul>
        </Section>

        {/* Examples / Tutorial */}
        <Section id="Examples" title="Build Your First Pumpchain Transaction">
          <p className="text-sm text-gray-400 mb-4">
            Follow these steps to submit a transaction on Pumpchain Testnet:
          </p>

          <div className="space-y-6">
            <Step num={1} title="Get PUMP from the faucet (testnet) or bridge from Solana">
              <CodeBlock code={`curl -X POST ${window.location.origin}/api/faucet/claim \\
  -H "Content-Type: application/json" \\
  -d '{"walletAddress": "YOUR_ADDRESS"}'`} />
            </Step>

            <Step num={2} title="Check your balance">
              <CodeBlock code={`curl -X POST ${RPC_URL} \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "chain_getBalance",
    "params": ["YOUR_ADDRESS"]
  }'`} />
            </Step>

            <Step num={3} title="Get gas estimate">
              <CodeBlock code={`curl -X POST ${window.location.origin}/api/transactions/estimate \\
  -H "Content-Type: application/json" \\
  -d '{"type": "TRANSFER"}'`} />
            </Step>

            <Step num={4} title="Submit the transaction">
              <CodeBlock code={`curl -X POST ${RPC_URL} \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "chain_sendTransaction",
    "params": [{
      "sender": "YOUR_ADDRESS",
      "recipient": "RECIPIENT_ADDRESS",
      "amount": "1000000000",
      "nonce": 0,
      "gasLimit": 5000,
      "gasPrice": 1,
      "signature": "your_wallet_signature"
    }]
  }'`} />
            </Step>

            <Step num={5} title="Check transaction status">
              <CodeBlock code={`curl -X POST ${RPC_URL} \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0", "id": 1,
    "method": "chain_getTransaction",
    "params": ["TX_HASH_FROM_STEP_4"]
  }'`} />
            </Step>
          </div>
        </Section>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-8">
      <h2 className="text-lg font-bold text-white mb-4 pb-2 border-b border-gray-800">{title}</h2>
      {children}
    </section>
  );
}

function InfoCard({ label, value, copiable }: { label: string; value: string; copiable?: boolean }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <div className="flex items-center gap-1.5 mt-0.5">
        <p className="text-sm font-mono text-white">{value}</p>
        {copiable && <CopyButton text={value} />}
      </div>
    </div>
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-xs font-mono text-gray-200">{value}</code>
        <CopyButton text={value} />
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title?: string; code: string }) {
  return (
    <div className="mt-3 bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
      {title && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700 bg-gray-800/80">
          <span className="text-xs text-gray-500">{title}</span>
          <CopyButton text={code} />
        </div>
      )}
      {!title && (
        <div className="absolute top-2 right-2 z-10">
          <CopyButton text={code} />
        </div>
      )}
      <pre className="p-3 text-xs font-mono text-gray-300 overflow-x-auto whitespace-pre relative">
        {!title && <span className="absolute top-2 right-2"><CopyButton text={code} /></span>}
        {code}
      </pre>
    </div>
  );
}

function RpcMethod({ method, description, request, response }: { method: string; description: string; request: string; response: string }) {
  return (
    <div className="mt-5 space-y-2">
      <div className="flex items-center gap-2">
        <code className="text-sm font-mono text-pump-400 font-semibold">{method}</code>
        <span className="text-xs text-gray-500">— {description}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <CodeBlock title="Request" code={request} />
        <CodeBlock title="Response" code={response} />
      </div>
    </div>
  );
}

function ApiRow({ method, path }: { method: string; path: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded">
      <span className={`text-xs font-bold ${method === 'POST' ? 'text-yellow-400' : 'text-green-400'}`}>{method}</span>
      <span className="text-gray-300">{path}</span>
      <CopyButton text={path} />
    </div>
  );
}

function Step({ num, title, children }: { num: number; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-6 h-6 rounded-full bg-pump-600 flex items-center justify-center text-xs font-bold text-white">{num}</div>
        <h4 className="text-sm font-semibold text-gray-200">{title}</h4>
      </div>
      {children}
    </div>
  );
}

