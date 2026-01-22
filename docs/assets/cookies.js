// Aljiz – Minimal consent manager + delayed GA4 loader

const GA_MEASUREMENT_ID = 'G-Z8W11MZTF8'; // <-- replace if needed
const CONSENT_KEY = 'aljiz_ga_consent';   // 'granted' | 'denied'

function loadGAOnce() {
  if (window.__aljizGaLoaded) return;
  window.__aljizGaLoaded = true;

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' +
          encodeURIComponent(GA_MEASUREMENT_ID);
  document.head.appendChild(s);

  s.onload = () => {
    window.dataLayer = window.dataLayer || [];
    function gtag(){ window.dataLayer.push(arguments); }
    window.gtag = gtag;

    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
      anonymize_ip: true
    });
  };
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
    showCookieBanner();
  });

  applyConsent();
});
