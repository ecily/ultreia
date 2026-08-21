const supportedLanguages = ['de', 'en', 'es'];
const storageKey = 'ultreia.language';

function getInitialLanguage() {
  const stored = window.localStorage.getItem(storageKey);
  if (supportedLanguages.includes(stored)) return stored;

  const browserLanguage = (navigator.language || '').slice(0, 2).toLowerCase();
  if (supportedLanguages.includes(browserLanguage)) return browserLanguage;

  return 'en';
}

function setLanguage(language) {
  const nextLanguage = supportedLanguages.includes(language) ? language : 'en';
  document.documentElement.lang = nextLanguage;
  window.localStorage.setItem(storageKey, nextLanguage);

  document.querySelectorAll('[data-lang]').forEach((element) => {
    element.classList.toggle('is-active', element.dataset.lang === nextLanguage);
  });

  document.querySelectorAll('[data-language-button]').forEach((button) => {
    const isActive = button.dataset.languageButton === nextLanguage;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

document.querySelectorAll('[data-language-button]').forEach((button) => {
  button.addEventListener('click', () => setLanguage(button.dataset.languageButton));
});

setLanguage(getInitialLanguage());

function canUseHeroVideo() {
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    && !window.matchMedia('(max-width: 767px)').matches
    && !navigator.connection?.saveData;
}

function loadHeroVideo() {
  const video = document.querySelector('[data-hero-video]');
  if (!video || !canUseHeroVideo()) return;

  const source = video.dataset.videoMp4;
  if (!source) return;

  video.addEventListener('error', () => {
    video.classList.remove('is-ready');
    video.closest('.hero-media')?.classList.add('video-failed');
  }, { once: true });

  video.addEventListener('canplay', () => {
    video.classList.add('is-ready');
    video.play().catch(() => video.classList.remove('is-ready'));
  }, { once: true });

  video.src = source;
  video.load();
}

function scheduleHeroVideo() {
  if (!canUseHeroVideo()) return;

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(loadHeroVideo, { timeout: 2500 });
  } else {
    window.addEventListener('load', () => window.setTimeout(loadHeroVideo, 250), { once: true });
  }
}

scheduleHeroVideo();

if (document.querySelector('[data-web-app]')) {
  const authScript = document.createElement('script');
  authScript.src = '/web-auth.js';
  document.body.appendChild(authScript);
}
