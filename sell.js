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

// Validate transaction simulation
const validateSimulation = async (simulation) => {
    if (simulation.effects.status.status !== 'success') {
        throw new Error(`Simulation failed: ${simulation.effects.status.error}`);
    }
    return true;
};

// Calculate optimal gas budget based on simulation
const calculateGasBudget = (simulation) => {
    const { computationCost, storageCost, storageRebate } = simulation.effects.gasUsed;
    // Add 10% buffer to ensure transaction success
    return Math.ceil(
        (Number(computationCost) + Number(storageCost) + Number(storageRebate)) * 1.1
    );
};

// Get all token balances for an address
const getAllBalances = async (client, address) => {
    try {
        const { data: coins } = await client.getAllCoins({ owner: address });
        return coins.filter(coin => coin.balance > 0);
    } catch (error) {
        console.error(`Error getting all balances: ${error.message}`);
        throw error;
    }
};

const mainnetSwap = async () => {
    try {
        // Mainnet RPC endpoints
        const AGGREGATOR_RPC_URL = process.env.AGGREGATOR_RPC_URL_MAINNET;
        const FULLNODE_RPC_URL = process.env.FULLNODE_RPC_URL_MAINNET;
        
        if (!AGGREGATOR_RPC_URL || !FULLNODE_RPC_URL) {
            throw new Error("Mainnet RPC URLs must be set in .env");
        }

        // Decode and validate private key
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
        console.log(`\nSender Address: ${sender}`);

        // Initialize clients with retry mechanism
        const suiClient = new SuiClient({ 
            url: FULLNODE_RPC_URL,
            maxRetries: 3,
            timeout: 30000
        });
        
        const aggregator = new AggregatorClient(
            AGGREGATOR_RPC_URL, 
            sender, 
            suiClient
        );

        // Get all token balances
        const allCoins = await getAllBalances(suiClient, sender);
        console.log("\nFound tokens to sell:", allCoins.length);

        const SUI = "0x2::sui::SUI"; // Correct SUI token address
        
        // Process each token except SUI
        for (const coin of allCoins) {
            if (coin.coinType === SUI) continue; // Skip SUI token

            console.log(`\nProcessing ${coin.coinType}`);
            console.log(`Balance: ${coin.balance} MIST`);

            try {
                // Find optimal swap route
                const route = await aggregator.findRouters({
                    from: coin.coinType,
                    target: SUI,
                    amount: new BN(coin.balance),
                    byAmountIn: true,
                });

                if (!route?.routes?.length) {
                    console.log(`No viable swap routes found for ${coin.coinType}`);
                    continue;
                }

                // Build and simulate transaction
                const txb = new Transaction();
                txb.setSender(sender);
                txb.setGasBudget(DEFAULT_GAS_BUDGET);

                await aggregator.fastRouterSwap({
                    routers: route.routes,
                    txb,
                    slippage: DEFAULT_SLIPPAGE,
                    byAmountIn: true
                });

                const builtTx = await txb.build({ client: suiClient });
                const simulation = await suiClient.dryRunTransactionBlock({
                    transactionBlock: builtTx
                });

                // Validate simulation and update gas budget
                await validateSimulation(simulation);
                const optimizedGasBudget = calculateGasBudget(simulation);
                txb.setGasBudget(optimizedGasBudget);

                // Execute swap
                console.log(`Executing swap for ${coin.coinType}...`);
                const result = await suiClient.signAndExecuteTransaction({
                    transaction: builtTx,
                    signer: keypair,
                    options: {
                        showEffects: true,
                        showBalanceChanges: true,
                        showObjectChanges: true
                    }
                });

                if (result.effects?.status?.status !== 'success') {
                    throw new Error(`Transaction failed: ${result.effects?.status?.error}`);
                }

                console.log(`Swap successful for ${coin.coinType}`);
                console.log(`Digest: ${result.digest}`);
                console.log(`Gas used: ${result.effects.gasUsed.computationCost} MIST`);

            } catch (error) {
                console.error(`Failed to swap ${coin.coinType}: ${error.message}`);
                continue; // Continue with next token even if this one fails
            }
        }

        // Show final SUI balance
        const finalSuiBalance = await checkBalance(suiClient, sender, SUI);
        console.log(`\nFinal SUI Balance: ${formatSuiAmount(finalSuiBalance)} SUI`);

    } catch (error) {
        console.error(`Swap failed: ${error.message}`);
        throw error;
    }
};

// Execute with proper error handling
mainnetSwap().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
