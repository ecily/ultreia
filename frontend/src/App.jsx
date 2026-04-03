import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import { I18nProvider } from './i18n';

import CookieNotice from './components/CookieNotice';

const NDA_ACCEPTED_KEY = 'ultreia_nda_accepted';
const NDA_ACCEPTED_LEGACY_KEY = 'ultreia_ndaa_accepted';

const AddProviderForm = lazy(() => import('./components/AddProviderForm'));
const AddOfferForm = lazy(() => import('./components/AddOfferForm'));
const EditOfferForm = lazy(() => import('./components/EditOfferForm'));
const ProviderDashboard = lazy(() => import('./components/ProviderDashboard'));
const EditProviderForm = lazy(() => import('./components/EditProviderForm'));
const Pitch = lazy(() => import('./pages/Pitch'));
const Register = lazy(() => import('./pages/Register'));
const Login = lazy(() => import('./pages/Login'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const AdminCategoryPage = lazy(() => import('./pages/AdminCategoryPage'));
const AdminOffersMap = lazy(() => import('./pages/AdminOffersMap'));
const WhyUltreia = lazy(() => import('./pages/WhyUltreia'));
const TesterGate = lazy(() => import('./pages/TesterGate'));
const NDA = lazy(() => import('./pages/NDA'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));

function DeepLinkRestore() {
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  React.useLayoutEffect(() => {
    const params = new URLSearchParams(search);
    const redirect = params.get('redirect');
    if (!redirect) return;

    const isSafe = redirect.startsWith('/') && !redirect.startsWith('//');
    if (isSafe && redirect !== pathname) {
      navigate(redirect, { replace: true });
      return;
    }

    params.delete('redirect');
    const nextSearch = params.toString();
    navigate(
      {
        pathname,
        search: nextSearch ? `?${nextSearch}` : '',
        hash,
      },
      { replace: true }
    );
  }, [navigate, pathname, search, hash]);

  return null;
}

function BootGuard() {
  const navigate = useNavigate();
  const { pathname, search } = useLocation();

  React.useLayoutEffect(() => {
    try {
      const hasRedirectHint = new URLSearchParams(search).has('redirect');
      if (hasRedirectHint) return;

      const key = localStorage.getItem('ultreia_tester_key');
      const accepted =
        localStorage.getItem(NDA_ACCEPTED_KEY) === '1' ||
        localStorage.getItem(NDA_ACCEPTED_LEGACY_KEY) === '1';

      if (pathname === '/') {
        if (accepted) {
          navigate('/home', { replace: true });
          return;
        }
        if (key) {
          navigate('/nda', { replace: true });
        }
        return;
      }

      if (pathname === '/nda') {
        if (!key) {
          navigate('/', { replace: true });
          return;
        }
        if (accepted) {
          navigate('/home', { replace: true });
        }
        return;
      }

      if (!key) {
        navigate('/', { replace: true });
        return;
      }

      if (!accepted) {
        navigate('/nda', { replace: true });
      }
    } catch (e) {
      void e;
    }
  }, [navigate, pathname, search]);

  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [pathname]);
  return null;
}

function RouteLoadingFallback() {
  return (
    <div className="sm-page">
      <div className="sm-stack sm-shell grid min-h-[45vh] place-items-center py-10">
        <div className="sm-card px-6 py-4 text-sm text-slate-600">Seite wird geladen ...</div>
      </div>
    </div>
  );
}

const AppRoutes = () => {
  const handleLogin = (providerId) => {
    localStorage.setItem('providerId', providerId);
  };

  return (
    <>
      <DeepLinkRestore />
      <BootGuard />
      <ScrollToTop />
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          <Route path="/" element={<TesterGate />} />
          <Route path="/nda" element={<NDA />} />

          <Route path="/home" element={<LandingPage />} />
          <Route path="/why" element={<WhyUltreia />} />
          <Route path="/pitch" element={<Pitch />} />
          <Route path="/privacy" element={<PrivacyPage />} />

          <Route path="/register" element={<Register onRegisterSuccess={handleLogin} />} />
          <Route path="/login" element={<Login onLoginSuccess={handleLogin} />} />
          <Route path="/add-provider" element={<AddProviderForm />} />
          <Route path="/add-offer/:providerId" element={<AddOfferForm />} />
          <Route path="/edit-offer/:offerId" element={<EditOfferForm />} />
          <Route path="/dashboard/:providerId" element={<ProviderDashboard />} />
          <Route path="/admin/categories" element={<AdminCategoryPage />} />
          <Route path="/admin/offers" element={<AdminOffersMap />} />
          <Route path="/edit-provider/:providerId" element={<EditProviderForm />} />
          <Route path="/edit-provider" element={<EditProviderForm />} />

          <Route
            path="*"
            element={
              <div className="sm-page">
                <div className="sm-stack sm-shell grid min-h-screen place-items-center py-10">
                  <div className="sm-card p-8 text-center">
                    <h1 className="text-3xl font-extrabold">404</h1>
                    <p className="mt-2 text-slate-600">Seite nicht gefunden.</p>
                  </div>
                </div>
              </div>
            }
          />
        </Routes>
      </Suspense>
    </>
  );
};

const App = () => {
  return (
    <HelmetProvider>
      <I18nProvider>
        <Router>
          <AppRoutes />
          <CookieNotice />
        </Router>
      </I18nProvider>
    </HelmetProvider>
  );
};

export default App;

