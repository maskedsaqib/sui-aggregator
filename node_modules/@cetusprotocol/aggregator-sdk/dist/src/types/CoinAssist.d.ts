import type { SuiMoveObject } from '@mysten/sui/client';
import type { CoinAsset, SuiAddress } from './sui';
export declare const DEFAULT_GAS_BUDGET_FOR_SPLIT = 1000;
export declare const DEFAULT_GAS_BUDGET_FOR_MERGE = 500;
export declare const DEFAULT_GAS_BUDGET_FOR_TRANSFER = 100;
export declare const DEFAULT_GAS_BUDGET_FOR_TRANSFER_SUI = 100;
export declare const DEFAULT_GAS_BUDGET_FOR_STAKE = 1000;
export declare const GAS_TYPE_ARG = "0x2::sui::SUI";
export declare const GAS_TYPE_ARG_LONG = "0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI";
export declare const GAS_SYMBOL = "SUI";
export declare const DEFAULT_NFT_TRANSFER_GAS_FEE = 450;
export declare const SUI_SYSTEM_STATE_OBJECT_ID = "0x0000000000000000000000000000000000000005";
/**
 * This class provides helper methods for working with coins.
 */
export declare class CoinUtils {
    /**
     * Get the coin type argument from a SuiMoveObject.
     *
     * @param obj The SuiMoveObject to get the coin type argument from.
     * @returns The coin type argument, or null if it is not found.
     */
    static getCoinTypeArg(obj: SuiMoveObject): string | null;
    /**
     * Get whether a SuiMoveObject is a SUI coin.
     *
     * @param obj The SuiMoveObject to check.
     * @returns Whether the SuiMoveObject is a SUI coin.
     */
    static isSUI(obj: SuiMoveObject): boolean;
    /**
     * Get the coin symbol from a coin type argument.
     *
     * @param coinTypeArg The coin type argument to get the symbol from.
     * @returns The coin symbol.
     */
    static getCoinSymbol(coinTypeArg: string): string;
    /**
     * Get the balance of a SuiMoveObject.
     *
     * @param obj The SuiMoveObject to get the balance from.
     * @returns The balance of the SuiMoveObject.
     */
    static getBalance(obj: SuiMoveObject): bigint;
    /**
     * Get the total balance of a list of CoinAsset objects for a given coin address.
     *
     * @param objs The list of CoinAsset objects to get the total balance for.
     * @param coinAddress The coin address to get the total balance for.
     * @returns The total balance of the CoinAsset objects for the given coin address.
     */
    static totalBalance(objs: CoinAsset[], coinAddress: SuiAddress): bigint;
    /**
     * Get the ID of a SuiMoveObject.
     *
     * @param obj The SuiMoveObject to get the ID from.
     * @returns The ID of the SuiMoveObject.
     */
    static getID(obj: SuiMoveObject): string;
    /**
     * Get the coin type from a coin type argument.
     *
     * @param coinTypeArg The coin type argument to get the coin type from.
     * @returns The coin type.
     */
    static getCoinTypeFromArg(coinTypeArg: string): string;
    /**
     * Get the CoinAsset objects for a given coin type.
     *
     * @param coinType The coin type to get the CoinAsset objects for.
     * @param allSuiObjects The list of all SuiMoveObjects.
     * @returns The CoinAsset objects for the given coin type.
     */
    static getCoinAssets(coinType: string, allSuiObjects: CoinAsset[]): CoinAsset[];
    /**
     * Get whether a coin address is a SUI coin.
     *
     * @param coinAddress The coin address to check.
     * @returns Whether the coin address is a SUI coin.
     */
    static isSuiCoin(coinAddress: SuiAddress): boolean;
    /**
     * Select the CoinAsset objects from a list of CoinAsset objects that have a balance greater than or equal to a given amount.
     *
     * @param coins The list of CoinAsset objects to select from.
     * @param amount The amount to select CoinAsset objects with a balance greater than or equal to.
     * @param exclude A list of CoinAsset objects to exclude from the selection.
     * @returns The CoinAsset objects that have a balance greater than or equal to the given amount.
     */
    static selectCoinObjectIdGreaterThanOrEqual(coins: CoinAsset[], amount: bigint, exclude?: string[]): {
        objectArray: string[];
        remainCoins: CoinAsset[];
        amountArray: string[];
    };
    /**
     * Select the CoinAsset objects from a list of CoinAsset objects that have a balance greater than or equal to a given amount.
     *
     * @param coins The list of CoinAsset objects to select from.
     * @param amount The amount to select CoinAsset objects with a balance greater than or equal to.
     * @param exclude A list of CoinAsset objects to exclude from the selection.
     * @returns The CoinAsset objects that have a balance greater than or equal to the given amount.
     */
    static selectCoinAssetGreaterThanOrEqual(coins: CoinAsset[], amount: bigint, exclude?: string[]): {
        selectedCoins: CoinAsset[];
        remainingCoins: CoinAsset[];
    };
    /**
     * Sort the CoinAsset objects by their balance.
     *
     * @param coins The CoinAsset objects to sort.
     * @returns The sorted CoinAsset objects.
     */
    static sortByBalance(coins: CoinAsset[]): CoinAsset[];
    static sortByBalanceDes(coins: CoinAsset[]): CoinAsset[];
    /**
     * Calculate the total balance of a list of CoinAsset objects.
     *
     * @param coins The list of CoinAsset objects to calculate the total balance for.
     * @returns The total balance of the CoinAsset objects.
     */
    static calculateTotalBalance(coins: CoinAsset[]): bigint;
}
