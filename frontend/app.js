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
