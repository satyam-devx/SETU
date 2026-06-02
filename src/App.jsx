import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import ScrollToTop from './components/ScrollToTop';
import { CartProvider } from '@/lib/cartContext';

// Role select
import RoleSelect from '@/pages/RoleSelect';

// Onboarding
import VendorOnboarding from '@/pages/onboarding/VendorOnboarding';
import RiderOnboarding from '@/pages/onboarding/RiderOnboarding';
import SevaVerification from '@/pages/onboarding/SevaVerification';

// Customer
import CustomerLayout from '@/pages/customer/CustomerLayout';
import CustomerHome from '@/pages/customer/CustomerHome';
import CustomerOrders from '@/pages/customer/CustomerOrders';
import CustomerOrderDetail from '@/pages/customer/CustomerOrderDetail';
import CustomerWallet from '@/pages/customer/CustomerWallet';
import CustomerCredit from '@/pages/customer/CustomerCredit';
import CustomerSchemes from '@/pages/customer/CustomerSchemes';
import CustomerVoice from '@/pages/customer/CustomerVoice';
import CustomerOffline from '@/pages/customer/CustomerOffline';
import CustomerLanguage from '@/pages/customer/CustomerLanguage';
import CustomerFraudReport from '@/pages/customer/CustomerFraudReport';
import CustomerTrust from '@/pages/customer/CustomerTrust';
import CustomerProfile from '@/pages/customer/CustomerProfile';
import CustomerNotifications from '@/pages/customer/CustomerNotifications';
import CustomerSupport from '@/pages/customer/CustomerSupport';
import CustomerSettings from '@/pages/customer/CustomerSettings';
import CustomerSearch from '@/pages/customer/CustomerSearch';
import CustomerProductDetail from '@/pages/customer/CustomerProductDetail';
import CustomerVendorProfile from '@/pages/customer/CustomerVendorProfile';
import CustomerCart from '@/pages/customer/CustomerCart';
import CustomerCheckout from '@/pages/customer/CustomerCheckout';
import CustomerVendors from '@/pages/customer/CustomerVendors';
import CustomerAddresses from '@/pages/customer/CustomerAddresses';

// Vendor
import VendorLayout from '@/pages/vendor/VendorLayout';
import VendorDashboard from '@/pages/vendor/VendorDashboard';
import VendorOrders from '@/pages/vendor/VendorOrders';
import VendorProducts from '@/pages/vendor/VendorProducts';
import VendorProfile from '@/pages/vendor/VendorProfile';
import VendorEarnings from '@/pages/vendor/VendorEarnings';
import VendorAnalytics from '@/pages/vendor/VendorAnalytics';
import VendorSettings from '@/pages/vendor/VendorSettings';
import VendorCredit from '@/pages/vendor/VendorCredit';
import VendorCustomers from '@/pages/vendor/VendorCustomers';

// Rider
import RiderLayout from '@/pages/rider/RiderLayout';
import RiderDashboard from '@/pages/rider/RiderDashboard';
import RiderDeliveries from '@/pages/rider/RiderDeliveries';
import RiderEarnings from '@/pages/rider/RiderEarnings';
import RiderCOD from '@/pages/rider/RiderCOD';
import RiderProfile from '@/pages/rider/RiderProfile';
import RiderSafety from '@/pages/rider/RiderSafety';
import RiderIncentives from '@/pages/rider/RiderIncentives';
import RiderSettings from '@/pages/rider/RiderSettings';

// Seva
import SevaLayout from '@/pages/seva/SevaLayout';
import SevaDashboard from '@/pages/seva/SevaDashboard';
import SevaJobs from '@/pages/seva/SevaJobs';
import SevaJobDetail from '@/pages/seva/SevaJobDetail';
import SevaEarnings from '@/pages/seva/SevaEarnings';
import SevaProfile from '@/pages/seva/SevaProfile';
import SevaSchedule from '@/pages/seva/SevaSchedule';
import SevaSettings from '@/pages/seva/SevaSettings';

// Anchor
import AnchorLayout from '@/pages/anchor/AnchorLayout';
import AnchorDashboard from '@/pages/anchor/AnchorDashboard';
import AnchorVillage from '@/pages/anchor/AnchorVillage';
import AnchorNoticeboard from '@/pages/anchor/AnchorNoticeboard';
import AnchorDisputes from '@/pages/anchor/AnchorDisputes';
import AnchorReports from '@/pages/anchor/AnchorReports';
import AnchorKYC from '@/pages/anchor/AnchorKYC';
import AnchorEscalations from '@/pages/anchor/AnchorEscalations';

// Admin
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminOrders from '@/pages/admin/AdminOrders';
import AdminVendors from '@/pages/admin/AdminVendors';
import AdminVendorApproval from '@/pages/admin/AdminVendorApproval';
import AdminRiders from '@/pages/admin/AdminRiders';
import AdminCash from '@/pages/admin/AdminCash';
import AdminSupport from '@/pages/admin/AdminSupport';
import AdminSevaProviders from '@/pages/admin/AdminSevaProviders';
import AdminVillages from '@/pages/admin/AdminVillages';
import AdminSettings from '@/pages/admin/AdminSettings';
import AdminCustomers from '@/pages/admin/AdminCustomers';
import AdminIncidents from '@/pages/admin/AdminIncidents';
import AdminMonitoring from '@/pages/admin/AdminMonitoring';

// Super Admin
import SuperAdminLayout from '@/pages/superadmin/SuperAdminLayout';
import SuperAdminDashboard from '@/pages/superadmin/SuperAdminDashboard';
import SuperAdminAnalytics from '@/pages/superadmin/SuperAdminAnalytics';
import SuperAdminCredit from '@/pages/superadmin/SuperAdminCredit';
import SuperAdminBlocks from '@/pages/superadmin/SuperAdminBlocks';
import SuperAdminSecurity from '@/pages/superadmin/SuperAdminSecurity';
import SuperAdminAuditLog from '@/pages/superadmin/SuperAdminAuditLog';
import SuperAdminConfig from '@/pages/superadmin/SuperAdminConfig';
import SuperAdminExpansion from '@/pages/superadmin/SuperAdminExpansion';
import SuperAdminCompliance from '@/pages/superadmin/SuperAdminCompliance';
import SuperAdminHealth from '@/pages/superadmin/SuperAdminHealth';
import SuperAdminAI from '@/pages/superadmin/SuperAdminAI';

function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <h1 className="text-4xl font-bold text-foreground mb-2">404</h1>
      <p className="text-muted-foreground mb-6">Page not found</p>
      <a href="/" className="text-primary underline">Back to SETU</a>
    </div>
  );
}

function App() {
  return (
    <CartProvider>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<RoleSelect />} />

          {/* Onboarding */}
          <Route path="/onboarding/vendor" element={<VendorOnboarding />} />
          <Route path="/onboarding/rider"  element={<RiderOnboarding />} />
          <Route path="/onboarding/seva"   element={<SevaVerification />} />

          {/* Customer */}
          <Route path="/customer" element={<CustomerLayout />}>
            <Route index                          element={<CustomerHome />} />
            <Route path="orders"                  element={<CustomerOrders />} />
            <Route path="orders/:orderId"         element={<CustomerOrderDetail />} />
            <Route path="wallet"                  element={<CustomerWallet />} />
            <Route path="credit"                  element={<CustomerCredit />} />
            <Route path="schemes"                 element={<CustomerSchemes />} />
            <Route path="voice"                   element={<CustomerVoice />} />
            <Route path="offline"                 element={<CustomerOffline />} />
            <Route path="language"                element={<CustomerLanguage />} />
            <Route path="fraud"                   element={<CustomerFraudReport />} />
            <Route path="trust"                   element={<CustomerTrust />} />
            <Route path="profile"                 element={<CustomerProfile />} />
            <Route path="notifications"           element={<CustomerNotifications />} />
            <Route path="support"                 element={<CustomerSupport />} />
            <Route path="settings"                element={<CustomerSettings />} />
            <Route path="search"                  element={<CustomerSearch />} />
            <Route path="product/:productId"      element={<CustomerProductDetail />} />
            <Route path="vendor/:vendorId"        element={<CustomerVendorProfile />} />
            <Route path="vendors"                 element={<CustomerVendors />} />
            <Route path="cart"                    element={<CustomerCart />} />
            <Route path="checkout"                element={<CustomerCheckout />} />
            <Route path="addresses"               element={<CustomerAddresses />} />
          </Route>

          {/* Vendor */}
          <Route path="/vendor" element={<VendorLayout />}>
            <Route index                element={<VendorDashboard />} />
            <Route path="orders"        element={<VendorOrders />} />
            <Route path="products"      element={<VendorProducts />} />
            <Route path="earnings"      element={<VendorEarnings />} />
            <Route path="analytics"     element={<VendorAnalytics />} />
            <Route path="credit"        element={<VendorCredit />} />
            <Route path="customers"     element={<VendorCustomers />} />
            <Route path="settings"      element={<VendorSettings />} />
            <Route path="profile"       element={<VendorProfile />} />
          </Route>

          {/* Rider */}
          <Route path="/rider" element={<RiderLayout />}>
            <Route index                element={<RiderDashboard />} />
            <Route path="deliveries"    element={<RiderDeliveries />} />
            <Route path="earnings"      element={<RiderEarnings />} />
            <Route path="cod"           element={<RiderCOD />} />
            <Route path="safety"        element={<RiderSafety />} />
            <Route path="incentives"    element={<RiderIncentives />} />
            <Route path="settings"      element={<RiderSettings />} />
            <Route path="profile"       element={<RiderProfile />} />
          </Route>

          {/* Seva */}
          <Route path="/seva" element={<SevaLayout />}>
            <Route index                    element={<SevaDashboard />} />
            <Route path="jobs"              element={<SevaJobs />} />
            <Route path="jobs/:jobId"       element={<SevaJobDetail />} />
            <Route path="schedule"          element={<SevaSchedule />} />
            <Route path="earnings"          element={<SevaEarnings />} />
            <Route path="settings"          element={<SevaSettings />} />
            <Route path="profile"           element={<SevaProfile />} />
          </Route>

          {/* Anchor */}
          <Route path="/anchor" element={<AnchorLayout />}>
            <Route index                    element={<AnchorDashboard />} />
            <Route path="village"           element={<AnchorVillage />} />
            <Route path="noticeboard"       element={<AnchorNoticeboard />} />
            <Route path="disputes"          element={<AnchorDisputes />} />
            <Route path="reports"           element={<AnchorReports />} />
            <Route path="kyc"               element={<AnchorKYC />} />
            <Route path="escalations"       element={<AnchorEscalations />} />
          </Route>

          {/* Admin */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index                      element={<AdminDashboard />} />
            <Route path="orders"              element={<AdminOrders />} />
            <Route path="vendors"             element={<AdminVendors />} />
            <Route path="vendor-approval"     element={<AdminVendorApproval />} />
            <Route path="riders"              element={<AdminRiders />} />
            <Route path="cash"                element={<AdminCash />} />
            <Route path="support"             element={<AdminSupport />} />
            <Route path="seva-providers"      element={<AdminSevaProviders />} />
            <Route path="villages"            element={<AdminVillages />} />
            <Route path="settings"            element={<AdminSettings />} />
            <Route path="customers"           element={<AdminCustomers />} />
            <Route path="incidents"           element={<AdminIncidents />} />
            <Route path="monitoring"          element={<AdminMonitoring />} />
          </Route>

          {/* Super Admin */}
          <Route path="/superadmin" element={<SuperAdminLayout />}>
            <Route index                    element={<SuperAdminDashboard />} />
            <Route path="analytics"         element={<SuperAdminAnalytics />} />
            <Route path="credit"            element={<SuperAdminCredit />} />
            <Route path="blocks"            element={<SuperAdminBlocks />} />
            <Route path="security"          element={<SuperAdminSecurity />} />
            <Route path="audit"             element={<SuperAdminAuditLog />} />
            <Route path="config"            element={<SuperAdminConfig />} />
            <Route path="expansion"         element={<SuperAdminExpansion />} />
            <Route path="compliance"        element={<SuperAdminCompliance />} />
            <Route path="health"            element={<SuperAdminHealth />} />
            <Route path="ai"                element={<SuperAdminAI />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </Router>
    </CartProvider>
  );
}

export default App;
