(function () {
  "use strict";

  const Calculator = window.CoconalaCalculator;
  const state = {
    mode: "fromEstimate",
    modeAmounts: {
      fromEstimate: "50,000",
      fromBudget: "200,000",
      fromNet: "150,000"
    },
    result: null,
    sellerExplanation: "",
    buyerExplanation: ""
  };

  const modeMeta = {
    fromEstimate: {
      label: "見積額",
      note: "提示する税抜ベースの見積額",
      defaultAmount: "50,000",
      summary: "見積額から、お客様支払総額と出品者手取りを計算しています。"
    },
    fromBudget: {
      label: "お客様支払上限額",
      note: "この総額以内に収まる最大見積額を逆算",
      defaultAmount: "200,000",
      summary: "お客様の予算上限から、提示可能な最大見積額を逆算しています。"
    },
    fromNet: {
      label: "目標手取り額",
      note: "この手取り以上になる最小見積額を逆算",
      defaultAmount: "150,000",
      summary: "欲しい手取り額から、必要な見積額とお客様支払額を逆算しています。"
    }
  };

  const refs = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    bindRefs();
    bindEvents();
    calculateAndRender();
  }

  function bindRefs() {
    refs.form = document.getElementById("calculator-form");
    refs.amountInput = document.getElementById("amount-input");
    refs.amountLabel = document.getElementById("amount-label");
    refs.amountNote = document.getElementById("amount-note");
    refs.amountError = document.getElementById("amount-error");
    refs.modeSummary = document.getElementById("mode-summary");
    refs.buyerTotalCard = document.getElementById("buyer-total-card");
    refs.feeBaseCard = document.getElementById("fee-base-card");
    refs.sellerFeeCard = document.getElementById("seller-fee-card");
    refs.sellerNetCard = document.getElementById("seller-net-card");
    refs.breakdownTable = document.getElementById("breakdown-table");
    refs.buyerTotalBar = document.getElementById("buyer-total-bar");
    refs.buyerTotalLegend = document.getElementById("buyer-total-legend");
    refs.sellerNetBar = document.getElementById("seller-net-bar");
    refs.sellerNetLegend = document.getElementById("seller-net-legend");
    refs.buyerTotalLabel = document.getElementById("buyer-total-label");
    refs.feeBaseLabel = document.getElementById("fee-base-label");
    refs.formulaPanel = document.getElementById("formula-panel");
    refs.sellerExplanation = document.getElementById("seller-explanation");
    refs.buyerExplanation = document.getElementById("buyer-explanation");
    refs.toast = document.getElementById("toast");
  }

  function bindEvents() {
    refs.form.addEventListener("submit", (event) => {
      event.preventDefault();
      calculateAndRender();
    });

    refs.form.addEventListener("input", (event) => {
      if (!event.target.matches("input")) return;
      if (event.target === refs.amountInput) {
        state.modeAmounts[state.mode] = refs.amountInput.value;
      }
      calculateAndRender();
    });

    document.querySelectorAll(".mode-tab").forEach((button) => {
      button.addEventListener("click", () => {
        state.modeAmounts[state.mode] = refs.amountInput.value;
        state.mode = button.dataset.mode;
        document.querySelectorAll(".mode-tab").forEach((tab) => {
          tab.classList.toggle("is-active", tab === button);
        });
        refs.amountInput.value = state.modeAmounts[state.mode];
        updateModeText();
        calculateAndRender();
      });
    });

    document.getElementById("reset-button").addEventListener("click", resetForm);
    document.querySelectorAll("[data-amount-delta]").forEach((button) => {
      button.addEventListener("click", () => adjustAmount(Number(button.dataset.amountDelta)));
    });
    document.querySelectorAll("[data-digit]").forEach((button) => {
      button.addEventListener("click", () => appendDigit(button.dataset.digit));
    });
    document.querySelectorAll("[data-number-action]").forEach((button) => {
      button.addEventListener("click", () => handleNumberAction(button.dataset.numberAction));
    });
    document.getElementById("copy-result").addEventListener("click", () => copyText(buildResultText()));
    document.getElementById("copy-explanation").addEventListener("click", () => {
      copyText(`${state.sellerExplanation}\n\n${state.buyerExplanation}`);
    });
  }

  function resetForm() {
    refs.amountInput.value = modeMeta[state.mode].defaultAmount;
    state.modeAmounts[state.mode] = refs.amountInput.value;
    refs.form.taxMode.value = "taxable";
    refs.form.buyerFeeRate.value = "5.5";
    refs.form.sellerFeeRate.value = "22";
    refs.form.taxRate.value = "10";
    refs.form.roundingMode.value = "round";
    calculateAndRender();
  }

  function adjustAmount(delta) {
    const current = parseMoney(refs.amountInput.value);
    const base = Number.isFinite(current) ? current : 0;
    const next = Math.max(0, Math.round(base + delta));
    setAmountValue(next);
    calculateAndRender();
  }

  function appendDigit(digit) {
    const raw = String(refs.amountInput.value).replace(/,/g, "").replace(/\D/g, "");
    const nextRaw = raw === "0" ? digit : `${raw}${digit}`;
    setAmountValue(Number(nextRaw));
    calculateAndRender();
  }

  function handleNumberAction(action) {
    if (action === "clear") {
      refs.amountInput.value = "";
      state.modeAmounts[state.mode] = "";
      calculateAndRender();
      return;
    }

    if (action === "backspace") {
      const raw = String(refs.amountInput.value).replace(/,/g, "").replace(/\D/g, "");
      const nextRaw = raw.slice(0, -1);
      if (nextRaw === "") {
        refs.amountInput.value = "";
        state.modeAmounts[state.mode] = "";
      } else {
        setAmountValue(Number(nextRaw));
      }
      calculateAndRender();
    }
  }

  function setAmountValue(value) {
    refs.amountInput.value = Number(value).toLocaleString("ja-JP");
    state.modeAmounts[state.mode] = refs.amountInput.value;
  }

  function updateModeText() {
    const meta = modeMeta[state.mode];
    refs.amountLabel.textContent = meta.label;
    refs.amountNote.textContent = meta.note;
    refs.modeSummary.textContent = meta.summary;
  }

  function calculateAndRender() {
    updateModeText();
    const parsed = readInput();
    if (!parsed.ok) {
      refs.amountError.textContent = parsed.message;
      return;
    }

    refs.amountError.textContent = "";

    if (state.mode === "fromBudget") {
      state.result = Calculator.calcFromBudget(parsed.amount, parsed.options);
    } else if (state.mode === "fromNet") {
      state.result = Calculator.calcFromNet(parsed.amount, parsed.options);
    } else {
      state.result = Calculator.calcFromEstimate(parsed.amount, parsed.options);
    }

    renderResult(state.result, parsed.options);
  }

  function readInput() {
    const amount = parseMoney(refs.amountInput.value);
    if (amount === null) {
      return { ok: false, message: "金額を入力してください。" };
    }
    if (!Number.isInteger(amount) || amount < 0) {
      return { ok: false, message: "金額は0以上の整数で入力してください。" };
    }

    const buyerFeeRate = readPercent(refs.form.buyerFeeRate.value);
    const sellerFeeRate = readPercent(refs.form.sellerFeeRate.value);
    const taxRate = readPercent(refs.form.taxRate.value);
    if ([buyerFeeRate, sellerFeeRate, taxRate].some((value) => value === null || value < 0 || value > 1)) {
      return { ok: false, message: "料率は0以上100以下で入力してください。" };
    }

    return {
      ok: true,
      amount,
      options: {
        taxMode: refs.form.taxMode.value,
        buyerFeeRate,
        sellerFeeRate,
        taxRate,
        roundingMode: refs.form.roundingMode.value
      }
    };
  }

  function parseMoney(value) {
    const normalized = String(value).replace(/,/g, "").trim();
    if (normalized === "") return null;
    const number = Number(normalized);
    return Number.isFinite(number) ? number : NaN;
  }

  function readPercent(value) {
    if (String(value).trim() === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number / 100;
  }

  function renderResult(result, options) {
    refs.buyerTotalCard.textContent = yen(result.buyerTotal);
    refs.feeBaseCard.textContent = yen(result.feeBaseAmount);
    refs.sellerFeeCard.textContent = yen(result.sellerFee);
    refs.sellerNetCard.textContent = yen(result.sellerNet);
    refs.buyerTotalLabel.textContent = yen(result.buyerTotal);
    refs.feeBaseLabel.textContent = yen(result.feeBaseAmount);

    renderTable(result, options);
    renderBars(result);
    renderExplanation(result, options);
    renderFormula(options);
  }

  function renderTable(result, options) {
    const sourceRowName = getSourceRowName();
    const rows = [
      ["見積額（税抜）", result.estimateAmount, "入力値または逆算結果", state.mode === "fromEstimate" ? "入力" : "逆算"],
      ["消費税", result.taxAmount, options.taxMode === "taxable" ? "見積額 × 消費税率" : "消費税なしのため0円", "税率は設定値を使用"],
      ["手数料計算対象額", result.feeBaseAmount, "見積額 + 消費税", "購入者手数料・出品者手数料の基準額"],
      ["購入者サービス手数料", result.buyerFee, `手数料計算対象額 × ${percent(options.buyerFeeRate)}`, "お客様側の手数料"],
      ["お客様支払総額", result.buyerTotal, "手数料計算対象額 + 購入者サービス手数料", "お客様が支払う想定総額"],
      ["出品者販売時手数料", result.sellerFee, `手数料計算対象額 × ${percent(options.sellerFeeRate)}`, "ココナラ販売時手数料"],
      ["出品者手取り", result.sellerNet, "手数料計算対象額 - 出品者販売時手数料", "出品者の受取額"]
    ];

    refs.breakdownTable.innerHTML = rows.map(([name, amount, formula, note]) => (
      `<tr class="${name === sourceRowName ? "source-row" : ""}"><td>${escapeHtml(name)}${name === sourceRowName ? '<span class="source-badge">入力の起点</span>' : ""}</td><td>${yen(amount)}</td><td>${escapeHtml(formula)}</td><td>${escapeHtml(note)}</td></tr>`
    )).join("");
  }

  function getSourceRowName() {
    if (state.mode === "fromBudget") return "お客様支払総額";
    if (state.mode === "fromNet") return "出品者手取り";
    return "見積額（税抜）";
  }

  function renderBars(result) {
    const chart = Calculator.buildChartData(result);
    renderStackedBar(refs.buyerTotalBar, refs.buyerTotalLegend, chart.buyerTotalSegments, {
      estimate: "segment-estimate",
      tax: "segment-tax",
      buyerFee: "segment-buyer-fee"
    });
    renderStackedBar(refs.sellerNetBar, refs.sellerNetLegend, chart.sellerNetSegments, {
      sellerNet: "segment-net",
      sellerFee: "segment-seller-fee"
    });
  }

  function renderStackedBar(bar, legend, segments, classMap) {
    bar.innerHTML = segments.map((segment) => {
      const width = segment.amount <= 0 ? 0 : Math.max(segment.ratio * 100, 4);
      const label = segment.amount > 0 ? `${segment.label}\n${yen(segment.amount)}` : "";
      return `<div class="bar-segment ${classMap[segment.key]}" style="flex-basis:${width}%">${escapeHtml(label)}</div>`;
    }).join("");

    legend.innerHTML = segments.map((segment) => (
      `<span class="legend-item"><span class="legend-dot ${classMap[segment.key]}"></span>${escapeHtml(segment.label)} ${yen(segment.amount)}</span>`
    )).join("");
  }

  function renderExplanation(result, options) {
    const taxPhrase = options.taxMode === "taxable"
      ? `消費税${yen(result.taxAmount)}を加算した`
      : "消費税なしで";

    state.sellerExplanation = `見積額${yen(result.estimateAmount)}に対し、${taxPhrase}手数料計算対象額は${yen(result.feeBaseAmount)}です。購入者側にはサービス手数料${yen(result.buyerFee)}が加算されるため、お客様支払総額は${yen(result.buyerTotal)}です。出品者側では販売時手数料${yen(result.sellerFee)}が差し引かれ、手取りは${yen(result.sellerNet)}です。`;
    state.buyerExplanation = `お見積額は${yen(result.estimateAmount)}です。\n${options.taxMode === "taxable" ? `消費税${yen(result.taxAmount)}を含めたサービス価格は${yen(result.feeBaseAmount)}となります。` : `サービス価格は${yen(result.feeBaseAmount)}となります。`}\nココナラの購入者サービス手数料${yen(result.buyerFee)}を含めると、お客様のお支払総額は${yen(result.buyerTotal)}前後となる想定です。\n\n※実際の金額はココナラ画面上の表示をご確認ください。`;

    refs.sellerExplanation.textContent = state.sellerExplanation;
    refs.buyerExplanation.textContent = state.buyerExplanation;
  }

  function renderFormula(options) {
    const roundingLabel = getRoundingLabel(options.roundingMode);
    const taxFormula = options.taxMode === "taxable"
      ? `消費税 = 見積額 × 消費税率 を${roundingLabel}`
      : "消費税 = 0";
    const items = [
      taxFormula,
      "手数料計算対象額 = 見積額 + 消費税",
      `購入者サービス手数料 = 手数料計算対象額 × 購入者手数料率 を${roundingLabel}`,
      "お客様支払総額 = 手数料計算対象額 + 購入者サービス手数料",
      `出品者販売時手数料 = 手数料計算対象額 × 出品者手数料率 を${roundingLabel}`,
      "出品者手取り = 手数料計算対象額 - 出品者販売時手数料",
      "公式ヘルプでは手数料金額は小数点第一位を四捨五入と説明されています。通常は四捨五入で確認してください。"
    ];

    refs.formulaPanel.innerHTML = `<ul class="formula-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function buildResultText() {
    if (!state.result) return "";
    const result = state.result;
    return [
      "ココナラ見積・手取り・予算逆算ツール 計算結果",
      `見積額: ${yen(result.estimateAmount)}`,
      `消費税: ${yen(result.taxAmount)}`,
      `手数料計算対象額: ${yen(result.feeBaseAmount)}`,
      `購入者サービス手数料: ${yen(result.buyerFee)}`,
      `お客様支払総額: ${yen(result.buyerTotal)}`,
      `出品者販売時手数料: ${yen(result.sellerFee)}`,
      `出品者手取り: ${yen(result.sellerNet)}`,
      "",
      "※本ツールは参考計算です。最終金額はココナラ画面でご確認ください。"
    ].join("\n");
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("コピーしました。");
    } catch (error) {
      showToast("コピーできませんでした。");
    }
  }

  function showToast(message) {
    refs.toast.textContent = message;
    refs.toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => refs.toast.classList.remove("is-visible"), 1800);
  }

  function yen(value) {
    return `${Number(value).toLocaleString("ja-JP")}円`;
  }

  function percent(value) {
    return `${(value * 100).toLocaleString("ja-JP", { maximumFractionDigits: 3 })}%`;
  }

  function getRoundingLabel(mode) {
    if (mode === "floor") return "切り捨て";
    if (mode === "ceil") return "切り上げ";
    return "四捨五入";
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
