import { Transaction } from "@mysten/sui/transactions";
export declare function printTransaction(tx: Transaction, isPrint?: boolean): Promise<void>;
export declare function checkInvalidSuiAddress(address: string): boolean;
