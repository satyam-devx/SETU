// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — APP ROOT
//
// Changes in this version:
//  1. All portal page components converted to React.lazy() so each
//     portal's JS chunk is only fetched when the user first navigates
//     there. Auth + onboarding routes stay eager (tiny, always needed).
//  2. Each portal is wrapped in its own <Suspense> with a shared
//     <PortalFallback> spinner so the rest of the app never blocks.
//
// Preserved from previous version:
//  - /auth/callback route for Google OAuth session exchange
//  - AuthStoreBridge syncing AuthContext → SetuStore
//  - /onboarding/register, /role-error routes
// ═══════════════════════════════════════════════════════════

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import ScrollToTop from './components/ScrollToTop';
import { CartProvider } from '@/lib/cartContext';
import { SetuStoreProvider, useStore } from '@/lib/store';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { PermissionsProvider } from '@/lib/permissions';
import { FeatureFlagsProvider } from '@/lib/featureFlags';
import { SettingsProvider } from '@/lib/settings';
import { VillageProvider } from '@/lib/village';
import ProtectedRoute from '@/components/ProtectedRoute';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import MaintenanceBanner from '@/components/shared/MaintenanceBanner';
import CommandPalette from '@/components/shared/CommandPalette';
import AppBackground from '@/components/shared/AppBackground';
import { isSupabaseConfigured, isDemoModeEnabled } from '@/lib/supabase';

// ── Eager: Auth & onboarding — tiny, always needed first ─
import LoginOTP           from '@/pages/auth/LoginOTP';
import OTPVerify          from '@/pages/auth/OTPVerify';
import AuthCallback       from '@/pages/auth/AuthCallback';
import RoleSelect         from '@/pages/RoleSelect';
import RegisterOnboarding from '@/pages/onboarding/RegisterOnboarding';
import VendorOnboarding   from '@/pages/vendor/VendorOnboarding';
import RiderOnboarding    from '@/pages/onboarding/RiderOnboarding';
import SevaVerification   from '@/pages/onboarding/SevaVerification';

// ── Lazy: Customer portal ─────────────────────────────────
const CustomerLayout        = lazy(() => import('@/pages/customer/CustomerLayout'));
const CustomerHome          = lazy(() => import('@/pages/customer/CustomerHome'));
const CustomerOrders        = lazy(() => import('@/pages/customer/CustomerOrders'));
const CustomerOrderDetail   = lazy(() => import('@/pages/customer/CustomerOrderDetail'));
const CustomerWallet        = lazy(() => import('@/pages/customer/CustomerWallet'));
const CustomerCredit        = lazy(() => import('@/pages/customer/CustomerCredit'));
const CustomerSchemes       = lazy(() => import('@/pages/customer/CustomerSchemes'));
const CustomerVoice         = lazy(() => import('@/pages/customer/CustomerVoice'));
const CustomerOffline       = lazy(() => import('@/pages/customer/CustomerOffline'));
const CustomerLanguage      = lazy(() => import('@/pages/customer/CustomerLanguage'));
const CustomerFraudReport   = lazy(() => import('@/pages/customer/CustomerFraudReport'));
const CustomerTrust         = lazy(() => import('@/pages/customer/CustomerTrust'));
const CustomerProfile       = lazy(() => import('@/pages/customer/CustomerProfile'));
const CustomerNotifications = lazy(() => import('@/pages/customer/CustomerNotifications'));
const CustomerSupport       = lazy(() => import('@/pages/customer/CustomerSupport'));
const CustomerSettings      = lazy(() => import('@/pages/customer/CustomerSettings'));
const CustomerSearch        = lazy(() => import('@/pages/customer/CustomerSearch'));
const CustomerProductDetail = lazy(() => import('@/pages/customer/CustomerProductDetail'));
const CustomerVendorProfile = lazy(() => import('@/pages/customer/CustomerVendorProfile'));
const CustomerCart          = lazy(() => import('@/pages/customer/CustomerCart'));
const CustomerCheckout      = lazy(() => import('@/pages/customer/CustomerCheckout'));
const CustomerVendors       = lazy(() => import('@/pages/customer/CustomerVendors'));
const CustomerAddresses     = lazy(() => import('@/pages/customer/CustomerAddresses'));
const CustomerReferral      = lazy(() => import('@/pages/customer/CustomerReferral'));
const CustomerReorder           = lazy(() => import('@/pages/customer/CustomerReorder'));
const CustomerDataPrivacy       = lazy(() => import('@/pages/customer/CustomerDataPrivacy'));
const CustomerPrivacyPolicy     = lazy(() => import('@/pages/customer/CustomerPrivacyPolicy'));
const CustomerTerms             = lazy(() => import('@/pages/customer/CustomerTerms'));
const CustomerAccountManagement = lazy(() => import('@/pages/customer/CustomerAccountManagement'));

// ── Lazy: Vendor portal ───────────────────────────────────
const VendorLayout    = lazy(() => import('@/pages/vendor/VendorLayout'));
const VendorDashboard = lazy(() => import('@/pages/vendor/VendorDashboard'));
const VendorOrders    = lazy(() => import('@/pages/vendor/VendorOrders'));
const VendorProducts  = lazy(() => import('@/pages/vendor/VendorProducts'));
const VendorProfile   = lazy(() => import('@/pages/vendor/VendorProfile'));
const VendorEarnings  = lazy(() => import('@/pages/vendor/VendorEarnings'));
const VendorAnalytics = lazy(() => import('@/pages/vendor/VendorAnalytics'));
const VendorSettings  = lazy(() => import('@/pages/vendor/VendorSettings'));
const VendorCredit    = lazy(() => import('@/pages/vendor/VendorCredit'));
const VendorCustomers = lazy(() => import('@/pages/vendor/VendorCustomers'));
const VendorAddProduct = lazy(() => import('@/pages/vendor/VendorAddProduct'));

// ── Lazy: Rider portal ────────────────────────────────────
const RiderLayout     = lazy(() => import('@/pages/rider/RiderLayout'));
const RiderDashboard  = lazy(() => import('@/pages/rider/RiderDashboard'));
const RiderDeliveries = lazy(() => import('@/pages/rider/RiderDeliveries'));
const RiderEarnings   = lazy(() => import('@/pages/rider/RiderEarnings'));
const RiderCOD        = lazy(() => import('@/pages/rider/RiderCOD'));
const RiderProfile    = lazy(() => import('@/pages/rider/RiderProfile'));
const RiderSafety     = lazy(() => import('@/pages/rider/RiderSafety'));
const RiderIncentives = lazy(() => import('@/pages/rider/RiderIncentives'));
const RiderSettings   = lazy(() => import('@/pages/rider/RiderSettings'));

// ── Lazy: Seva portal ─────────────────────────────────────
const SevaLayout    = lazy(() => import('@/pages/seva/SevaLayout'));
const SevaDashboard = lazy(() => import('@/pages/seva/SevaDashboard'));
const SevaJobs      = lazy(() => import('@/pages/seva/SevaJobs'));
const SevaJobDetail = lazy(() => import('@/pages/seva/SevaJobDetail'));
const SevaEarnings  = lazy(() => import('@/pages/seva/SevaEarnings'));
const SevaProfile   = lazy(() => import('@/pages/seva/SevaProfile'));
const SevaSchedule  = lazy(() => import('@/pages/seva/SevaSchedule'));
const SevaSettings  = lazy(() => import('@/pages/seva/SevaSettings'));

// ── Lazy: Anchor portal ───────────────────────────────────
const AnchorLayout      = lazy(() => import('@/pages/anchor/AnchorLayout'));
const AnchorDashboard   = lazy(() => import('@/pages/anchor/AnchorDashboard'));
const AnchorVillage     = lazy(() => import('@/pages/anchor/AnchorVillage'));
const AnchorNoticeboard = lazy(() => import('@/pages/anchor/AnchorNoticeboard'));
const AnchorDisputes    = lazy(() => import('@/pages/anchor/AnchorDisputes'));
const AnchorReports     = lazy(() => import('@/pages/anchor/AnchorReports'));
const AnchorKYC         = lazy(() => import('@/pages/anchor/AnchorKYC'));
const AnchorEscalations = lazy(() => import('@/pages/anchor/AnchorEscalations'));

// ── Lazy: Admin portal ────────────────────────────────────
const AdminLayout         = lazy(() => import('@/pages/admin/AdminLayout'));
const AdminDashboard      = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminOrders         = lazy(() => import('@/pages/admin/AdminOrders'));
const AdminVendors        = lazy(() => import('@/pages/admin/AdminVendors'));
const AdminVendorApproval = lazy(() => import('@/pages/admin/AdminVendorApproval'));
const AdminRiders         = lazy(() => import('@/pages/admin/AdminRiders'));
const AdminCash           = lazy(() => import('@/pages/admin/AdminCash'));
const AdminSupport        = lazy(() => import('@/pages/admin/AdminSupport'));
const AdminSevaProviders  = lazy(() => import('@/pages/admin/AdminSevaProviders'));
const AdminVillages       = lazy(() => import('@/pages/admin/AdminVillages'));
const AdminSettings       = lazy(() => import('@/pages/admin/AdminSettings'));
const AdminCustomers      = lazy(() => import('@/pages/admin/AdminCustomers'));
const AdminIncidents      = lazy(() => import('@/pages/admin/AdminIncidents'));
const AdminMonitoring     = lazy(() => import('@/pages/admin/AdminMonitoring'));
const AdminCategories     = lazy(() => import('@/pages/admin/AdminCategories'));
const AdminProducts       = lazy(() => import('@/pages/admin/AdminProducts'));
const AdminCoupons        = lazy(() => import('@/pages/admin/AdminCoupons'));
const AdminBanners        = lazy(() => import('@/pages/admin/AdminBanners'));
const AdminNotifications  = lazy(() => import('@/pages/admin/AdminNotifications'));
const AdminImageModeration= lazy(() => import('@/pages/admin/AdminImageModeration'));
const AdminKYC            = lazy(() => import('@/pages/admin/AdminKYC'));
const AdminAnalytics      = lazy(() => import('@/pages/admin/AdminAnalytics'));
const AdminAuditLog       = lazy(() => import('@/pages/admin/AdminAuditLog'));
const AdminDisputes       = lazy(() => import('@/pages/admin/AdminDisputes'));

// ── Lazy: Super Admin portal ──────────────────────────────
const SuperAdminLayout     = lazy(() => import('@/pages/superadmin/SuperAdminLayout'));
const SuperAdminDashboard  = lazy(() => import('@/pages/superadmin/SuperAdminDashboard'));
const SuperAdminAnalytics  = lazy(() => import('@/pages/superadmin/SuperAdminAnalytics'));
const SuperAdminCredit     = lazy(() => import('@/pages/superadmin/SuperAdminCredit'));
const SuperAdminBlocks     = lazy(() => import('@/pages/superadmin/SuperAdminBlocks'));
const SuperAdminSecurity   = lazy(() => import('@/pages/superadmin/SuperAdminSecurity'));
const SuperAdminAuditLog   = lazy(() => import('@/pages/superadmin/SuperAdminAuditLog'));
const SuperAdminConfig     = lazy(() => import('@/pages/superadmin/SuperAdminConfig'));
const SuperAdminExpansion  = lazy(() => import('@/pages/superadmin/SuperAdminExpansion'));
const SuperAdminCompliance = lazy(() => import('@/pages/superadmin/SuperAdminCompliance'));
const SuperAdminHealth     = lazy(() => import('@/pages/superadmin/SuperAdminHealth'));
const SuperAdminAI         = lazy(() => import('@/pages/superadmin/SuperAdminAI'));
const SuperAdminUsers     = lazy(() => import('@/pages/superadmin/SuperAdminUsers'));
const SuperAdminRoles     = lazy(() => import('@/pages/superadmin/SuperAdminRoles'));
const SuperAdminFeatureFlags = lazy(() => import('@/pages/superadmin/SuperAdminFeatureFlags'));
const SuperAdminFinance   = lazy(() => import('@/pages/superadmin/SuperAdminFinance'));
const SuperAdminDeveloper = lazy(() => import('@/pages/superadmin/SuperAdminDeveloper'));

// ── Portal loading fallback ───────────────────────────────
function PortalFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

// ── AUTH → STORE BRIDGE ───────────────────────────────────
function AuthStoreBridge() {
  const { profile } = useAuth();
  const { dispatch } = useStore();

  useEffect(() => {
    if (profile) {
      dispatch({ type: 'SET_CURRENT_USER', payload: { profile } });
    } else {
      dispatch({ type: 'CLEAR_CURRENT_USER' });
    }
  }, [profile, dispatch]);

  return null;
}

// ── Static pages ─────────────────────────────────────────
function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
      <h1 className="text-4xl font-bold text-foreground">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <a href="/" className="text-primary text-sm underline">Back to SETU</a>
    </div>
  );
}

function RoleError() {
  const { signOut, userRole } = useAuth();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
      <h1 className="text-2xl font-bold text-foreground">Access Error</h1>
      <p className="text-muted-foreground text-sm text-center max-w-xs">
        Your account role ({userRole ?? 'unknown'}) is not recognised. Please contact support.
      </p>
      <button onClick={signOut} className="text-primary text-sm underline">Sign out</button>
    </div>
  );
}

// ── Configuration error screen (CRITICAL-5 fix) ────────────
//
// If the Supabase env vars are missing AND demo mode was not
// explicitly enabled, we used to silently boot the whole app logged
// in as a hardcoded "demo customer" — meaning a real production
// deploy with a broken env-injection step would let real visitors
// browse around as a fake account instead of seeing any error at
// all. We now fail closed: render this screen and never mount
// AuthProvider/the router in that state.
//
// VITE_DEMO_MODE=true is what our own CI/QA workflows set when they
// intentionally test the offline/demo experience — see qa.yml.
function ConfigErrorScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-xl font-semibold text-foreground">SETU isn't configured yet</h1>
        <p className="text-sm text-muted-foreground">
          VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY aren't set for this deployment,
          so the app can't connect to its backend. To prevent showing a fake/demo
          account to real visitors, SETU refuses to start instead of guessing.
        </p>
        <p className="text-xs text-muted-foreground">
          If this is intentional (a local preview or test run), set
          <code className="mx-1 rounded bg-muted px-1 py-0.5">VITE_DEMO_MODE=true</code>
          in your environment.
        </p>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────
function App() {
  if (!isSupabaseConfigured && !isDemoModeEnabled) {
    return <ConfigErrorScreen />;
  }

  return (
    <ErrorBoundary portal="SETU" fallbackRoute="/login">
    <Router basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <PermissionsProvider>
        <FeatureFlagsProvider>
        <SettingsProvider>
        <SetuStoreProvider>
          <AuthStoreBridge />
          <CartProvider>
            <VillageProvider>
            <AppBackground />
            <ScrollToTop />
            <MaintenanceBanner />
            <CommandPalette />
            <Routes>

              {/* ── Public / auth routes (eager) ── */}
              <Route path="/"             element={<RoleSelect />} />
              <Route path="/login"        element={<LoginOTP />} />
              <Route path="/login/verify" element={<OTPVerify />} />
              <Route path="/role-error"   element={<RoleError />} />
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Onboarding — public, users may not yet have a role */}
              <Route path="/onboarding/register" element={<RegisterOnboarding />} />
              <Route path="/onboarding/vendor"   element={<VendorOnboarding />} />
              <Route path="/onboarding/rider"    element={<RiderOnboarding />} />
              <Route path="/onboarding/seva"     element={<SevaVerification />} />

              {/* ── Customer portal ── */}
              <Route path="/customer" element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <Suspense fallback={<PortalFallback />}>
                    <CustomerLayout />
                  </Suspense>
                </ProtectedRoute>
              }>
                <Route index                         element={<Suspense fallback={<PortalFallback />}><CustomerHome /></Suspense>} />
                <Route path="orders"                 element={<Suspense fallback={<PortalFallback />}><CustomerOrders /></Suspense>} />
                <Route path="orders/:orderId"        element={<Suspense fallback={<PortalFallback />}><CustomerOrderDetail /></Suspense>} />
                <Route path="wallet"                 element={<Suspense fallback={<PortalFallback />}><CustomerWallet /></Suspense>} />
                <Route path="credit"                 element={<Suspense fallback={<PortalFallback />}><CustomerCredit /></Suspense>} />
                <Route path="schemes"                element={<Suspense fallback={<PortalFallback />}><CustomerSchemes /></Suspense>} />
                <Route path="voice"                  element={<Suspense fallback={<PortalFallback />}><CustomerVoice /></Suspense>} />
                <Route path="offline"                element={<Suspense fallback={<PortalFallback />}><CustomerOffline /></Suspense>} />
                <Route path="language"               element={<Suspense fallback={<PortalFallback />}><CustomerLanguage /></Suspense>} />
                <Route path="fraud"                  element={<Suspense fallback={<PortalFallback />}><CustomerFraudReport /></Suspense>} />
                <Route path="trust"                  element={<Suspense fallback={<PortalFallback />}><CustomerTrust /></Suspense>} />
                <Route path="profile"                element={<Suspense fallback={<PortalFallback />}><CustomerProfile /></Suspense>} />
                <Route path="notifications"          element={<Suspense fallback={<PortalFallback />}><CustomerNotifications /></Suspense>} />
                <Route path="support"                element={<Suspense fallback={<PortalFallback />}><CustomerSupport /></Suspense>} />
                <Route path="settings"               element={<Suspense fallback={<PortalFallback />}><CustomerSettings /></Suspense>} />
                <Route path="search"                 element={<Suspense fallback={<PortalFallback />}><CustomerSearch /></Suspense>} />
                <Route path="product/:productId"     element={<Suspense fallback={<PortalFallback />}><CustomerProductDetail /></Suspense>} />
                <Route path="vendor/:vendorId"       element={<Suspense fallback={<PortalFallback />}><CustomerVendorProfile /></Suspense>} />
                <Route path="vendors"                element={<Suspense fallback={<PortalFallback />}><CustomerVendors /></Suspense>} />
                <Route path="cart"                   element={<Suspense fallback={<PortalFallback />}><CustomerCart /></Suspense>} />
                <Route path="checkout"               element={<Suspense fallback={<PortalFallback />}><CustomerCheckout /></Suspense>} />
                <Route path="addresses"              element={<Suspense fallback={<PortalFallback />}><CustomerAddresses /></Suspense>} />
                <Route path="referral"               element={<Suspense fallback={<PortalFallback />}><CustomerReferral /></Suspense>} />
                <Route path="reorder/:orderId"       element={<Suspense fallback={<PortalFallback />}><CustomerReorder /></Suspense>} />
                <Route path="data-privacy"           element={<Suspense fallback={<PortalFallback />}><CustomerDataPrivacy /></Suspense>} />
                <Route path="privacy-policy"         element={<Suspense fallback={<PortalFallback />}><CustomerPrivacyPolicy /></Suspense>} />
                <Route path="terms"                  element={<Suspense fallback={<PortalFallback />}><CustomerTerms /></Suspense>} />
                <Route path="account"                element={<Suspense fallback={<PortalFallback />}><CustomerAccountManagement /></Suspense>} />
              </Route>

              {/* ── Vendor portal ── */}
              <Route path="/vendor" element={
                <ProtectedRoute allowedRoles={['vendor']}>
                  <Suspense fallback={<PortalFallback />}>
                    <VendorLayout />
                  </Suspense>
                </ProtectedRoute>
              }>
                <Route index                 element={<Suspense fallback={<PortalFallback />}><VendorDashboard /></Suspense>} />
                <Route path="orders"         element={<Suspense fallback={<PortalFallback />}><VendorOrders /></Suspense>} />
                <Route path="products"       element={<Suspense fallback={<PortalFallback />}><VendorProducts /></Suspense>} />
                <Route path="products/new"   element={<Suspense fallback={<PortalFallback />}><VendorAddProduct /></Suspense>} />
                <Route path="earnings"       element={<Suspense fallback={<PortalFallback />}><VendorEarnings /></Suspense>} />
                <Route path="analytics"      element={<Suspense fallback={<PortalFallback />}><VendorAnalytics /></Suspense>} />
                <Route path="credit"         element={<Suspense fallback={<PortalFallback />}><VendorCredit /></Suspense>} />
                <Route path="customers"      element={<Suspense fallback={<PortalFallback />}><VendorCustomers /></Suspense>} />
                <Route path="settings"       element={<Suspense fallback={<PortalFallback />}><VendorSettings /></Suspense>} />
                <Route path="profile"        element={<Suspense fallback={<PortalFallback />}><VendorProfile /></Suspense>} />
              </Route>

              {/* ── Rider portal ── */}
              <Route path="/rider" element={
                <ProtectedRoute allowedRoles={['rider']}>
                  <Suspense fallback={<PortalFallback />}>
                    <RiderLayout />
                  </Suspense>
                </ProtectedRoute>
              }>
                <Route index                 element={<Suspense fallback={<PortalFallback />}><RiderDashboard /></Suspense>} />
                <Route path="deliveries"     element={<Suspense fallback={<PortalFallback />}><RiderDeliveries /></Suspense>} />
                <Route path="earnings"       element={<Suspense fallback={<PortalFallback />}><RiderEarnings /></Suspense>} />
                <Route path="cod"            element={<Suspense fallback={<PortalFallback />}><RiderCOD /></Suspense>} />
                <Route path="safety"         element={<Suspense fallback={<PortalFallback />}><RiderSafety /></Suspense>} />
                <Route path="incentives"     element={<Suspense fallback={<PortalFallback />}><RiderIncentives /></Suspense>} />
                <Route path="settings"       element={<Suspense fallback={<PortalFallback />}><RiderSettings /></Suspense>} />
                <Route path="profile"        element={<Suspense fallback={<PortalFallback />}><RiderProfile /></Suspense>} />
              </Route>

              {/* ── Seva portal ── */}
              <Route path="/seva" element={
                <ProtectedRoute allowedRoles={['seva_provider']}>
                  <Suspense fallback={<PortalFallback />}>
                    <SevaLayout />
                  </Suspense>
                </ProtectedRoute>
              }>
                <Route index                 element={<Suspense fallback={<PortalFallback />}><SevaDashboard /></Suspense>} />
                <Route path="jobs"           element={<Suspense fallback={<PortalFallback />}><SevaJobs /></Suspense>} />
                <Route path="jobs/:jobId"    element={<Suspense fallback={<PortalFallback />}><SevaJobDetail /></Suspense>} />
                <Route path="schedule"       element={<Suspense fallback={<PortalFallback />}><SevaSchedule /></Suspense>} />
                <Route path="earnings"       element={<Suspense fallback={<PortalFallback />}><SevaEarnings /></Suspense>} />
                <Route path="settings"       element={<Suspense fallback={<PortalFallback />}><SevaSettings /></Suspense>} />
                <Route path="profile"        element={<Suspense fallback={<PortalFallback />}><SevaProfile /></Suspense>} />
              </Route>

              {/* ── Anchor portal ── */}
              <Route path="/anchor" element={
                <ProtectedRoute allowedRoles={['anchor']}>
                  <Suspense fallback={<PortalFallback />}>
                    <AnchorLayout />
                  </Suspense>
                </ProtectedRoute>
              }>
                <Route index                 element={<Suspense fallback={<PortalFallback />}><AnchorDashboard /></Suspense>} />
                <Route path="village"        element={<Suspense fallback={<PortalFallback />}><AnchorVillage /></Suspense>} />
                <Route path="noticeboard"    element={<Suspense fallback={<PortalFallback />}><AnchorNoticeboard /></Suspense>} />
                <Route path="disputes"       element={<Suspense fallback={<PortalFallback />}><AnchorDisputes /></Suspense>} />
                <Route path="reports"        element={<Suspense fallback={<PortalFallback />}><AnchorReports /></Suspense>} />
                <Route path="kyc"            element={<Suspense fallback={<PortalFallback />}><AnchorKYC /></Suspense>} />
                <Route path="escalations"    element={<Suspense fallback={<PortalFallback />}><AnchorEscalations /></Suspense>} />
              </Route>

              {/* ── Admin portal ── */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                  <Suspense fallback={<PortalFallback />}>
                    <AdminLayout />
                  </Suspense>
                </ProtectedRoute>
              }>
                <Route index                     element={<Suspense fallback={<PortalFallback />}><AdminDashboard /></Suspense>} />
                <Route path="orders"             element={<Suspense fallback={<PortalFallback />}><AdminOrders /></Suspense>} />
                <Route path="vendors"            element={<Suspense fallback={<PortalFallback />}><AdminVendors /></Suspense>} />
                <Route path="vendor-approval"    element={<Suspense fallback={<PortalFallback />}><AdminVendorApproval /></Suspense>} />
                <Route path="riders"             element={<Suspense fallback={<PortalFallback />}><AdminRiders /></Suspense>} />
                <Route path="cash"               element={<Suspense fallback={<PortalFallback />}><AdminCash /></Suspense>} />
                <Route path="support"            element={<Suspense fallback={<PortalFallback />}><AdminSupport /></Suspense>} />
                <Route path="seva-providers"     element={<Suspense fallback={<PortalFallback />}><AdminSevaProviders /></Suspense>} />
                <Route path="villages"           element={<Suspense fallback={<PortalFallback />}><AdminVillages /></Suspense>} />
                <Route path="settings"           element={<Suspense fallback={<PortalFallback />}><AdminSettings /></Suspense>} />
                <Route path="customers"          element={<Suspense fallback={<PortalFallback />}><AdminCustomers /></Suspense>} />
                <Route path="incidents"          element={<Suspense fallback={<PortalFallback />}><AdminIncidents /></Suspense>} />
                <Route path="monitoring"         element={<Suspense fallback={<PortalFallback />}><AdminMonitoring /></Suspense>} />
                <Route path="categories"         element={<Suspense fallback={<PortalFallback />}><AdminCategories /></Suspense>} />
                <Route path="products"           element={<Suspense fallback={<PortalFallback />}><AdminProducts /></Suspense>} />
                <Route path="coupons"            element={<Suspense fallback={<PortalFallback />}><AdminCoupons /></Suspense>} />
                <Route path="banners"            element={<Suspense fallback={<PortalFallback />}><AdminBanners /></Suspense>} />
                <Route path="notifications"      element={<Suspense fallback={<PortalFallback />}><AdminNotifications /></Suspense>} />
                <Route path="image-moderation"   element={<Suspense fallback={<PortalFallback />}><AdminImageModeration /></Suspense>} />
                <Route path="kyc"                element={<Suspense fallback={<PortalFallback />}><AdminKYC /></Suspense>} />
                <Route path="analytics"         element={<Suspense fallback={<PortalFallback />}><AdminAnalytics /></Suspense>} />
                <Route path="audit-log"         element={<Suspense fallback={<PortalFallback />}><AdminAuditLog /></Suspense>} />
                <Route path="disputes"          element={<Suspense fallback={<PortalFallback />}><AdminDisputes /></Suspense>} />
              </Route>

              {/* ── Super Admin portal ── */}
              <Route path="/superadmin" element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <Suspense fallback={<PortalFallback />}>
                    <SuperAdminLayout />
                  </Suspense>
                </ProtectedRoute>
              }>
                <Route index                 element={<Suspense fallback={<PortalFallback />}><SuperAdminDashboard /></Suspense>} />
                <Route path="analytics"      element={<Suspense fallback={<PortalFallback />}><SuperAdminAnalytics /></Suspense>} />
                <Route path="credit"         element={<Suspense fallback={<PortalFallback />}><SuperAdminCredit /></Suspense>} />
                <Route path="blocks"         element={<Suspense fallback={<PortalFallback />}><SuperAdminBlocks /></Suspense>} />
                <Route path="security"       element={<Suspense fallback={<PortalFallback />}><SuperAdminSecurity /></Suspense>} />
                <Route path="audit"          element={<Suspense fallback={<PortalFallback />}><SuperAdminAuditLog /></Suspense>} />
                <Route path="config"         element={<Suspense fallback={<PortalFallback />}><SuperAdminConfig /></Suspense>} />
                <Route path="expansion"      element={<Suspense fallback={<PortalFallback />}><SuperAdminExpansion /></Suspense>} />
                <Route path="compliance"     element={<Suspense fallback={<PortalFallback />}><SuperAdminCompliance /></Suspense>} />
                <Route path="health"         element={<Suspense fallback={<PortalFallback />}><SuperAdminHealth /></Suspense>} />
                <Route path="ai"             element={<Suspense fallback={<PortalFallback />}><SuperAdminAI /></Suspense>} />
                <Route path="users"          element={<Suspense fallback={<PortalFallback />}><SuperAdminUsers /></Suspense>} />
                <Route path="roles"          element={<Suspense fallback={<PortalFallback />}><SuperAdminRoles /></Suspense>} />
                <Route path="feature-flags"  element={<Suspense fallback={<PortalFallback />}><SuperAdminFeatureFlags /></Suspense>} />
                <Route path="finance"        element={<Suspense fallback={<PortalFallback />}><SuperAdminFinance /></Suspense>} />
                <Route path="developer"      element={<Suspense fallback={<PortalFallback />}><SuperAdminDeveloper /></Suspense>} />
              </Route>

              {/* ── Fallbacks ── */}
              <Route path="*" element={<NotFound />} />

            </Routes>
            </VillageProvider>
            <Toaster />
          </CartProvider>
        </SetuStoreProvider>
        </SettingsProvider>
        </FeatureFlagsProvider>
        </PermissionsProvider>
      </AuthProvider>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
