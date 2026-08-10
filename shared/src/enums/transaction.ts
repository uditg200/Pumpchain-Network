export enum TransactionStatus {
  Pending = 'pending',
  Confirmed = 'confirmed',
  Failed = 'failed',
  Dropped = 'dropped',
}

export enum TransactionType {
  Transfer = 'transfer',
  BridgeDeposit = 'bridge_deposit',
  BridgeWithdraw = 'bridge_withdraw',
  ContractCall = 'contract_call',
  FaucetDrip = 'faucet_drip',
}
