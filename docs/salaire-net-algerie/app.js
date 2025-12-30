(() => {
  const fmtDzd0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const fmtDzd2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

  const $ = (id) => document.getElementById(id);

  const fields = [
    "grossMonthlyDzd",
    "allowancesDzd",
    "employeeSocialRatePct",
    "otherDeductionsDzd",
    "taxMode",
    "taxRatePct",
    "payFrequency"
  ];

  const clamp0 = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

  const readNum = (id) => {
    const v = ($(id).value ?? "").toString().trim();
    if (!v) return 0;
    const n = Number(v.replace(",", "."));
    return clamp0(n);
  };

  const setVal = (id, v) => { $(id).value = v; };

  const formatMoney0 = (n) => `${fmtDzd0.format(Math.round(n))} DZD`;
  const formatMoney2 = (n) => `${fmtDzd2.format(n)} DZD`;

  const debounce = (fn, wait = 140) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const setTaxVisibility = () => {
    const mode = $("taxMode").value;
    $("taxRateWrap").style.display = mode === "flatRate" ? "block" : "none";
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
    setTaxVisibility();

    const grossMonthly = readNum("grossMonthlyDzd");
    const allowances = readNum("allowancesDzd");
    const socialRatePct = readNum("employeeSocialRatePct");
    const otherDeductions = readNum("otherDeductionsDzd");

    const taxMode = $("taxMode").value;
    const taxRatePct = readNum("taxRatePct");
    const payFrequency = $("payFrequency").value;

    const gross = grossMonthly + allowances;

    // Charges salariales (optional)
    const social = socialRatePct > 0 ? (gross * (socialRatePct / 100)) : 0;

    // Base imposable (simple hypothesis)
    const taxBase = Math.max(0, gross - social);

    // Impôt (flat rate optional)
    let tax = 0;
    if (taxMode === "flatRate") {
      const rate = taxRatePct / 100;
      tax = taxRatePct > 0 ? (taxBase * rate) : 0;
    }

    const netMonthly = Math.max(0, gross - social - tax - otherDeductions);

    // Display: monthly or yearly
    const netShown = payFrequency === "yearly" ? (netMonthly * 12) : netMonthly;

    $("netDisplay").textContent = formatMoney2(netShown);
    $("netLabel").textContent = payFrequency === "yearly"
      ? "Salaire net (annuel approx.) — DZD"
      : "Salaire net (mensuel) — DZD";

    // Breakdown
    $("bGross").textContent = formatMoney0(gross);
    $("bSocial").textContent = formatMoney0(social);
    $("bTaxBase").textContent = formatMoney0(taxBase);
    $("bTax").textContent = formatMoney0(tax);
    $("bOther").textContent = formatMoney0(otherDeductions);
    $("bNet").textContent = formatMoney0(netMonthly);

    // Status / warnings
    const statusText = $("statusText");
    const noteBox = $("noteBox");
    noteBox.textContent = "";

    if (grossMonthly <= 0 && allowances <= 0) {
      statusText.textContent = "Renseignez le brut pour obtenir une estimation.";
      return;
    }

    const warnings = [];
    if (socialRatePct > 25) warnings.push("Taux de retenue élevé : vérifiez la valeur saisie.");
    if (taxMode === "flatRate" && taxRatePct > 60) warnings.push("Taux d’impôt élevé : vérifiez la valeur saisie.");
    if (otherDeductions > gross) warnings.push("Les autres déductions dépassent le brut + primes (net ramené à 0).");

    statusText.textContent = "Estimation calculée avec vos paramètres.";
    if (warnings.length) noteBox.textContent = "⚠️ " + warnings.join(" ");
  };

  const computeDebounced = debounce(() => {
    compute();
    updateShareUrl(false);
  }, 120);

  const copyResult = async () => {
    const net = $("netDisplay").textContent;
    const freq = $("payFrequency").value === "yearly" ? "annuel approx." : "mensuel";
    const grossMonthly = readNum("grossMonthlyDzd");
    const allowances = readNum("allowancesDzd");
    const socialRate = $("employeeSocialRatePct").value || "";
    const taxMode = $("taxMode").value;
    const taxRate = $("taxRatePct").value || "";
    const url = updateShareUrl(false);

    const text =
`Salaire net Algérie (estimation) — aljiz.com
- Brut mensuel: ${formatMoney0(grossMonthly)}
- Primes: ${formatMoney0(allowances)}
- Retenue salarié (%): ${socialRate || "—"}
- Impôt: ${taxMode === "none" ? "aucun" : `taux fixe ${taxRate || "—"}%`}
- Net (${freq}): ${net}
- Lien: ${url}
(Estimation informative)`;

    await navigator.clipboard.writeText(text);
  };

  const resetAll = () => {
    for (const id of fields) {
      if (id === "taxMode") setVal(id, "none");
      else if (id === "payFrequency") setVal(id, "monthly");
      else setVal(id, "");
    }
    history.replaceState({}, "", location.pathname);
    setTaxVisibility();
    compute();
  };

  const init = () => {
    $("year").textContent = new Date().getFullYear();
    applyQuery();
    setTaxVisibility();
    compute();
    updateShareUrl(false);

    for (const id of fields) {
      $(id).addEventListener("input", computeDebounced);
      $(id).addEventListener("change", computeDebounced);
    }

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
