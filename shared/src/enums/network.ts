export enum NetworkStatus {
  Online = 'online',
  Degraded = 'degraded',
  Offline = 'offline',
  Syncing = 'syncing',
}

export enum NodeRole {
  Sequencer = 'sequencer',
  Validator = 'validator',
  FullNode = 'full_node',
}

export enum BridgeDirection {
  Deposit = 'deposit', // Solana -> Pumpchain
  Withdraw = 'withdraw', // Pumpchain -> Solana
}

export enum BridgeStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Finalized = 'finalized',
  Failed = 'failed',
}
