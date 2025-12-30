(() => {
  const fmtDzd = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
  const fmtDzd2 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

  const $ = (id) => document.getElementById(id);

  const fields = [
    "cashDzd","inventoryDzd","receivablesDzd","debtsDueDzd",
    "nisabMethod","goldPricePerGramDzd","silverPricePerGramDzd",
    "goldNisabGrams","silverNisabGrams",
    "goldGrams","silverGrams",
    "zakatRatePct"
  ];

  const clamp0 = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

  const readNum = (id) => {
    const v = ($(id).value ?? "").toString().trim();
    if (!v) return 0;
    const n = Number(v.replace(",", "."));
    return clamp0(n);
  };

  const setVal = (id, v) => { $(id).value = v; };

  const formatMoney = (n) => `${fmtDzd.format(Math.round(n))} DZD`;
  const formatMoney2 = (n) => `${fmtDzd2.format(n)} DZD`;

  const debounce = (fn, wait = 150) => {
    let t = null;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  };

  const setMethodVisibility = () => {
    const method = $("nisabMethod").value;
    $("goldPriceWrap").style.display = method === "gold" ? "block" : "none";
    $("silverPriceWrap").style.display = method === "silver" ? "block" : "none";
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
    const cash = readNum("cashDzd");
    const inventory = readNum("inventoryDzd");
    const receivables = readNum("receivablesDzd");
    const debts = readNum("debtsDueDzd");

    const method = $("nisabMethod").value;
    const goldPrice = readNum("goldPricePerGramDzd");
    const silverPrice = readNum("silverPricePerGramDzd");

    const goldNisabG = clamp0(readNum("goldNisabGrams")) || 85;
    const silverNisabG = clamp0(readNum("silverNisabGrams")) || 595;

    const goldG = readNum("goldGrams");
    const silverG = readNum("silverGrams");

    const zakatRatePct = readNum("zakatRatePct") || 2.5;
    const zakatRate = zakatRatePct / 100;

    const goldValue = goldG * goldPrice;
    const silverValue = silverG * silverPrice;

    const assets = cash + inventory + receivables + goldValue + silverValue;
    const zakatable = Math.max(0, assets - debts);

    let nisab = 0;
    let missingPrice = false;

    if (method === "gold") {
      nisab = goldPrice * goldNisabG;
      missingPrice = goldPrice <= 0;
    } else {
      nisab = silverPrice * silverNisabG;
      missingPrice = silverPrice <= 0;
    }

    const isDue = !missingPrice && zakatable >= nisab && nisab > 0;
    const zakatDue = isDue ? (zakatable * zakatRate) : 0;

    // Render summary
    $("assetsDzd").textContent = formatMoney(assets);
    $("zakatableDzd").textContent = formatMoney(zakatable);
    $("nisabDzd").textContent = missingPrice ? "Prix manquant" : formatMoney(nisab);

    $("bCash").textContent = formatMoney(cash);
    $("bInventory").textContent = formatMoney(inventory);
    $("bReceivables").textContent = formatMoney(receivables);
    $("bGold").textContent = formatMoney(goldValue);
    $("bSilver").textContent = formatMoney(silverValue);
    $("bDebts").textContent = formatMoney(debts);

    $("zakatDue").textContent = isDue ? formatMoney2(zakatDue) : "0 DZD";

    // Status / note
    const badge = $("isDueBadge");
    const statusText = $("statusText");
    const noteBox = $("noteBox");
    noteBox.textContent = "";

    if (missingPrice) {
      badge.textContent = "Action requise";
      badge.style.background = "rgba(255, 196, 70, .18)";
      statusText.textContent = `Entrez le prix ${method === "gold" ? "de l’or" : "de l’argent"} par gramme pour calculer le nissab.`;
      noteBox.textContent = "Astuce : vous pouvez modifier le nissab (grammes) et le taux si votre méthode diffère.";
      return;
    }

    if (nisab <= 0) {
      badge.textContent = "Incomplet";
      badge.style.background = "rgba(255, 196, 70, .18)";
      statusText.textContent = "Entrez un prix par gramme et vérifiez vos saisies.";
      return;
    }

    if (isDue) {
      badge.textContent = "Zakat due";
      badge.style.background = "rgba(80, 220, 150, .18)";
      statusText.textContent = "Votre total zakatable atteint ou dépasse le nissab.";
      if (debts > assets) noteBox.textContent = "Note : vos dettes dépassent vos actifs, le total zakatable est ramené à 0.";
    } else {
      badge.textContent = "Non due";
      badge.style.background = "rgba(255, 196, 70, .10)";
      statusText.textContent = "Votre total zakatable est en dessous du nissab.";
      if (debts > assets) noteBox.textContent = "Note : vos dettes dépassent vos actifs, le total zakatable est ramené à 0.";
    }
  };

  const computeDebounced = debounce(() => {
    setMethodVisibility();
    compute();
    updateShareUrl(false);
  }, 120);

  const copyResult = async () => {
    const zakat = $("zakatDue").textContent;
    const nisab = $("nisabDzd").textContent;
    const zakatable = $("zakatableDzd").textContent;
    const method = $("nisabMethod").value === "gold" ? "or" : "argent";
    const url = updateShareUrl(false);

    const text =
`Calcul Zakat (DZD) — aljiz.com
- Méthode nissab: ${method}
- Nissab: ${nisab}
- Total zakatable: ${zakatable}
- Zakat due: ${zakat}
- Lien: ${url}
(Estimation informative)`;

    await navigator.clipboard.writeText(text);
  };

  const resetAll = () => {
    for (const id of fields) {
      if (id === "nisabMethod") setVal(id, "gold");
      else if (id === "goldNisabGrams") setVal(id, "85");
      else if (id === "silverNisabGrams") setVal(id, "595");
      else if (id === "zakatRatePct") setVal(id, "2.5");
      else setVal(id, "");
    }
    history.replaceState({}, "", location.pathname);
    setMethodVisibility();
    compute();
  };

  const init = () => {
    $("year").textContent = new Date().getFullYear();

    applyQuery();
    setMethodVisibility();
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
