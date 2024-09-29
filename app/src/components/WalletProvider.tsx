import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";
import React from "react";
import { useMemo } from "react";
import "@solana/wallet-adapter-react-ui/styles.css";
import {
	PhantomWalletAdapter,
	CoinbaseWalletAdapter,
	TrustWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";

const NETWORK = WalletAdapterNetwork.Devnet;

export default function AppWalletProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const endpoint = useMemo(() => clusterApiUrl(NETWORK), []);
	const wallets = useMemo(
		() => {
			return [
				new PhantomWalletAdapter(),
				new TrustWalletAdapter(),
				new CoinbaseWalletAdapter(),
			]
		},
		[],
	);

	return (
		<ConnectionProvider endpoint={endpoint}>
			<WalletProvider wallets={wallets} autoConnect>
				{children}
			</WalletProvider>
		</ConnectionProvider>
	);
}
