(() => {
  const RATE_API = "https://open.er-api.com/v6/latest/USD";

  const fetchEurDzdRate = async () => {
    try {
      const res = await fetch(RATE_API, { cache: "no-store" });
      if (!res.ok) throw new Error("rate fetch failed");
      const data = await res.json();

      // open.er-api returns rates as: 1 USD = rates[XXX]
      const usdToEur = data?.rates?.EUR;
      const usdToDzd = data?.rates?.DZD;

      if (usdToEur > 0 && usdToDzd > 0) {
        // 1 EUR = (DZD per USD) / (EUR per USD)
        return usdToDzd / usdToEur;
      }
    } catch {
      // silent fail
    }
    return null;
  };

  const amountFieldIds = [
    "visaFeeEur",
    "serviceFeeEur",
    "insuranceCostDzd",
    "documentsCostDzd",
    "transportCostDzd",
    "extrasCostDzd"
  ];

  let currentAmountsCurrency = "DZD"; // will be set on init from displayCurrency

    const formatForInput = (n, currency) => {
      if (!Number.isFinite(n)) return "";
      if (currency === "EUR") return (Math.round(n * 100) / 100).toFixed(2);
      // DZD: keep integer feel (you can also do .toFixed(0))
      return String(Math.round(n));
    };

    const updateUnitBadges = (currency) => {
      document.querySelectorAll(".unit[data-unit]").forEach(el => {
        el.textContent = currency;
      });
    };

    const convertAmounts = (fromCur, toCur) => {
      if (fromCur === toCur) return;

      const rate = readNum("eurToDzdRate");

      // Guard: switching TO EUR requires a rate
      if (toCur === "EUR" && rate <= 0) {
        $("noteBox").textContent =
          "⚠️ Entrez un taux EUR→DZD pour convertir tous les montants en EUR.";
        // revert the selector visually
        setVal("displayCurrency", fromCur);
        // keep UI consistent
        computeDebounced();
        return;
      }

      for (const id of amountFieldIds) {
        const raw = ($(id).value ?? "").toString().trim();
        if (raw === "") continue;

        const val = readNum(id);
        let converted = val;

        if (fromCur === "DZD" && toCur === "EUR") {
          converted = val / rate;
        } else if (fromCur === "EUR" && toCur === "DZD") {
          converted = val * rate;
        }

        setVal(id, formatForInput(converted, toCur));
      }

      currentAmountsCurrency = toCur;
      updateUnitBadges(toCur);

      computeDebounced();
    };




  const fmtDzd0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const fmtEur2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const $ = (id) => document.getElementById(id);

  const fields = [
    "visaType","applicantType","displayCurrency","eurToDzdRate",
    "visaFeeEur","serviceFeeEur",
    "insuranceCostDzd","documentsCostDzd","transportCostDzd","extrasCostDzd"
  ];

  const STORAGE_KEY = "visa_calc_v1";

  const clamp0 = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

  const readNum = (id) => {
    const v = ($(id).value ?? "").toString().trim();
    if (!v) return 0;
    const n = Number(v.replace(",", "."));
    return clamp0(n);
  };

  const setVal = (id, v) => { $(id).value = v; };

  const formatDzd = (n) => `${fmtDzd0.format(Math.round(n))} DZD`;
  const formatEur = (n) => `${fmtEur2.format(n)} €`;

  const debounce = (fn, wait = 140) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  // ----- small polish helpers -----
  const markAutoFilled = (id) => {
    const el = $(id);
    if (!el) return;
    el.classList.add("autofilled");
    window.setTimeout(() => el.classList.remove("autofilled"), 2000);
  };

  const extrasPanelEl = () => $("extrasPanel");

  // Track if rate came from URL query (so we never override)
  const rateProvidedByQuery = () => {
    const params = new URLSearchParams(location.search);
    return params.has("eurToDzdRate");
  };

  // ----- localStorage -----
  const loadSaved = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const applySaved = () => {
    const saved = loadSaved();
    if (!saved) return false;
    for (const id of fields) {
      if (saved[id] != null) setVal(id, saved[id]);
    }
    return true;
  };

  const saveCurrent = () => {
    try {
      const data = {};
      for (const id of fields) data[id] = ($(id).value ?? "").toString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  };

  // ----- suggestions (editable) -----
  const suggestedVisaFeeBaseEur = (applicantType) => {
    if (applicantType === "child_under_6" || applicantType === "exempt") return 0;
    if (applicantType === "child_6_11") return 40;
    return 80;
  };


     const maybeApplySuggestion = () => {
       const cur = ($("visaFeeEur").value ?? "").toString().trim();
       if (cur !== "") return;

       const applicantType = $("applicantType").value;
       const baseEur = suggestedVisaFeeBaseEur(applicantType);

       const display = $("displayCurrency").value;
       const rate = readNum("eurToDzdRate");

       let suggested;

       if (display === "EUR") {
         suggested = baseEur;
       } else {
         // DZD display → convert from EUR
         if (rate <= 0) return; // don’t guess without rate
         suggested = baseEur * rate;
       }

       setVal("visaFeeEur", formatForInput(suggested, display));
     };

  // ----- share url -----
  const buildQuery = () => {
    const params = new URLSearchParams();
    for (const id of fields) {
      const el = $(id);
      const val = (el.value ?? "").toString().trim();
      if (val !== "" && val !== "0") params.set(id, val);
    }
    return params.toString();
  };

  const applyQuery = () => {
    const params = new URLSearchParams(location.search);
    for (const id of fields) {
      if (params.has(id)) setVal(id, params.get(id));
    }
  };

  const updateShareUrl = (push = false) => {
    const qs = buildQuery();
    const url = qs ? `${location.pathname}?${qs}` : location.pathname;
    if (push) history.pushState({}, "", url);
    else history.replaceState({}, "", url);
    return `${location.origin}${url}`;
  };

  // ----- compute -----
  const compute = () => {
    maybeApplySuggestion();

    const rate = readNum("eurToDzdRate"); // EUR -> DZD
    const display = $("displayCurrency").value;

    // All amounts are entered in *display currency* (DZD or EUR)
    const visaFee = readNum("visaFeeEur");
    const serviceFee = readNum("serviceFeeEur");
    const insurance = readNum("insuranceCostDzd");
    const documents = readNum("documentsCostDzd");
    const transport = readNum("transportCostDzd");
    const extras = readNum("extrasCostDzd");

    const statusText = $("statusText");
    const noteBox = $("noteBox");
    noteBox.textContent = "";

    const needsRate = (display === "EUR");
    const missingRate = needsRate && rate <= 0;

    // Convert "entered currency" -> DZD for internal sum
    const toDzd = (x) => {
      if (display === "EUR") return rate > 0 ? x * rate : 0;
      return x; // already DZD
    };

    // Convert internal DZD -> UI display
    const toDisplay = (dzd) => {
      if (display === "EUR") return formatEur(rate > 0 ? dzd / rate : 0);
      return formatDzd(dzd);
    };

    if (missingRate) {
      statusText.textContent = "Entrez le taux EUR→DZD pour calculer le total en EUR.";
      $("totalDisplay").textContent = "—";
      $("totalLabel").textContent = "Total estimé";

      $("bVisaFee").textContent = "—";
      $("bServiceFee").textContent = "—";
      $("bInsurance").textContent = "—";
      $("bDocuments").textContent = "—";
      $("bTransport").textContent = "—";
      $("bExtras").textContent = "—";
      $("bTotal").textContent = "—";
      return;
    }

    const totalDzd =
      toDzd(visaFee) +
      toDzd(serviceFee) +
      toDzd(insurance) +
      toDzd(documents) +
      toDzd(transport) +
      toDzd(extras);

    // Breakdown
    $("bVisaFee").textContent = toDisplay(toDzd(visaFee));
    $("bServiceFee").textContent = toDisplay(toDzd(serviceFee));
    $("bInsurance").textContent = toDisplay(toDzd(insurance));
    $("bDocuments").textContent = toDisplay(toDzd(documents));
    $("bTransport").textContent = toDisplay(toDzd(transport));
    $("bExtras").textContent = toDisplay(toDzd(extras));
    $("bTotal").textContent = toDisplay(totalDzd);

    $("totalDisplay").textContent = toDisplay(totalDzd);
    $("totalLabel").textContent = display === "EUR" ? "Total estimé (EUR)" : "Total estimé (DZD)";

    // Warnings
    const warns = [];
    if (rate > 0 && (rate < 50 || rate > 600)) warns.push("Taux EUR→DZD atypique : vérifiez la valeur.");
    if (totalDzd <= 0) warns.push("Total nul : vérifiez vos montants.");

    statusText.textContent = "Estimation calculée avec vos montants.";
    if (warns.length) noteBox.textContent = "⚠️ " + warns.join(" ");
  };


  const computeDebounced = debounce(() => {
    compute();
    updateShareUrl(false);
    saveCurrent();
  }, 120);

  // ----- presets -----
  const applyPresetMinimal = () => {
    setVal("serviceFeeEur", "");
    setVal("insuranceCostDzd", "");
    setVal("documentsCostDzd", "");
    setVal("transportCostDzd", "");
    setVal("extrasCostDzd", "");
    computeDebounced();
  };

  const applyPresetTypical = () => {

    const presetValue = (dzd) => {
      const display = $("displayCurrency").value;
      const rate = readNum("eurToDzdRate");
      if (display === "EUR") {
        if (rate <= 0) return ""; // can't compute
        return formatForInput(dzd / rate, "EUR");
      }
      return formatForInput(dzd, "DZD");
    };


    // Open the optional panel so user sees what changed
    const panel = extrasPanelEl();
    if (panel) panel.open = true;

    // Starter values: you can adjust anytime
    if ((($("insuranceCostDzd").value ?? "").toString().trim()) === "") {
      setVal("insuranceCostDzd", presetValue(5000));
      markAutoFilled("insuranceCostDzd");
    }
    if ((($("documentsCostDzd").value ?? "").toString().trim()) === "") {
      setVal("documentsCostDzd", presetValue(3000));
      markAutoFilled("documentsCostDzd");
    }
    if ((($("transportCostDzd").value ?? "").toString().trim()) === "") {
      setVal("transportCostDzd", presetValue(4000));
      markAutoFilled("transportCostDzd");
    }
    if ((($("extrasCostDzd").value ?? "").toString().trim()) === "") {
      setVal("extrasCostDzd", presetValue(1500));
      markAutoFilled("extrasCostDzd");
    }
    computeDebounced();
  };

  // ----- rate helpers -----
  const setRateHint = (text) => {
    const el = $("rateHint");
    if (el) el.textContent = text;
  };

  const tryAutoFetchRate = async () => {
    // Do not override if user already has a rate (saved or query)
    const cur = (($("eurToDzdRate").value ?? "").toString().trim());
    if (cur !== "") return;
    if (rateProvidedByQuery()) return;

    const rate = await fetchEurDzdRate();
    if (!rate) {
      setRateHint("Valeur modifiable (banque/change/référence personnelle).");
      return;
    }

    setVal("eurToDzdRate", rate.toFixed(2));
    setRateHint("Taux indicatif chargé automatiquement (source publique) — modifiable.");
    $("statusText").textContent = "Taux EUR→DZD indicatif chargé automatiquement (modifiable).";
    computeDebounced();
  };

  const refreshRate = async () => {
    const rate = await fetchEurDzdRate();
    if (!rate) {
      $("noteBox").textContent = "Impossible de récupérer le taux pour le moment.";
      return;
    }
    setVal("eurToDzdRate", rate.toFixed(2));
    setRateHint("Taux indicatif mis à jour (source publique) — modifiable.");
    $("noteBox").textContent = "Taux EUR→DZD mis à jour ✅";
    computeDebounced();
  };

  // ----- copy/share/reset -----
  const copyResult = async () => {
    const display = $("displayCurrency").value;
    const rate = readNum("eurToDzdRate");
    const total = $("totalDisplay").textContent;

    const visaTypeLabel = $("visaType").selectedOptions[0].textContent;
    const applicantLabel = $("applicantType").selectedOptions[0].textContent;

    const url = updateShareUrl(false);

    const text =
`Coût visa (estimation) — aljiz.com
- Type: ${visaTypeLabel}
- Catégorie: ${applicantLabel}
- Devise: ${display}
- Taux EUR→DZD: ${rate > 0 ? rate : "—"}
- Total: ${total}
- Lien: ${url}
(Estimation informative)`;

    await navigator.clipboard.writeText(text);
  };

  const resetAll = () => {
    setVal("visaType", "schengen_short_stay");
    setVal("applicantType", "adult");
    setVal("displayCurrency", "DZD");
    setVal("eurToDzdRate", ""); // allow auto-fetch to kick in
    setVal("visaFeeEur", "");
    setVal("serviceFeeEur", "");
    setVal("insuranceCostDzd", "");
    setVal("documentsCostDzd", "");
    setVal("transportCostDzd", "");
    setVal("extrasCostDzd", "");

    history.replaceState({}, "", location.pathname);
    localStorage.removeItem(STORAGE_KEY);

    setRateHint("Valeur modifiable (banque/change/référence personnelle).");
    compute();
    updateShareUrl(false);

    // try reload rate after reset
    tryAutoFetchRate();
  };

  const init = () => {
    $("year").textContent = new Date().getFullYear();

    // Apply saved first (for returning users)
    const hadSaved = applySaved();

    // If no saved state, set friendly defaults
    if (!hadSaved) {
      setVal("displayCurrency", "DZD");
      setRateHint("Valeur modifiable (banque/change/référence personnelle).");
    }

    // Shared links override saved/defaults
    applyQuery();

    compute();
    updateShareUrl(false);
    saveCurrent();

    for (const id of fields) {
      $(id).addEventListener("input", computeDebounced);
      $(id).addEventListener("change", computeDebounced);
    }

    currentAmountsCurrency = $("displayCurrency").value;
    updateUnitBadges(currentAmountsCurrency);

    $("displayCurrency").addEventListener("change", () => {
      const next = $("displayCurrency").value;
      convertAmounts(currentAmountsCurrency, next);
    });


    // Suggest fee when category changes (but don't overwrite user)
    $("visaType").addEventListener("change", () => {
      if ((($("visaFeeEur").value ?? "").toString().trim()) === "") computeDebounced();
    });
    $("applicantType").addEventListener("change", () => {
      if ((($("visaFeeEur").value ?? "").toString().trim()) === "") computeDebounced();
    });

    $("presetMinimal").addEventListener("click", applyPresetMinimal);
    $("presetTypical").addEventListener("click", applyPresetTypical);

    $("copyBtn").addEventListener("click", async () => {
      try {
        await copyResult();
        $("noteBox").textContent = "Résultat copié dans le presse-papiers ✅";
      } catch {
        $("noteBox").textContent = "Copie impossible (autorisation navigateur).";
      }
    });

    $("shareBtn").addEventListener("click", async () => {
      const url = updateShareUrl(true);
      try {
        await navigator.clipboard.writeText(url);
        $("noteBox").textContent = "Lien partageable copié ✅";
      } catch {
        $("noteBox").textContent = `Lien partageable : ${url}`;
      }
    });

    $("resetBtn").addEventListener("click", resetAll);

    const refreshBtn = $("refreshRateBtn");
    if (refreshBtn) refreshBtn.addEventListener("click", refreshRate);

    // Auto-fetch rate if empty (and not overridden by query)
    tryAutoFetchRate();
  };

  window.addEventListener("DOMContentLoaded", init);
})();
