import { useEffect, useState } from 'react';
import './App.css';

import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';

const MESSAGES = { de, en, es };
const SUPPORTED_LANGS = ['de', 'en', 'es'];

function getInitialLang() {
  if (typeof window !== 'undefined') {
    try {
      const stored = window.localStorage.getItem('ultreia-lang');
      if (stored && SUPPORTED_LANGS.includes(stored)) {
        return stored;
      }
    } catch {
      // ignore
    }
    if (typeof navigator !== 'undefined' && navigator.language) {
      const short = navigator.language.slice(0, 2).toLowerCase();
      if (SUPPORTED_LANGS.includes(short)) {
        return short;
      }
    }
  }
  return 'de';
}

// Einfaches Jakobsmuschel-Icon als Inline-SVG, über CSS gelb/blau eingefärbt
function CaminoShellIcon({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      {/* Schale */}
      <path
        d="M32 8C23 9 16 16 13 24L10 32L16 52H48L54 32L51 24C48 16 41 9 32 8Z"
        fill="currentColor"
      />
      {/* Strahlen / Rippen */}
      <path
        d="M32 12L30 26L32 52M24 14L26 28L32 52M40 14L38 28L32 52M18 20L23 30L32 52M46 20L41 30L32 52"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function App() {
  const [lang, setLang] = useState(getInitialLang);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('ultreia-lang', lang);
      }
    } catch {
      // ignore
    }
  }, [lang]);

  const t = (key) => {
    const dict = MESSAGES[lang] || MESSAGES.de;
    return dict[key] || key;
  };

  const handleLangClick = (code) => {
    if (code !== lang && SUPPORTED_LANGS.includes(code)) {
      setLang(code);
    }
  };

  return (
    <div className="app-root">
      {/* Camino-Blau/Gelb Hintergrund-Layer */}
      <div className="bg-gradient" />
      <div className="bg-overlay" />

      <div className="app-shell">
        {/* Navigation */}
        <header className="nav">
          <div className="nav-left">
            <div className="brand-mark">
              <div className="brand-symbol" aria-hidden="true">
                <CaminoShellIcon className="brand-shell-icon" />
              </div>
              <div className="brand-text">
                <span className="brand-name">{t('brand.name')}</span>
                <span className="brand-tagline">{t('brand.tagline')}</span>
              </div>
            </div>
          </div>
          <div className="nav-right">
            <nav className="nav-links" aria-label={t('nav.ariaMain')}>
              <button type="button" className="nav-link">
                {t('nav.pilgrims')}
              </button>
              <button type="button" className="nav-link">
                {t('nav.providers')}
              </button>
              <button type="button" className="nav-link nav-link-soft">
                {t('nav.howItWorks')}
              </button>
            </nav>
            <div className="lang-switch" aria-label={t('lang.aria')}>
              {SUPPORTED_LANGS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => handleLangClick(code)}
                  className={
                    'lang-chip ' + (lang === code ? 'lang-chip-active' : '')
                  }
                >
                  {t(`lang.label.${code}`)}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="main">
          {/* Hero */}
          <section className="hero">
            <div className="hero-content">
              <div className="hero-badge">
                <span className="hero-badge-dot" />
                <span>{t('hero.badge')}</span>
              </div>

              <h1 className="hero-title">
                <span className="hero-title-line hero-title-line-top">
                  {t('hero.title.line1')}
                </span>
                <span className="hero-title-line hero-title-line-bottom">
                  {t('hero.title.line2')}
                </span>
              </h1>

              <p className="hero-subtitle">{t('hero.subtitle')}</p>

              <div className="hero-actions">
                <button type="button" className="btn-primary">
                  {t('hero.cta.primary')}
                </button>
                <button type="button" className="btn-ghost">
                  {t('hero.cta.secondary')}
                </button>
              </div>

              <div className="hero-meta">
                <div className="meta-item">
                  <span className="meta-label">{t('meta.path')}</span>
                  <span className="meta-value">{t('meta.path.value')}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('meta.mode')}</span>
                  <span className="meta-value">{t('meta.mode.value')}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">{t('meta.status')}</span>
                  <span className="meta-value meta-value-pill">
                    {t('meta.status.value')}
                  </span>
                </div>
              </div>
            </div>

            {/* Rechte Seite: Karten + großer Jakobsmuschel-Ghost */}
            <div className="hero-visual" aria-hidden="true">
              <div className="hero-shell-ghost">
                <CaminoShellIcon className="hero-shell-icon" />
              </div>

              <div className="hero-card hero-card-top">
                <div className="hero-card-label">{t('hero.card.pilgrimLabel')}</div>
                <div className="hero-card-title">
                  {t('hero.card.pilgrimTitle')}
                </div>
                <ul className="hero-card-list">
                  <li>{t('hero.card.pilgrimPoint1')}</li>
                  <li>{t('hero.card.pilgrimPoint2')}</li>
                  <li>{t('hero.card.pilgrimPoint3')}</li>
                </ul>
                <div className="hero-card-foot">
                  <span className="hero-chip hero-chip-yellow">
                    {t('hero.card.pilgrimChip')}
                  </span>
                </div>
              </div>

              <div className="hero-card hero-card-bottom">
                <div className="hero-card-label hero-card-label-provider">
                  {t('hero.card.providerLabel')}
                </div>
                <div className="hero-card-title">
                  {t('hero.card.providerTitle')}
                </div>
                <ul className="hero-card-list">
                  <li>{t('hero.card.providerPoint1')}</li>
                  <li>{t('hero.card.providerPoint2')}</li>
                </ul>
                <div className="hero-card-foot">
                  <span className="hero-chip hero-chip-blue">
                    {t('hero.card.providerChip')}
                  </span>
                </div>
              </div>

              <div className="hero-path">
                <div className="hero-path-label">
                  <span className="hero-path-dot" />
                  <span>{t('hero.path.label')}</span>
                </div>
                <div className="hero-path-line">
                  <span className="hero-path-segment hero-path-segment-1" />
                  <span className="hero-path-segment hero-path-segment-2" />
                  <span className="hero-path-segment hero-path-segment-3" />
                </div>
              </div>
            </div>
          </section>

          {/* Section: Für wen? */}
          <section className="section-two">
            <div className="section-card">
              <h2 className="section-title">{t('section.pilgrims.title')}</h2>
              <p className="section-text">{t('section.pilgrims.text')}</p>
              <ul className="section-list">
                <li>{t('section.pilgrims.point1')}</li>
                <li>{t('section.pilgrims.point2')}</li>
                <li>{t('section.pilgrims.point3')}</li>
              </ul>
            </div>
            <div className="section-card">
              <h2 className="section-title">{t('section.providers.title')}</h2>
              <p className="section-text">{t('section.providers.text')}</p>
              <ul className="section-list">
                <li>{t('section.providers.point1')}</li>
                <li>{t('section.providers.point2')}</li>
                <li>{t('section.providers.point3')}</li>
              </ul>
            </div>
          </section>

          {/* Section: Wie funktioniert es? */}
          <section className="section-how">
            <div className="section-how-inner">
              <h2 className="section-title">{t('section.how.title')}</h2>
              <p className="section-text">{t('section.how.text')}</p>
              <div className="how-steps">
                <div className="how-step">
                  <span className="how-step-badge">1</span>
                  <div className="how-step-content">
                    <div className="how-step-title">{t('section.how.step1.title')}</div>
                    <div className="how-step-text">{t('section.how.step1.text')}</div>
                  </div>
                </div>
                <div className="how-step">
                  <span className="how-step-badge">2</span>
                  <div className="how-step-content">
                    <div className="how-step-title">{t('section.how.step2.title')}</div>
                    <div className="how-step-text">{t('section.how.step2.text')}</div>
                  </div>
                </div>
                <div className="how-step">
                  <span className="how-step-badge">3</span>
                  <div className="how-step-content">
                    <div className="how-step-title">{t('section.how.step3.title')}</div>
                    <div className="how-step-text">{t('section.how.step3.text')}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="footer">
          <span className="footer-text">
            © {new Date().getFullYear()} ULTREIA · {t('footer.madeForCamino')}
          </span>
        </footer>
      </div>
    </div>
  );
}

export default App;
