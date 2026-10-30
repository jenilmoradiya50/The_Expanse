import test from "node:test";
import assert from "node:assert/strict";
import {
  validateGstin,
  determineSupplyType,
  calculateGstExclusive,
  calculateGstInclusive,
} from "../src/lib/gst";

test("GST - Valid GSTIN Formats", () => {
  const gujaratGstin = "24AAAAA0000A1Z5";
  const maharashtraGstin = "27AABCA1234F1Z8";
  const delhiGstin = "07AAAAA0000A1Z2";

  const resGujarat = validateGstin(gujaratGstin);
  assert.equal(resGujarat.isValid, true);
  assert.equal(resGujarat.stateCode, "24");
  assert.equal(resGujarat.stateName, "Gujarat");
  assert.equal(resGujarat.pan, "AAAAA0000A");

  const resMh = validateGstin(maharashtraGstin);
  assert.equal(resMh.isValid, true);
  assert.equal(resMh.stateCode, "27");
  assert.equal(resMh.stateName, "Maharashtra");
  assert.equal(resMh.pan, "AABCA1234F");

  const resDelhi = validateGstin(delhiGstin);
  assert.equal(resDelhi.isValid, true);
  assert.equal(resDelhi.stateCode, "07");
  assert.equal(resDelhi.stateName, "Delhi");
});

test("GST - Invalid GSTIN Rejections", () => {
  // Empty
  assert.equal(validateGstin("").isValid, false);

  // Incorrect length
  assert.equal(validateGstin("24AAAAA0000A1Z").isValid, false);
  assert.equal(validateGstin("24AAAAA0000A1Z55").isValid, false);

  // Invalid state code
  const invalidState = validateGstin("99AAAAA0000A1Z5");
  assert.equal(invalidState.isValid, false);
  assert.match(invalidState.error!, /Unrecognized Indian State Code '99'/);

  // Invalid PAN structure inside GSTIN
  assert.equal(validateGstin("2412345678901Z5").isValid, false);
});

test("GST - Intra vs Inter State Supply Determination", () => {
  // Same state: Gujarat to Gujarat
  assert.equal(determineSupplyType("24", "24"), "INTRA_STATE");

  // With leading zeroes or spacing
  assert.equal(determineSupplyType(" 7 ", "07"), "INTRA_STATE");

  // Different states: Gujarat to Maharashtra
  assert.equal(determineSupplyType("24", "27"), "INTER_STATE");

  // Delhi to Karnataka
  assert.equal(determineSupplyType("07", "29"), "INTER_STATE");
});

test("GST - Exclusive Tax Calculations (Standard Values)", () => {
  // Intra-State: ₹10,000 @ 18%
  const intra = calculateGstExclusive({
    amount: 10000,
    gstRate: 18,
    isInterState: false,
  });

  assert.equal(intra.taxableAmount, 10000);
  assert.equal(intra.isInterState, false);
  assert.equal(intra.cgstRate, 9);
  assert.equal(intra.cgstAmount, 900);
  assert.equal(intra.sgstRate, 9);
  assert.equal(intra.sgstAmount, 900);
  assert.equal(intra.igstRate, 0);
  assert.equal(intra.igstAmount, 0);
  assert.equal(intra.totalTax, 1800);
  assert.equal(intra.grandTotal, 11800);

  // Inter-State: ₹10,000 @ 18%
  const inter = calculateGstExclusive({
    amount: 10000,
    gstRate: 18,
    isInterState: true,
  });

  assert.equal(inter.taxableAmount, 10000);
  assert.equal(inter.isInterState, true);
  assert.equal(inter.cgstAmount, 0);
  assert.equal(inter.sgstAmount, 0);
  assert.equal(inter.igstRate, 18);
  assert.equal(inter.igstAmount, 1800);
  assert.equal(inter.totalTax, 1800);
  assert.equal(inter.grandTotal, 11800);
});

test("GST - Exclusive Tax Decimal Precision & Half-Up Rounding", () => {
  // Odd amount: ₹149.99 @ 5% Intra-state
  // CGST: 149.99 * 0.025 = 3.74975 => 3.75
  // SGST: 149.99 * 0.025 = 3.74975 => 3.75
  // Total Tax: 7.50, Grand Total: 157.49
  const res = calculateGstExclusive({
    amount: 149.99,
    gstRate: 5,
    isInterState: false,
  });

  assert.equal(res.taxableAmount, 149.99);
  assert.equal(res.cgstAmount, 3.75);
  assert.equal(res.sgstAmount, 3.75);
  assert.equal(res.totalTax, 7.5);
  assert.equal(res.grandTotal, 157.49);
});

test("GST - Inclusive Tax Calculations (Back-Calculation)", () => {
  // Inclusive: ₹11,800 gross @ 18% Intra-state
  // Taxable Base = 11800 / 1.18 = 10,000
  // Tax = 1,800 (CGST 900, SGST 900)
  const intra = calculateGstInclusive({
    amount: 11800,
    gstRate: 18,
    isInterState: false,
  });

  assert.equal(intra.taxableAmount, 10000);
  assert.equal(intra.cgstAmount, 900);
  assert.equal(intra.sgstAmount, 900);
  assert.equal(intra.totalTax, 1800);
  assert.equal(intra.grandTotal, 11800);

  // Inclusive Inter-State: ₹11,800 gross @ 18%
  const inter = calculateGstInclusive({
    amount: 11800,
    gstRate: 18,
    isInterState: true,
  });

  assert.equal(inter.taxableAmount, 10000);
  assert.equal(inter.igstAmount, 1800);
  assert.equal(inter.totalTax, 1800);
  assert.equal(inter.grandTotal, 11800);
});
