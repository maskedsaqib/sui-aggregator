import type { SuiAddress, SuiStructTag } from '../types/sui';
export declare function isSortedSymbols(symbolX: string, symbolY: string): boolean;
export declare function composeType(address: string, generics: SuiAddress[]): SuiAddress;
export declare function composeType(address: string, struct: string, generics?: SuiAddress[]): SuiAddress;
export declare function composeType(address: string, module: string, struct: string, generics?: SuiAddress[]): SuiAddress;
export declare function extractAddressFromType(type: string): string;
export declare function extractStructTagFromType(type: string): SuiStructTag;
export declare function normalizeCoinType(coinType: string): string;
export declare function fixSuiObjectId(value: string): string;
/**
 * Recursively traverses the given data object and patches any string values that represent Sui object IDs.
 *
 * @param {any} data - The data object to be patched.
 */
export declare function patchFixSuiObjectId(data: any): void;
export declare function createTarget(packageName: string, moduleName: string, functionName: string): `${string}::${string}::${string}`;
