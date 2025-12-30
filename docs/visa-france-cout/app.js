(() => {
  const fmtDzd0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const fmtEur2 = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });


  const $ = (id) => document.getElementById(id);

  const fields = [
    "visaType","applicantType","displayCurrency","eurToDzdRate",
    "visaFeeEur","serviceFeeEur",
    "insuranceCostDzd","documentsCostDzd","transportCostDzd","extrasCostDzd"
  ];

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

  // Default suggestions (editable)
  const suggestedVisaFeeEur = (applicantType) => {
    // Common heuristic (NOT official): adult ~80, child 6-11 ~40, under 6 ~0, exempt ~0
    // Long stay varies widely; keep same suggestion to encourage editing.
    if (applicantType === "child_under_6" || applicantType === "exempt") return 0;
    if (applicantType === "child_6_11") return 40;
    return 80;
  };

  const maybeApplySuggestion = () => {
    // Only auto-fill if the field is empty
    const cur = ($("visaFeeEur").value ?? "").toString().trim();
    if (cur !== "") return;

    const applicantType = $("applicantType").value;
    setVal("visaFeeEur", String(suggestedVisaFeeEur(applicantType)));
  };

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

  const compute = () => {
    maybeApplySuggestion();

    const rate = readNum("eurToDzdRate"); // EUR -> DZD
    const display = $("displayCurrency").value;

    const visaFeeEur = readNum("visaFeeEur");
    const serviceFeeEur = readNum("serviceFeeEur");

    const insuranceDzd = readNum("insuranceCostDzd");
    const documentsDzd = readNum("documentsCostDzd");
    const transportDzd = readNum("transportCostDzd");
    const extrasDzd = readNum("extrasCostDzd");

    const visaFeeDzd = visaFeeEur * rate;
    const serviceFeeDzd = serviceFeeEur * rate;

    const totalDzd = visaFeeDzd + serviceFeeDzd + insuranceDzd + documentsDzd + transportDzd + extrasDzd;

    const statusText = $("statusText");
    const noteBox = $("noteBox");
    noteBox.textContent = "";

    const usesEur = (visaFeeEur > 0 || serviceFeeEur > 0);
    const missingRate = usesEur && rate <= 0;

    if (missingRate) {
      const wantsEur = display === "EUR";

      statusText.textContent = wantsEur
        ? "Entrez le taux EUR→DZD pour afficher le total en EUR. Les postes saisis en DZD restent affichés en DZD tant que le taux n’est pas renseigné."
        : "Entrez le taux EUR→DZD pour convertir les frais saisis en EUR.";

      $("totalDisplay").textContent = "—";
      $("totalLabel").textContent = "Total estimé";
      $("bVisaFee").textContent = "—";
      $("bServiceFee").textContent = "—";

      const showDzdOnly = (dzd) => formatDzd(dzd);

      $("bInsurance").textContent = showDzdOnly(insuranceDzd);
      $("bDocuments").textContent = showDzdOnly(documentsDzd);
      $("bTransport").textContent = showDzdOnly(transportDzd);
      $("bExtras").textContent = showDzdOnly(extrasDzd);

      $("bTotal").textContent = "—";
      return;
    }


    // Render in selected currency
    const toDisplay = (dzd) => {
      if (display === "EUR") return formatEur(rate > 0 ? dzd / rate : 0);
      return formatDzd(dzd);
    };

    $("bVisaFee").textContent = display === "EUR" ? formatEur(visaFeeEur) : formatDzd(visaFeeDzd);
    $("bServiceFee").textContent = display === "EUR" ? formatEur(serviceFeeEur) : formatDzd(serviceFeeDzd);
    $("bInsurance").textContent = toDisplay(insuranceDzd);
    $("bDocuments").textContent = toDisplay(documentsDzd);
    $("bTransport").textContent = toDisplay(transportDzd);
    $("bExtras").textContent = toDisplay(extrasDzd);
    $("bTotal").textContent = toDisplay(totalDzd);

    $("totalDisplay").textContent = toDisplay(totalDzd);
    $("totalLabel").textContent = display === "EUR" ? "Total estimé (EUR)" : "Total estimé (DZD)";

    // Warnings
    const warns = [];
    if (rate <= 0 && usesEur) warns.push("Taux EUR→DZD manquant.");
    if (rate > 0 && (rate < 50 || rate > 600)) warns.push("Taux EUR→DZD atypique : vérifiez la valeur.");
    if (totalDzd <= 0) warns.push("Total nul : vérifiez vos montants.");

    statusText.textContent = "Estimation calculée avec vos montants.";
    if (warns.length) noteBox.textContent = "⚠️ " + warns.join(" ");
  };

  const computeDebounced = debounce(() => {
    compute();
    updateShareUrl(false);
  }, 120);

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
    // Keep the UX friendly: reset to defaults
    setVal("visaType", "schengen_short_stay");
    setVal("applicantType", "adult");
    setVal("displayCurrency", "DZD");
    setVal("eurToDzdRate", "");
    setVal("visaFeeEur", "");
    setVal("serviceFeeEur", "");
    setVal("insuranceCostDzd", "");
    setVal("documentsCostDzd", "");
    setVal("transportCostDzd", "");
    setVal("extrasCostDzd", "");

    history.replaceState({}, "", location.pathname);
    compute();
  };

  const init = () => {
    $("year").textContent = new Date().getFullYear();

    applyQuery();
    compute();
    updateShareUrl(false);

    for (const id of fields) {
      $(id).addEventListener("input", computeDebounced);
      $(id).addEventListener("change", computeDebounced);
    }

    // Suggest fee when visa type / category changes, but keep user edits:
    $("visaType").addEventListener("change", () => {
      // Don't overwrite if user already typed something
      if ((($("visaFeeEur").value ?? "").toString().trim()) === "") computeDebounced();
    });
    $("applicantType").addEventListener("change", () => {
      if ((($("visaFeeEur").value ?? "").toString().trim()) === "") computeDebounced();
    });

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
  };

  window.addEventListener("DOMContentLoaded", init);
})();
