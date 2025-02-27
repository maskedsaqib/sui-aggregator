import { AggregatorClient } from '@cetusprotocol/aggregator-sdk';
import BN from 'bn.js';
import dotenv from 'dotenv';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';

dotenv.config();

// Constants
const MIST_PER_SUI = 1e9;
const DEFAULT_GAS_BUDGET = 10_000_000; // 10M MIST
const DEFAULT_SLIPPAGE = 0.05; // 5%
const TRADE_AMOUNT_SUI = 1; // 1 SUI per trade
const NUM_TRADES = 10;

// Helper function to format SUI amounts
const formatSuiAmount = (amount) => Number(amount) / MIST_PER_SUI;

// Check balance on-chain
const checkBalance = async (client, address, coinType) => {
    try {
        const { totalBalance } = await client.getBalance({
            owner: address,
            coinType
        });
        return totalBalance;
    } catch (error) {
        console.error(`Error checking balance: ${error.message}`);
        throw error;
    }
};

const executeSwap = async (aggregator, suiClient, keypair, fromCoin, toCoin, amount) => {
    try {
        const sender = keypair.getPublicKey().toSuiAddress();
        
        // Get quote for the swap
        const quote = await aggregator.getQuotes({
            fromCoin,
            toCoin,
            amount: new BN(amount),
            slippage: DEFAULT_SLIPPAGE,
        });

        if (!quote?.routes?.length) {
            throw new Error('No routes found for swap');
        }

        // Use best route
        const bestRoute = quote.routes[0];
        
        // Build transaction
        const txb = await aggregator.createTransactionBlock(bestRoute);
        txb.setGasBudget(DEFAULT_GAS_BUDGET);
        
        // Simulate transaction
        const simulation = await suiClient.simulateTransaction({
            transaction: txb,
            sender
        });
        
        // Execute transaction
        const result = await suiClient.signAndExecuteTransactionBlock({
            transactionBlock: txb,
            signer: keypair,
            options: {
                showEvents: true,
                showEffects: true,
            },
        });

        return result;
    } catch (error) {
        console.error(`Swap failed: ${error.message}`);
        throw error;
    }
};

const volumeTrading = async () => {
    try {
        // Mainnet RPC endpoints
        const AGGREGATOR_RPC_URL = process.env.AGGREGATOR_RPC_URL_MAINNET;
        const FULLNODE_RPC_URL = process.env.FULLNODE_RPC_URL_MAINNET;
        
        if (!AGGREGATOR_RPC_URL || !FULLNODE_RPC_URL) {
            throw new Error("Mainnet RPC URLs must be set in .env");
        }

        // Setup clients and keypair
        const bech32PrivateKey = process.env.PRIVATE_KEY_BECH32;
        if (!bech32PrivateKey?.startsWith('suiprivkey1')) {
            throw new Error("Invalid bech32 private key format");
        }
        
        const { secretKey, schema } = decodeSuiPrivateKey(bech32PrivateKey);
        if (schema !== 'ED25519') {
            throw new Error(`Unsupported key schema: ${schema}`);
        }
        
        const keypair = Ed25519Keypair.fromSecretKey(secretKey);
        const sender = keypair.getPublicKey().toSuiAddress();
        
        const suiClient = new SuiClient({ 
            url: FULLNODE_RPC_URL,
            maxRetries: 3,
            timeout: 30000
        });
        
        const aggregator = new AggregatorClient(AGGREGATOR_RPC_URL, sender, suiClient);

        // Example token to trade with (USDC)
        const SUI_TYPE = "0x2::sui::SUI";
        const USDC_TYPE = "0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN"; // Example USDC address

        console.log(`Starting ${NUM_TRADES} volume trades...`);

        for (let i = 0; i < NUM_TRADES; i++) {
            console.log(`\nTrade ${i + 1}/${NUM_TRADES}`);
            
            // Buy USDC with SUI
            console.log('Buying USDC with SUI...');
            await executeSwap(
                aggregator,
                suiClient,
                keypair,
                SUI_TYPE,
                USDC_TYPE,
                TRADE_AMOUNT_SUI * MIST_PER_SUI
            );

            // Small delay between trades
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Sell USDC back to SUI
            console.log('Selling USDC back to SUI...');
            const usdcBalance = await checkBalance(suiClient, sender, USDC_TYPE);
            await executeSwap(
                aggregator,
                suiClient,
                keypair,
                USDC_TYPE,
                SUI_TYPE,
                usdcBalance
            );

            // Delay between trade pairs
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        console.log('\nVolume trading completed successfully!');

    } catch (error) {
        console.error('Volume trading failed:', error);
        throw error;
    }
};

// Execute the volume trading
volumeTrading().catch(console.error);
