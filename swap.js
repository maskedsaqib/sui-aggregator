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
const DEFAULT_GAS_BUDGET = 250_000_000; // 20M MIST for faster processing
const DEFAULT_SLIPPAGE = 0.05; // 5%
const SINGLE_SWAP_AMOUNT = 10; // 0.000001 SUI - increased for efficiency
const NUM_SWAPS = 80; // Increased number of swaps per transaction
const MIN_SUI_BALANCE = 0.001 * MIST_PER_SUI; // Minimum SUI to keep for gas (0.1 SUI)

// Helper function to format SUI amounts
const formatSuiAmount = (amount) => Number(amount) / MIST_PER_SUI;

// Check balance on-chain with caching
let cachedBalances = {};
const checkBalance = async (client, address, coinType) => {
    const cacheKey = `${address}-${coinType}`;
    try {
        if (cachedBalances[cacheKey] && Date.now() - cachedBalances[cacheKey].timestamp < 5000) {
            return cachedBalances[cacheKey].balance;
        }
        
        const { totalBalance } = await client.getBalance({
            owner: address,
            coinType
        });
        
        cachedBalances[cacheKey] = {
            balance: totalBalance,
            timestamp: Date.now()
        };
        
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
    // Add 20% buffer for faster processing
    return Math.ceil(
        (Number(computationCost) + Number(storageCost) + Number(storageRebate)) * 1.2
    );
};

const mainnetSwap = async () => {
    let iterationCount = 0;
    
    while (true) {
        try {
            console.log(`\n=== Starting iteration ${++iterationCount} ===`);
            
            // Mainnet RPC endpoints with faster timeout
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

            // Initialize clients with optimized settings
            const suiClient = new SuiClient({ 
                url: FULLNODE_RPC_URL,
                maxRetries: 5,
                timeout: 15000 // Reduced timeout
            });
            
            const aggregator = new AggregatorClient(
                AGGREGATOR_RPC_URL, 
                sender, 
                suiClient
            );

            // Mainnet token addresses (Verified)
            const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
            const USDT = "0xbc858cb910b9914bee64fff0f9b38855355a040c49155a17b265d9086d256545::but::BUT";

            // Check initial balances in parallel
            console.log("\nInitial Balances:");
            const [suiBalance, usdtBalance] = await Promise.all([
                checkBalance(suiClient, sender, SUI),
                checkBalance(suiClient, sender, USDT)
            ]);
            
            console.log(`SUI: ${formatSuiAmount(suiBalance)} SUI`);
            console.log(`USDT: ${usdtBalance} MIST`);

            if (suiBalance <= MIN_SUI_BALANCE) {
                console.log(`\nInsufficient SUI balance (${formatSuiAmount(suiBalance)} SUI) - stopping execution`);
                return;
            }

            // Calculate total swap amount
            const singleSwapAmount = new BN(SINGLE_SWAP_AMOUNT);
            const totalSwapAmount = singleSwapAmount.mul(new BN(NUM_SWAPS));
            
            if (totalSwapAmount.gt(new BN(suiBalance - MIN_SUI_BALANCE))) {
                throw new Error(`Insufficient SUI balance for ${NUM_SWAPS} swaps`);
            }

            // Find optimal swap route with higher amount
            const route = await aggregator.findRouters({
                from: SUI,
                target: USDT,
                amount: singleSwapAmount,
                byAmountIn: true,
            });

            if (!route?.routes?.length) {
                throw new Error("No viable swap routes found");
            }

            // Build optimized transaction with multiple swaps
            const txb = new Transaction();
            txb.setSender(sender);
            txb.setGasBudget(DEFAULT_GAS_BUDGET);

            // Add multiple swaps in parallel
            await Promise.all(Array(NUM_SWAPS).fill().map(() => 
                aggregator.fastRouterSwap({
                    routers: route.routes,
                    txb,
                    slippage: DEFAULT_SLIPPAGE,
                    byAmountIn: true
                })
            ));

            const builtTx = await txb.build({ client: suiClient });
            const simulation = await suiClient.dryRunTransactionBlock({
                transactionBlock: builtTx
            });

            await validateSimulation(simulation);
            const optimizedGasBudget = calculateGasBudget(simulation);
            txb.setGasBudget(optimizedGasBudget);

            // Execute swap with optimized options
            console.log("\nExecuting swap...");
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

            console.log(`Transaction successful!`);
            console.log(`Digest: ${result.digest}`);
            console.log(`Gas used: ${result.effects.gasUsed.computationCost} MIST`);

            // Check intermediate balances
            console.log("\nIntermediate Balances (After Buy):");
            const [intermediateBalance, usdtAfterBuy] = await Promise.all([
                checkBalance(suiClient, sender, SUI),
                checkBalance(suiClient, sender, USDT)
            ]);
            
            console.log(`SUI: ${formatSuiAmount(intermediateBalance)} SUI`);
            console.log(`USDT: ${usdtAfterBuy} MIST`);

            // Sell USDT back to SUI immediately
            console.log("\nSelling entire USDT balance back to SUI...");
            
            const sellRoute = await aggregator.findRouters({
                from: USDT,
                target: SUI,
                amount: new BN(usdtAfterBuy),
                byAmountIn: true,
            });

            if (!sellRoute?.routes?.length) {
                throw new Error("No viable routes found for selling USDT");
            }

            const sellTxb = new Transaction();
            sellTxb.setSender(sender);
            sellTxb.setGasBudget(DEFAULT_GAS_BUDGET);

            await aggregator.fastRouterSwap({
                routers: sellRoute.routes,
                txb: sellTxb,
                slippage: DEFAULT_SLIPPAGE,
                byAmountIn: true
            });

            const builtSellTx = await sellTxb.build({ client: suiClient });
            const sellSimulation = await suiClient.dryRunTransactionBlock({
                transactionBlock: builtSellTx
            });

            await validateSimulation(sellSimulation);
            const optimizedSellGasBudget = calculateGasBudget(sellSimulation);
            sellTxb.setGasBudget(optimizedSellGasBudget);

            console.log("\nExecuting sell transaction...");
            const sellResult = await suiClient.signAndExecuteTransaction({
                transaction: builtSellTx,
                signer: keypair,
                options: {
                    showEffects: true,
                    showBalanceChanges: true,
                    showObjectChanges: true
                }
            });

            if (sellResult.effects?.status?.status !== 'success') {
                throw new Error(`Sell transaction failed: ${sellResult.effects?.status?.error}`);
            }

            console.log(`Sell transaction successful!`);
            console.log(`Sell digest: ${sellResult.digest}`);
            console.log(`Gas used for sell: ${sellResult.effects.gasUsed.computationCost} MIST`);

            // Check final balances after sell
            console.log("\nFinal Balances (After Sell):");
            const [finalSuiBalance, finalUsdtBalance] = await Promise.all([
                checkBalance(suiClient, sender, SUI),
                checkBalance(suiClient, sender, USDT)
            ]);
            
            console.log(`SUI: ${formatSuiAmount(finalSuiBalance)} SUI`);
            console.log(`USDT: ${finalUsdtBalance} MIST`);
            
            const totalSuiDiff = formatSuiAmount(finalSuiBalance - suiBalance);
            const totalUsdtDiff = finalUsdtBalance - usdtBalance;
            console.log(`\nOverall Summary:`);
            console.log(`Net SUI change: ${totalSuiDiff}`);
            console.log(`Net USDT change: ${totalUsdtDiff}`);

            // Reduced delay between iterations
            await new Promise(resolve => setTimeout(resolve, 1000));

        } catch (error) {
            console.error(`Operation failed in iteration ${iterationCount}: ${error.message}`);
            // Reduced error wait time
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
};

// Execute with proper error handling
mainnetSwap().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
