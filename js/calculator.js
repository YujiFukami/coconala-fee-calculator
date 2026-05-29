(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.CoconalaCalculator = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const DEFAULT_OPTIONS = {
    taxMode: "taxable",
    buyerFeeRate: 0.055,
    sellerFeeRate: 0.22,
    taxRate: 0.1,
    roundingMode: "round"
  };

  function normalizeOptions(options) {
    return Object.assign({}, DEFAULT_OPTIONS, options || {});
  }

  function roundByMode(value, mode) {
    if (mode === "floor") return Math.floor(value);
    if (mode === "ceil") return Math.ceil(value);
    return Math.round(value);
  }

  function toNonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.floor(number);
  }

  function calcFromEstimate(estimateAmount, options) {
    const opts = normalizeOptions(options);
    const estimate = toNonNegativeInteger(estimateAmount);
    const taxAmount = opts.taxMode === "taxable"
      ? roundByMode(estimate * opts.taxRate, opts.roundingMode)
      : 0;
    const feeBaseAmount = estimate + taxAmount;
    const buyerFee = roundByMode(feeBaseAmount * opts.buyerFeeRate, opts.roundingMode);
    const buyerTotal = feeBaseAmount + buyerFee;
    const sellerFee = roundByMode(feeBaseAmount * opts.sellerFeeRate, opts.roundingMode);
    const sellerNet = feeBaseAmount - sellerFee;

    return {
      estimateAmount: estimate,
      taxAmount,
      feeBaseAmount,
      buyerFee,
      buyerTotal,
      sellerFee,
      sellerNet,
      warnings: []
    };
  }

  function calcFromBudget(buyerBudget, options) {
    const budget = toNonNegativeInteger(buyerBudget);
    const opts = normalizeOptions(options);
    let left = 0;
    let right = budget;
    let answer = 0;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const result = calcFromEstimate(mid, opts);

      if (result.buyerTotal <= budget) {
        answer = mid;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }

    return calcFromEstimate(answer, opts);
  }

  function calcFromNet(targetNet, options) {
    const net = toNonNegativeInteger(targetNet);
    const opts = normalizeOptions(options);
    let right = Math.max(1, net * 3);

    while (calcFromEstimate(right, opts).sellerNet < net) {
      right *= 2;
      if (right > Number.MAX_SAFE_INTEGER / 2) {
        throw new Error("探索上限が大きすぎます。入力金額を確認してください。");
      }
    }

    let left = 0;
    let answer = right;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const result = calcFromEstimate(mid, opts);

      if (result.sellerNet >= net) {
        answer = mid;
        right = mid - 1;
      } else {
        left = mid + 1;
      }
    }

    return calcFromEstimate(answer, opts);
  }

  function buildChartData(result) {
    const buyerBase = Math.max(1, result.buyerTotal);
    const sellerBase = Math.max(1, result.feeBaseAmount);

    return {
      buyerTotalSegments: [
        { key: "estimate", label: "見積額", amount: result.estimateAmount, ratio: result.estimateAmount / buyerBase },
        { key: "tax", label: "消費税", amount: result.taxAmount, ratio: result.taxAmount / buyerBase },
        { key: "buyerFee", label: "購入者手数料", amount: result.buyerFee, ratio: result.buyerFee / buyerBase }
      ],
      sellerNetSegments: [
        { key: "sellerNet", label: "出品者手取り", amount: result.sellerNet, ratio: result.sellerNet / sellerBase },
        { key: "sellerFee", label: "販売時手数料", amount: result.sellerFee, ratio: result.sellerFee / sellerBase }
      ]
    };
  }

  return {
    DEFAULT_OPTIONS,
    roundByMode,
    calcFromEstimate,
    calcFromBudget,
    calcFromNet,
    buildChartData
  };
});
