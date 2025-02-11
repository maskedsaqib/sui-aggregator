// Instructions:		
// 1. Install dependencies: npm install @cetusprotocol/aggregator-sdk bn.js dotenv @mysten/sui
// 2. Create a .env file in your project root (see below)
// 3. Run the script with: npx ts-node aggregator.ts (or compile with tsc and run with node)

import { AggregatorClient } from '@cetusprotocol/aggregator-sdk';
import BN from 'bn.js';
import * as dotenv from 'dotenv';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { fromB64 } from '@mysten/sui/utils';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

dotenv.config();

// ...existing code or configuration if any...

async function checkBalance(client: SuiClient, address: string, coinType: string) {
	const { totalBalance } = await client.getBalance({
		owner: address,
		coinType
	});
	return totalBalance;
}

async function mainnetSwap() {
	// Mainnet RPC endpoints
	const AGGREGATOR_RPC_URL = process.env.AGGREGATOR_RPC_URL_MAINNET;
	const FULLNODE_RPC_URL = process.env.FULLNODE_RPC_URL_MAINNET;
	
	if (!AGGREGATOR_RPC_URL || !FULLNODE_RPC_URL) {
		throw new Error("Mainnet RPC URLs must be set in .env");
	}

	// Decode bech32 private key (suiprivkey...)
	const bech32PrivateKey = process.env.PRIVATE_KEY_BECH32;
	if (!bech32PrivateKey?.startsWith('suiprivkey1')) {
		throw new Error("Invalid bech32 private key format");
	}
	
	// Extract base64 payload after the '1' separator
	const [, base64Payload] = bech32PrivateKey.split('1');
	const { secretKey, schema } = decodeSuiPrivateKey(bech32PrivateKey);
	if (schema !== 'ED25519') {
		throw new Error(`Unsupported key schema: ${schema}`);
	}
	
	const keypair = Ed25519Keypair.fromSecretKey(secretKey);

	const sender = keypair.getPublicKey().toSuiAddress();
	console.log(`Mainnet Sender Address: ${sender}`);

	// Initialize clients
	const aggregator = new AggregatorClient(AGGREGATOR_RPC_URL, sender, new SuiClient({ url: FULLNODE_RPC_URL }));
	const suiClient = new SuiClient({ url: FULLNODE_RPC_URL });

	// Mainnet token addresses (Verified)
	const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
	const USDT = "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN";

	// Add balance checks before swap
	console.log("Checking balances...");
	const suiBalance = await checkBalance(suiClient, sender, SUI);
	const usdtBalance = await checkBalance(suiClient, sender, USDT);
	console.log(`SUI Balance: ${suiBalance} MIST (${Number(suiBalance)/1e9} SUI)`);
	console.log(`USDT Balance: ${usdtBalance} MIST`);

	// Try with different provider combination
	const route = await aggregator.findRouters({
		from: SUI,
		target: USDT,
		amount: new BN(1000000000),
		byAmountIn: true,
	});

	if (!route?.routes?.length) {
		throw new Error("No routes found - try different token pair");
	}

	// Build transaction
	const txb = new Transaction();
	txb.setSender(sender);
	txb.setGasBudget(10000000); // 10M MIST

	await aggregator.fastRouterSwap({
		routers: route.routes,
		txb,
		slippage: 0.05,
		byAmountIn: true
	});

	// Add swap simulation before execution
	const builtTx = await txb.build({ client: suiClient });
	const simulation = await suiClient.dryRunTransactionBlock({
		transactionBlock: builtTx
	});
	console.log("Transaction Simulation:", JSON.stringify(simulation, null, 2));

	// Update gas budget calculation
	txb.setGasBudget(
		Number(simulation.effects.gasUsed.computationCost) + 
		Number(simulation.effects.gasUsed.storageCost) + 
		Number(simulation.effects.gasUsed.storageRebate)
	);

	// Execute transaction
	const result = await suiClient.signAndExecuteTransaction({
		transaction: builtTx,
		signer: keypair,
		options: {
			showEffects: true,
			showBalanceChanges: true
		}
	});

	console.log("Mainnet Swap Successful:", result);

	// After executing the swap
	console.log("Checking post-swap balances...");
	const newSuiBalance = await checkBalance(suiClient, sender, SUI);
	const newUsdtBalance = await checkBalance(suiClient, sender, USDT);
	console.log(`New SUI Balance: ${newSuiBalance} MIST`);
	console.log(`New USDT Balance: ${newUsdtBalance} MIST`);
}

mainnetSwap().catch(console.error);
