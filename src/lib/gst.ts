import Decimal from "decimal.js";
import { INDIAN_STATE_CODES } from "@/types";

// Configure Decimal for financial precision (28 digits precision, standard half-up rounding)
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

// Official 15-character Indian GSTIN regular expression
const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

export interface GstinValidationResult {
  isValid: boolean;
  gstin: string;
  stateCode?: string;
  stateName?: string;
  pan?: string;
  entityNumber?: string;
  error?: string;
}

export type SupplyType = "INTRA_STATE" | "INTER_STATE";

export interface GstTaxBreakdown {
  taxableAmount: number;
  gstRate: number;
  isInterState: boolean;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalTax: number;
  grandTotal: number;
}

/**
 * Validates the structural format and state code of an Indian GSTIN.
 *
 * NOTE ON STATUTORY COMPLIANCE:
 * This validator performs syntax, structure, state code, and PAN pattern verification
 * as specified by the GST Council. It does NOT claim live GSTN portal verification
 * or government statutory certification without real-time GSP API connectivity.
 */
export function validateGstin(rawGstin: string): GstinValidationResult {
  if (!rawGstin || typeof rawGstin !== "string") {
    return { isValid: false, gstin: "", error: "GSTIN string cannot be empty." };
  }

  const gstin = rawGstin.trim().toUpperCase();

  if (gstin.length !== 15) {
    return {
      isValid: false,
      gstin,
      error: `GSTIN must be exactly 15 characters long (received ${gstin.length}).`,
    };
  }

  if (!GSTIN_REGEX.test(gstin)) {
    return {
      isValid: false,
      gstin,
      error: "Invalid GSTIN format. Expected: 2 state digits + 10-char PAN + 1 entity char + 'Z' + 1 check digit.",
    };
  }

  const stateCode = gstin.substring(0, 2);
  const stateName = INDIAN_STATE_CODES[stateCode];

  if (!stateName) {
    return {
      isValid: false,
      gstin,
      stateCode,
      error: `Unrecognized Indian State Code '${stateCode}'. Must be a valid 2-digit state identifier.`,
    };
  }

  const pan = gstin.substring(2, 12);
  const entityNumber = gstin.substring(12, 13);

  return {
    isValid: true,
    gstin,
    stateCode,
    stateName,
    pan,
    entityNumber,
  };
}

/**
 * Determines whether a transaction is Intra-state (CGST + SGST) or Inter-state (IGST)
 * based on Supplier Place of Origin and Place of Supply (POS).
 */
export function determineSupplyType(
  supplierStateCode: string,
  placeOfSupplyStateCode: string
): SupplyType {
  const normSupplier = supplierStateCode.trim().padStart(2, "0");
  const normPos = placeOfSupplyStateCode.trim().padStart(2, "0");

  return normSupplier === normPos ? "INTRA_STATE" : "INTER_STATE";
}

export interface CalculateGstOptions {
  amount: number | string | Decimal;
  gstRate: number; // e.g. 0, 5, 12, 18, 28
  isInterState: boolean;
}

/**
 * Calculates GST when tax is EXCLUSIVE (i.e. amount represents taxable base).
 * Uses Decimal arithmetic with standard 2-decimal half-up rounding.
 */
export function calculateGstExclusive(options: CalculateGstOptions): GstTaxBreakdown {
  const { amount, gstRate, isInterState } = options;

  const dTaxable = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const dRate = new Decimal(gstRate);

  if (isInterState) {
    // Inter-State: IGST applies fully
    const igstAmount = dTaxable.times(dRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalTax = igstAmount;
    const grandTotal = dTaxable.plus(totalTax).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      taxableAmount: dTaxable.toNumber(),
      gstRate,
      isInterState: true,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: gstRate,
      igstAmount: igstAmount.toNumber(),
      totalTax: totalTax.toNumber(),
      grandTotal: grandTotal.toNumber(),
    };
  } else {
    // Intra-State: Split equally between CGST and SGST
    const halfRate = dRate.dividedBy(2);
    const cgstAmount = dTaxable.times(halfRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const sgstAmount = dTaxable.times(halfRate).dividedBy(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const totalTax = cgstAmount.plus(sgstAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grandTotal = dTaxable.plus(totalTax).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      taxableAmount: dTaxable.toNumber(),
      gstRate,
      isInterState: false,
      cgstRate: halfRate.toNumber(),
      cgstAmount: cgstAmount.toNumber(),
      sgstRate: halfRate.toNumber(),
      sgstAmount: sgstAmount.toNumber(),
      igstRate: 0,
      igstAmount: 0,
      totalTax: totalTax.toNumber(),
      grandTotal: grandTotal.toNumber(),
    };
  }
}

/**
 * Calculates GST when tax is INCLUSIVE (i.e. gross amount already contains GST).
 * Reverse calculates taxable base and extracts CGST/SGST or IGST components.
 */
export function calculateGstInclusive(options: CalculateGstOptions): GstTaxBreakdown {
  const { amount, gstRate, isInterState } = options;

  const dTotal = new Decimal(amount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const dRate = new Decimal(gstRate);

  // Taxable Amount = Total / (1 + Rate / 100)
  const divisor = new Decimal(1).plus(dRate.dividedBy(100));
  const dTaxable = dTotal.dividedBy(divisor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const totalTax = dTotal.minus(dTaxable).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  if (isInterState) {
    return {
      taxableAmount: dTaxable.toNumber(),
      gstRate,
      isInterState: true,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: gstRate,
      igstAmount: totalTax.toNumber(),
      totalTax: totalTax.toNumber(),
      grandTotal: dTotal.toNumber(),
    };
  } else {
    // Split total tax into CGST and SGST
    const halfRate = dRate.dividedBy(2);
    const cgstAmount = totalTax.dividedBy(2).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const sgstAmount = totalTax.minus(cgstAmount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    return {
      taxableAmount: dTaxable.toNumber(),
      gstRate,
      isInterState: false,
      cgstRate: halfRate.toNumber(),
      cgstAmount: cgstAmount.toNumber(),
      sgstRate: halfRate.toNumber(),
      sgstAmount: sgstAmount.toNumber(),
      igstRate: 0,
      igstAmount: 0,
      totalTax: totalTax.toNumber(),
      grandTotal: dTotal.toNumber(),
    };
  }
}
