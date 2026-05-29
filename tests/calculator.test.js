const assert = require("node:assert/strict");
const calculator = require("../js/calculator.js");

const taxableOptions = {
  taxMode: "taxable",
  buyerFeeRate: 0.055,
  sellerFeeRate: 0.22,
  taxRate: 0.1,
  roundingMode: "round"
};

const noTaxOptions = {
  ...taxableOptions,
  taxMode: "none"
};

function pickResult(result) {
  return {
    estimateAmount: result.estimateAmount,
    taxAmount: result.taxAmount,
    feeBaseAmount: result.feeBaseAmount,
    buyerFee: result.buyerFee,
    buyerTotal: result.buyerTotal,
    sellerFee: result.sellerFee,
    sellerNet: result.sellerNet
  };
}

const cases = [
  {
    name: "見積額50,000円 / 消費税あり",
    actual: calculator.calcFromEstimate(50000, taxableOptions),
    expected: {
      estimateAmount: 50000,
      taxAmount: 5000,
      feeBaseAmount: 55000,
      buyerFee: 3025,
      buyerTotal: 58025,
      sellerFee: 12100,
      sellerNet: 42900
    }
  },
  {
    name: "見積額50,000円 / 消費税なし",
    actual: calculator.calcFromEstimate(50000, noTaxOptions),
    expected: {
      estimateAmount: 50000,
      taxAmount: 0,
      feeBaseAmount: 50000,
      buyerFee: 2750,
      buyerTotal: 52750,
      sellerFee: 11000,
      sellerNet: 39000
    }
  },
  {
    name: "お客様支払上限200,000円 / 消費税あり",
    actual: calculator.calcFromBudget(200000, taxableOptions),
    expected: {
      estimateAmount: 172339,
      taxAmount: 17234,
      feeBaseAmount: 189573,
      buyerFee: 10427,
      buyerTotal: 200000,
      sellerFee: 41706,
      sellerNet: 147867
    }
  },
  {
    name: "お客様支払上限200,000円 / 消費税なし",
    actual: calculator.calcFromBudget(200000, noTaxOptions),
    expected: {
      estimateAmount: 189573,
      taxAmount: 0,
      feeBaseAmount: 189573,
      buyerFee: 10427,
      buyerTotal: 200000,
      sellerFee: 41706,
      sellerNet: 147867
    }
  }
];

for (const testCase of cases) {
  assert.deepEqual(pickResult(testCase.actual), testCase.expected, testCase.name);
  console.log(`${testCase.name}: OK`);
}
