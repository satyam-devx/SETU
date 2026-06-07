// ═══════════════════════════════════════════════════════════
// SETU PLATFORM — APP ROOT  (production-hardened)
//
// CHANGE IN THIS VERSION:
//  Added /auth/callback route for Google OAuth session exchange.
//
//  WHY:
//  Without a dedicated /auth/callback route, Google OAuth redirects
//  land on / or /login, which immediately navigate away — stripping
//  the #access_token hash before Supabase can exchange it for a session.
//  The AuthCallback component handles the exchange and only navigates
//  after the session is confirmed.
//
// All other fixes from previous version are preserved:
//  1. Router wraps AuthProvider (useNavigate works inside AuthProvider children).
//  2. AuthStoreBridge syncs AuthContext profile into SetuStore.
//  3. /onboarding/register route present (new users don't 404).
//  4. /role-error route present for unknown roles.
// ═══════════════════════════════════════════════════════════

import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from '@/components/ui/toaster';
import ScrollToTop from './components/ScrollToTop';
import { CartProvider } from '@/lib/cartContext';
import { SetuStoreProvider, useStore } from '@/lib/store';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

// Auth
import LoginOTP    from '@/pages/auth/LoginOTP';
import OTPVerify   from '@/pages/auth/OTPVerify';
import AuthCallback from '@/pages/auth/AuthCallback'; // NEW: Google OAuth callback handler

// Role select & Onboarding
import RoleSelect          from '@/pages/RoleSelect';
import RegisterOnboarding  from '@/pages/onboarding/RegisterOnboarding';
import VendorOnboarding    from '@/pages/onboarding/VendorOnboarding';
import RiderOnboarding     from '@/pages/onboarding/RiderOnboarding';
import SevaVerification    from '@/pages/onboarding/SevaVerification';

// Customer
import CustomerLayout        from '@/pages/customer/CustomerLayout';
import CustomerHome          from '@/pages/customer/CustomerHome';
import CustomerOrders        from '@/pages/customer/CustomerOrders';
import CustomerOrderDetail   from '@/pages/customer/CustomerOrderDetail';
import CustomerWallet        from '@/pages/customer/CustomerWallet';
import CustomerCredit        from '@/pages/customer/CustomerCredit';
import CustomerSchemes       from '@/pages/customer/CustomerSchemes';
import CustomerVoice         from '@/pages/customer/CustomerVoice';
import CustomerOffline       from '@/pages/customer/CustomerOffline';
import CustomerLanguage      from '@/pages/customer/CustomerLanguage';
import CustomerFraudReport   from '@/pages/customer/CustomerFraudReport';
import CustomerTrust         from '@/pages/customer/CustomerTrust';
import CustomerProfile       from '@/pages/customer/CustomerProfile';
import CustomerNotifications from '@/pages/customer/CustomerNotifications';
import CustomerSupport       from '@/pages/customer/CustomerSupport';
import CustomerSettings      from '@/pages/customer/CustomerSettings';
import CustomerSearch        from '@/pages/customer/CustomerSearch';
import CustomerProductDetail from '@/pages/customer/CustomerProductDetail';
import CustomerVendorProfile from '@/pages/customer/CustomerVendorProfile';
import CustomerCart          from '@/pages/customer/CustomerCart';
import CustomerCheckout      from '@/pages/customer/CustomerCheckout';
import CustomerVendors       from '@/pages/customer/CustomerVendors';
import CustomerAddresses     from '@/pages/customer/CustomerAddresses';
import CustomerReferral      from '@/pages/customer/CustomerReferral';
import CustomerReorder       from '@/pages/customer/CustomerReorder';

// Vendor
import VendorLayout    from '@/pages/vendor/VendorLayout';
import VendorDashboard from '@/pages/vendor/VendorDashboard';
import VendorOrders    from '@/pages/vendor/VendorOrders';
import VendorProducts  from '@/pages/vendor/VendorProducts';
import VendorProfile   from '@/pages/vendor/VendorProfile';
import VendorEarnings  from '@/pages/vendor/VendorEarnings';
import VendorAnalytics from '@/pages/vendor/VendorAnalytics';
import VendorSettings  from '@/pages/vendor/VendorSettings';
import VendorCredit    from '@/pages/vendor/VendorCredit';
import VendorCustomers from '@/pages/vendor/VendorCustomers';
import VendorAddProduct from '@/pages/vendor/VendorAddProduct';

// Rider
import RiderLayout     from '@/pages/rider/RiderLayout';
import RiderDashboard  from '@/pages/rider/RiderDashboard';
import RiderDeliveries from '@/pages/rider/RiderDeliveries';
import RiderEarnings   from '@/pages/rider/RiderEarnings';
import RiderCOD        from '@/pages/rider/RiderCOD';
import RiderProfile    from '@/pages/rider/RiderProfile';
import RiderSafety     from '@/pages/rider/RiderSafety';
import RiderIncentives from '@/pages/rider/RiderIncentives';
import RiderSettings   from '@/pages/rider/RiderSettings';

// Seva
import SevaLayout    from '@/pages/seva/SevaLayout';
import SevaDashboard from '@/pages/seva/SevaDashboard';
import SevaJobs      from '@/pages/seva/SevaJobs';
import SevaJobDetail from '@/pages/seva/SevaJobDetail';
import SevaEarnings  from '@/pages/seva/SevaEarnings';
import SevaProfile   from '@/pages/seva/SevaProfile';
import SevaSchedule  from '@/pages/seva/SevaSchedule';
import SevaSettings  from '@/pages/seva/SevaSettings';

// Anchor
import AnchorLayout      from '@/pages/anchor/AnchorLayout';
import AnchorDashboard   from '@/pages/anchor/AnchorDashboard';
import AnchorVillage     from '@/pages/anchor/AnchorVillage';
import AnchorNoticeboard from '@/pages/anchor/AnchorNoticeboard';
import AnchorDisputes    from '@/pages/anchor/AnchorDisputes';
import AnchorReports     from '@/pages/anchor/AnchorReports';
import AnchorKYC         from '@/pages/anchor/AnchorKYC';
import AnchorEscalations from '@/pages/anchor/AnchorEscalations';

// Admin
import AdminLayout         from '@/pages/admin/AdminLayout';
import AdminDashboard      from '@/pages/admin/AdminDashboard';
import AdminOrders         from '@/pages/admin/AdminOrders';
import AdminVendors        from '@/pages/admin/AdminVendors';
import AdminVendorApproval from '@/pages/admin/AdminVendorApproval';
import AdminRiders         from '@/pages/admin/AdminRiders';
import AdminCash           from '@/pages/admin/AdminCash';
import AdminSupport        from '@/pages/admin/AdminSupport';
import AdminSevaProviders  from '@/pages/admin/AdminSevaProviders';
import AdminVillages       from '@/pages/admin/AdminVillages';
import AdminSettings       from '@/pages/admin/AdminSettings';
import AdminCustomers      from '@/pages/admin/AdminCustomers';
import AdminIncidents      from '@/pages/admin/AdminIncidents';
import AdminMonitoring     from '@/pages/admin/AdminMonitoring';

// Super Admin
import SuperAdminLayout     from '@/pages/superadmin/SuperAdminLayout';
import SuperAdminDashboard  from '@/pages/superadmin/SuperAdminDashboard';
import SuperAdminAnalytics  from '@/pages/superadmin/SuperAdminAnalytics';
import SuperAdminCredit     from '@/pages/superadmin/SuperAdminCredit';
import SuperAdminBlocks     from '@/pages/superadmin/SuperAdminBlocks';
import SuperAdminSecurity   from '@/pages/superadmin/SuperAdminSecurity';
import SuperAdminAuditLog   from '@/pages/superadmin/SuperAdminAuditLog';
import SuperAdminConfig     from '@/pages/superadmin/SuperAdminConfig';
import SuperAdminExpansion  from '@/pages/superadmin/SuperAdminExpansion';
import SuperAdminCompliance from '@/pages/superadmin/SuperAdminCompliance';
import SuperAdminHealth     from '@/pages/superadmin/SuperAdminHealth';
import SuperAdminAI         from '@/pages/superadmin/SuperAdminAI';

// ── AUTH → STORE BRIDGE ───────────────────────────────────
// Syncs the real authenticated profile into SetuStore so that
// useCurrentUser() returns live data, not the hardcoded FALLBACK_USER.
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

// ── PAGES ─────────────────────────────────────────────────
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
        Your account role ({userRole ?? 'unknown'}) is not recognised.
        Please contact support.
      </p>
      <button onClick={signOut} className="text-primary text-sm underline">Sign out</button>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────
function App() {
  return (
    // Router is the outermost wrapper so any component inside
    // AuthProvider can safely call useNavigate.
    <Router>
      <AuthProvider>
        <SetuStoreProvider>
          <AuthStoreBridge />
          <CartProvider>
            <ScrollToTop />
            <Routes>

              {/* ── Public routes ── */}
              <Route path="/"             element={<RoleSelect />} />
              <Route path="/login"        element={<LoginOTP />} />
              <Route path="/login/verify" element={<OTPVerify />} />
              <Route path="/role-error"   element={<RoleError />} />

              {/* NEW: Google OAuth callback — MUST be public and rendered
                  before any navigation occurs so the token hash is not lost */}
              <Route path="/auth/callback" element={<AuthCallback />} />

              {/* Onboarding — public, users may not yet have a role */}
              <Route path="/onboarding/register" element={<RegisterOnboarding />} />
              <Route path="/onboarding/vendor"   element={<VendorOnboarding />} />
              <Route path="/onboarding/rider"    element={<RiderOnboarding />} />
              <Route path="/onboarding/seva"     element={<SevaVerification />} />

              {/* ── Customer portal ── */}
              <Route path="/customer" element={
                <ProtectedRoute allowedRoles={['customer']}>
                  <CustomerLayout />
                </ProtectedRoute>
              }>
                <Route index                         element={<CustomerHome />} />
                <Route path="orders"                 element={<CustomerOrders />} />
                <Route path="orders/:orderId"        element={<CustomerOrderDetail />} />
                <Route path="wallet"                 element={<CustomerWallet />} />
                <Route path="credit"                 element={<CustomerCredit />} />
                <Route path="schemes"                element={<CustomerSchemes />} />
                <Route path="voice"                  element={<CustomerVoice />} />
                <Route path="offline"                element={<CustomerOffline />} />
                <Route path="language"               element={<CustomerLanguage />} />
                <Route path="fraud"                  element={<CustomerFraudReport />} />
                <Route path="trust"                  element={<CustomerTrust />} />
                <Route path="profile"                element={<CustomerProfile />} />
                <Route path="notifications"          element={<CustomerNotifications />} />
                <Route path="support"                element={<CustomerSupport />} />
                <Route path="settings"               element={<CustomerSettings />} />
                <Route path="search"                 element={<CustomerSearch />} />
                <Route path="product/:productId"     element={<CustomerProductDetail />} />
                <Route path="vendor/:vendorId"       element={<CustomerVendorProfile />} />
                <Route path="vendors"                element={<CustomerVendors />} />
                <Route path="cart"                   element={<CustomerCart />} />
                <Route path="checkout"               element={<CustomerCheckout />} />
                <Route path="addresses"              element={<CustomerAddresses />} />
                <Route path="referral"               element={<CustomerReferral />} />
                <Route path="reorder/:orderId"       element={<CustomerReorder />} />
              </Route>

              {/* ── Vendor portal ── */}
              <Route path="/vendor" element={
                <ProtectedRoute allowedRoles={['vendor']}>
                  <VendorLayout />
                </ProtectedRoute>
              }>
                <Route index                 element={<VendorDashboard />} />
                <Route path="orders"         element={<VendorOrders />} />
                <Route path="products"       element={<VendorProducts />} />
                <Route path="products/new"   element={<VendorAddProduct />} />
                <Route path="earnings"       element={<VendorEarnings />} />
                <Route path="analytics"      element={<VendorAnalytics />} />
                <Route path="credit"         element={<VendorCredit />} />
                <Route path="customers"      element={<VendorCustomers />} />
                <Route path="settings"       element={<VendorSettings />} />
                <Route path="profile"        element={<VendorProfile />} />
              </Route>

              {/* ── Rider portal ── */}
              <Route path="/rider" element={
                <ProtectedRoute allowedRoles={['rider']}>
                  <RiderLayout />
                </ProtectedRoute>
              }>
                <Route index                 element={<RiderDashboard />} />
                <Route path="deliveries"     element={<RiderDeliveries />} />
                <Route path="earnings"       element={<RiderEarnings />} />
                <Route path="cod"            element={<RiderCOD />} />
                <Route path="safety"         element={<RiderSafety />} />
                <Route path="incentives"     element={<RiderIncentives />} />
                <Route path="settings"       element={<RiderSettings />} />
                <Route path="profile"        element={<RiderProfile />} />
              </Route>

              {/* ── Seva portal ── */}
              <Route path="/seva" element={
                <ProtectedRoute allowedRoles={['seva_provider']}>
                  <SevaLayout />
                </ProtectedRoute>
              }>
                <Route index                 element={<SevaDashboard />} />
                <Route path="jobs"           element={<SevaJobs />} />
                <Route path="jobs/:jobId"    element={<SevaJobDetail />} />
                <Route path="schedule"       element={<SevaSchedule />} />
                <Route path="earnings"       element={<SevaEarnings />} />
                <Route path="settings"       element={<SevaSettings />} />
                <Route path="profile"        element={<SevaProfile />} />
              </Route>

              {/* ── Anchor portal ── */}
              <Route path="/anchor" element={
                <ProtectedRoute allowedRoles={['anchor']}>
                  <AnchorLayout />
                </ProtectedRoute>
              }>
                <Route index                 element={<AnchorDashboard />} />
                <Route path="village"        element={<AnchorVillage />} />
                <Route path="noticeboard"    element={<AnchorNoticeboard />} />
                <Route path="disputes"       element={<AnchorDisputes />} />
                <Route path="reports"        element={<AnchorReports />} />
                <Route path="kyc"            element={<AnchorKYC />} />
                <Route path="escalations"    element={<AnchorEscalations />} />
              </Route>

              {/* ── Admin portal ── */}
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['admin']}>
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index                     element={<AdminDashboard />} />
                <Route path="orders"             element={<AdminOrders />} />
                <Route path="vendors"            element={<AdminVendors />} />
                <Route path="vendor-approval"    element={<AdminVendorApproval />} />
                <Route path="riders"             element={<AdminRiders />} />
                <Route path="cash"               element={<AdminCash />} />
                <Route path="support"            element={<AdminSupport />} />
                <Route path="seva-providers"     element={<AdminSevaProviders />} />
                <Route path="villages"           element={<AdminVillages />} />
                <Route path="settings"           element={<AdminSettings />} />
                <Route path="customers"          element={<AdminCustomers />} />
                <Route path="incidents"          element={<AdminIncidents />} />
                <Route path="monitoring"         element={<AdminMonitoring />} />
              </Route>

              {/* ── Super Admin portal ── */}
              <Route path="/superadmin" element={
                <ProtectedRoute allowedRoles={['super_admin']}>
                  <SuperAdminLayout />
                </ProtectedRoute>
              }>
                <Route index                 element={<SuperAdminDashboard />} />
                <Route path="analytics"      element={<SuperAdminAnalytics />} />
                <Route path="credit"         element={<SuperAdminCredit />} />
                <Route path="blocks"         element={<SuperAdminBlocks />} />
                <Route path="security"       element={<SuperAdminSecurity />} />
                <Route path="audit"          element={<SuperAdminAuditLog />} />
                <Route path="config"         element={<SuperAdminConfig />} />
                <Route path="expansion"      element={<SuperAdminExpansion />} />
                <Route path="compliance"     element={<SuperAdminCompliance />} />
                <Route path="health"         element={<SuperAdminHealth />} />
                <Route path="ai"             element={<SuperAdminAI />} />
              </Route>

              {/* ── Fallbacks ── */}
              <Route path="*" element={<NotFound />} />

            </Routes>
            <Toaster />
          </CartProvider>
        </SetuStoreProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
