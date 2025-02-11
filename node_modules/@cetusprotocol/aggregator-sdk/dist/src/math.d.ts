import BN from "bn.js";
import Decimal from "decimal.js";
export declare function CalculateAmountLimit(expectAmount: BN, byAmountIn: boolean, slippage: number): number;
export declare function CalculateAmountLimitBN(expectAmount: BN, byAmountIn: boolean, slippage: number): BN;
export declare function GetDefaultSqrtPriceLimit(a2b: boolean): BN;
export declare function sqrtPriceX64ToPrice(sqrtPriceStr: string, decimalsA: number, decimalsB: number): Decimal;
