// Aljiz – Minimal consent manager + delayed GA4 loader (FIXED)

const GA_MEASUREMENT_ID = 'G-Z8W11MZTF8'; // <-- replace if needed
const CONSENT_KEY = 'aljiz_ga_consent';   // 'granted' | 'denied'

function ensureGtagStub() {
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() { window.dataLayer.push(arguments); };
  }
}

function injectGtagScriptOnce() {
  // Avoid double-injecting gtag.js
  if (document.querySelector('script[data-aljiz-ga="1"]')) return;

  const s = document.createElement('script');
  s.async = true;
  s.src =
    'https://www.googletagmanager.com/gtag/js?id=' +
    encodeURIComponent(GA_MEASUREMENT_ID);
  s.setAttribute('data-aljiz-ga', '1');
  s.onerror = () => console.warn('[GA4] failed to load gtag.js');
  document.head.appendChild(s);
}

function loadGAOnce() {
  if (window.__aljizGaLoaded) return;
  window.__aljizGaLoaded = true;

  // 1) Always set up gtag stub first so calls are queued reliably
  ensureGtagStub();

  // 2) Queue config BEFORE loading the script (fixes race condition)
  window.gtag('js', new Date());
  window.gtag('config', GA_MEASUREMENT_ID, { anonymize_ip: true });

  // 3) Now load gtag.js
  injectGtagScriptOnce();
}

function showCookieBanner() {
  const el = document.getElementById('cookieBanner');
  if (el) el.style.display = 'block';
}

function hideCookieBanner() {
  const el = document.getElementById('cookieBanner');
  if (el) el.style.display = 'none';
}

function getConsent() {
  return localStorage.getItem(CONSENT_KEY);
}

function setConsent(value) {
  localStorage.setItem(CONSENT_KEY, value);
}

function applyConsent() {
  const consent = getConsent();

  if (consent === 'granted') {
    hideCookieBanner();
    loadGAOnce();
  } else if (consent === 'denied') {
    hideCookieBanner();
    // optional: if you ever load GA by mistake elsewhere, you could also set it to denied here
  } else {
    showCookieBanner();
  }
}

// Button wiring
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('cookieAccept')?.addEventListener('click', () => {
    setConsent('granted');
    hideCookieBanner();
    loadGAOnce();
  });

  document.getElementById('cookieRefuse')?.addEventListener('click', () => {
    setConsent('denied');
    hideCookieBanner();
  });

  document.getElementById('cookiePrefs')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem(CONSENT_KEY);
    // allow re-triggering GA later if they accept after having denied
    window.__aljizGaLoaded = false;
    showCookieBanner();
  });

  applyConsent();
});
