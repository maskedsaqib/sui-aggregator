import { CoinAsset } from "../types/sui";
import { Transaction, TransactionObjectArgument } from "@mysten/sui/transactions";
export declare function completionCoin(s: string): string;
export declare function compareCoins(coinA: string, coinB: string): boolean;
export declare function mintZeroCoin(txb: Transaction, coinType: string): TransactionObjectArgument;
export type BuildCoinResult = {
    targetCoin: TransactionObjectArgument;
    isMintZeroCoin: boolean;
    targetCoinAmount: number;
};
export declare function buildInputCoin(txb: Transaction, allCoins: CoinAsset[], amount: bigint, coinType: string): BuildCoinResult;
