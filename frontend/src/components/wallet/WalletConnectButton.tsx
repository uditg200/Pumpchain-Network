import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

/**
 * Compact wallet connect button.
 */
export function WalletConnectButton() {
  return (
    <WalletMultiButton
      style={{
        backgroundColor: '#16a34a',
        borderRadius: '6px',
        fontSize: '12px',
        height: '32px',
        padding: '0 12px',
        lineHeight: '32px',
      }}
    />
  );
}
