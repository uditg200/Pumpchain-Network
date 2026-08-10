export interface SolanaConnectionStatus {
  connected: boolean;
  cluster: string;
  slotHeight: number | null;
  latency: number | null;
}
