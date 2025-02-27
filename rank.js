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
const DEFAULT_GAS_BUDGET = 110_000_000; // 110M MIST for faster processing
const DEFAULT_SLIPPAGE = 0.05; // 5%
const SINGLE_SWAP_AMOUNT = 10; // 0.000001 SUI
const GAS_TRANSFER_AMOUNT = 0.002 * MIST_PER_SUI; // 0.002 SUI for gas
const MIN_MAIN_WALLET_BALANCE = 0.01 * MIST_PER_SUI; // Minimum SUI to keep in main wallet (0.01 SUI)

// Helper function to format SUI amounts
const formatSuiAmount = (amount) => Number(amount) / MIST_PER_SUI;

// Generate a new wallet
const generateNewWallet = () => {
    const keypair = Ed25519Keypair.generate();
    return {
        keypair,
        address: keypair.getPublicKey().toSuiAddress()
    };
};

// Transfer SUI to new wallet
const transferGasToNewWallet = async (suiClient, mainKeypair, recipientAddress, amount) => {
    const txb = new Transaction();
    txb.setSender(mainKeypair.getPublicKey().toSuiAddress());
    txb.setGasBudget(50_000_000); // 50M MIST for transfer

    // Add transfer operation
    const [coin] = await suiClient.getCoins({
        owner: mainKeypair.getPublicKey().toSuiAddress(),
        coinType: '0x2::sui::SUI'
    });

    txb.splitCoins(coin.coinObjectId, [amount]);
    txb.transferObjects([txb.object(txb.pure(amount))], txb.pure(recipientAddress));

    // Execute transfer
    const transferResult = await suiClient.signAndExecuteTransaction({
        transaction: await txb.build({ client: suiClient }),
        signer: mainKeypair,
        options: { showEffects: true }
    });

    if (transferResult.effects?.status?.status !== 'success') {
        throw new Error(`Transfer failed: ${transferResult.effects?.status?.error}`);
    }

    return transferResult;
};

// Check balance with caching
let cachedBalances = {};
const checkBalance = async (client, address, coinType) => {
    const cacheKey = `${address}-${coinType}`;
    try {
        if (cachedBalances[cacheKey] && Date.now() - cachedBalances[cacheKey].timestamp < 2000) {
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

// Execute swap from new wallet
const executeSwap = async (suiClient, aggregator, wallet, fromToken, toToken, amount) => {
    try {
        const route = await aggregator.findRouters({
            from: fromToken,
            target: toToken,
            amount: new BN(amount),
            byAmountIn: true,
        });

        if (!route?.routes?.length) {
            throw new Error("No viable swap routes found");
        }

        const txb = new Transaction();
        txb.setSender(wallet.address);
        txb.setGasBudget(DEFAULT_GAS_BUDGET);

        await aggregator.fastRouterSwap({
            routers: route.routes,
            txb,
            slippage: DEFAULT_SLIPPAGE,
            byAmountIn: true
        });

        const builtTx = await txb.build({ client: suiClient });
        const result = await suiClient.signAndExecuteTransaction({
            transaction: builtTx,
            signer: wallet.keypair,
            options: {
                showEffects: true,
                showBalanceChanges: true
            }
        });

        if (result.effects?.status?.status !== 'success') {
            throw new Error(`Swap failed: ${result.effects?.status?.error}`);
        }

        return result;
    } catch (error) {
        throw new Error(`Swap execution failed: ${error.message}`);
    }
};

const rankSwap = async () => {
    let iterationCount = 0;
    const processedWallets = new Set();
    
    while (true) {
        try {
            console.log(`\n=== Starting iteration ${++iterationCount} ===`);
            
            // Setup RPC endpoints
            const AGGREGATOR_RPC_URL = process.env.AGGREGATOR_RPC_URL_MAINNET;
            const FULLNODE_RPC_URL = process.env.FULLNODE_RPC_URL_MAINNET;
            
            if (!AGGREGATOR_RPC_URL || !FULLNODE_RPC_URL) {
                throw new Error("Mainnet RPC URLs must be set in .env");
            }

            // Initialize main wallet
            const bech32PrivateKey = process.env.PRIVATE_KEY_BECH32;
            if (!bech32PrivateKey?.startsWith('suiprivkey1')) {
                throw new Error("Invalid bech32 private key format");
            }
            
            const { secretKey, schema } = decodeSuiPrivateKey(bech32PrivateKey);
            if (schema !== 'ED25519') {
                throw new Error(`Unsupported key schema: ${schema}`);
            }
            
            const mainKeypair = Ed25519Keypair.fromSecretKey(secretKey);
            const mainAddress = mainKeypair.getPublicKey().toSuiAddress();

            // Initialize clients
            const suiClient = new SuiClient({ 
                url: FULLNODE_RPC_URL,
                maxRetries: 5,
                timeout: 15000
            });

            // Check main wallet balance
            const mainBalance = await checkBalance(suiClient, mainAddress, '0x2::sui::SUI');
            if (mainBalance <= MIN_MAIN_WALLET_BALANCE) {
                throw new Error(`Insufficient balance in main wallet: ${formatSuiAmount(mainBalance)} SUI`);
            }

            // Generate new wallet
            const newWallet = generateNewWallet();
            if (processedWallets.has(newWallet.address)) {
                console.log('Wallet already used, generating new one...');
                continue;
            }
            processedWallets.add(newWallet.address);

            console.log(`\nGenerated new wallet: ${newWallet.address}`);

            // Transfer gas to new wallet
            console.log('Transferring gas to new wallet...');
            await transferGasToNewWallet(suiClient, mainKeypair, newWallet.address, GAS_TRANSFER_AMOUNT);

            // Initialize aggregator with new wallet
            const aggregator = new AggregatorClient(
                AGGREGATOR_RPC_URL,
                newWallet.address,
                suiClient
            );

            // Token addresses
            const SUI = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
            const USDT = "0x7bf4c6013b747eea7a0db8cfa6fc7a841075e341f220ef64fe3306b8b854b57d::dogiz::DOGIZ";

            // Execute swap from new wallet
            console.log('Executing swap from new wallet...');
            const swapResult = await executeSwap(
                suiClient,
                aggregator,
                newWallet,
                SUI,
                USDT,
                SINGLE_SWAP_AMOUNT
            );

            console.log(`Swap successful! Digest: ${swapResult.digest}`);
            console.log(`Gas used: ${swapResult.effects.gasUsed.computationCost} MIST`);

            // Minimal delay between iterations
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`Operation failed in iteration ${iterationCount}: ${error.message}`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
};

// Execute with proper error handling
rankSwap().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
}); 