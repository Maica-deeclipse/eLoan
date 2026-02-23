import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RoleSelection from './pages/RoleSelection';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import SetPassword from './pages/SetPassword';

// Bookkeeper Module
import BookkeeperLayout from './components/bookkeeper/BookkeeperLayout';
import BookkeeperDashboard from './pages/bookkeeper/Dashboard';
import BookkeeperApplications from './pages/bookkeeper/Applications';
import BookkeeperApplicationDetail from './pages/bookkeeper/ApplicationDetail';
import BookkeeperReports from './pages/bookkeeper/Reports';
import BookkeeperNotifications from './pages/bookkeeper/Notifications';
import BookkeeperSettings from './pages/bookkeeper/Settings';

// Treasurer Module
import TreasurerLayout from './components/treasurer/TreasurerLayout';
import TreasurerDashboard from './pages/treasurer/Dashboard';
import TreasurerForwardedApplications from './pages/treasurer/ForwardedApplications';
import TreasurerEvaluateApplication from './pages/treasurer/EvaluateApplication';
import TreasurerPaymentRecords from './pages/treasurer/PaymentRecords';
import TreasurerLoanMonitoring from './pages/treasurer/LoanMonitoring';
import TreasurerReports from './pages/treasurer/Reports';
import TreasurerNotifications from './pages/treasurer/Notifications';
import TreasurerSettings from './pages/treasurer/Settings';

// Credit Committee Module
import CreditCommitteeLayout from './components/credit-committee/CreditCommitteeLayout';
import CreditCommitteeDashboard from './pages/credit-committee/Dashboard';
import CreditCommitteeApplications from './pages/credit-committee/Applications';
import CreditCommitteeApplicationDetail from './pages/credit-committee/ApplicationDetail';
import CreditCommitteeDecisionHistory from './pages/credit-committee/DecisionHistory';
import CreditCommitteeReports from './pages/credit-committee/Reports';
import CreditCommitteeNotifications from './pages/credit-committee/Notifications';
import CreditCommitteeSettings from './pages/credit-committee/Settings';

function App() {
  return (
    <Router>
      <Routes>
        {/* Role Selection (Home) */}
        <Route path="/" element={<RoleSelection />} />

        {/* Authentication Routes */}
        <Route path="/login/:role" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/set-password/:uid/:token" element={<SetPassword />} />

        {/* Bookkeeper Module */}
        <Route path="/bookkeeper" element={<BookkeeperLayout />}>
          <Route index element={<Navigate to="/bookkeeper/dashboard" replace />} />
          <Route path="dashboard" element={<BookkeeperDashboard />} />
          <Route path="applications" element={<BookkeeperApplications />} />
          <Route path="applications/:id" element={<BookkeeperApplicationDetail />} />
          <Route path="reports" element={<BookkeeperReports />} />
          <Route path="notifications" element={<BookkeeperNotifications />} />
          <Route path="settings" element={<BookkeeperSettings />} />
        </Route>

        {/* Treasurer Module */}
        <Route path="/treasurer" element={<TreasurerLayout />}>
          <Route index element={<Navigate to="/treasurer/dashboard" replace />} />
          <Route path="dashboard" element={<TreasurerDashboard />} />
          <Route path="applications" element={<TreasurerForwardedApplications />} />
          <Route path="applications/:id" element={<TreasurerEvaluateApplication />} />
          <Route path="payments" element={<TreasurerPaymentRecords />} />
          <Route path="monitoring" element={<TreasurerLoanMonitoring />} />
          <Route path="reports" element={<TreasurerReports />} />
          <Route path="notifications" element={<TreasurerNotifications />} />
          <Route path="settings" element={<TreasurerSettings />} />
        </Route>

        {/* Credit Committee Module */}
        <Route path="/credit-committee" element={<CreditCommitteeLayout />}>
          <Route index element={<Navigate to="/credit-committee/dashboard" replace />} />
          <Route path="dashboard" element={<CreditCommitteeDashboard />} />
          <Route path="applications" element={<CreditCommitteeApplications />} />
          <Route path="applications/:id" element={<CreditCommitteeApplicationDetail />} />
          <Route path="decisions" element={<CreditCommitteeDecisionHistory />} />
          <Route path="reports" element={<CreditCommitteeReports />} />
          <Route path="notifications" element={<CreditCommitteeNotifications />} />
          <Route path="settings" element={<CreditCommitteeSettings />} />
        </Route>

        {/* Super Admin - Django admin dashboard at /admindashboard */}
        <Route path="/admin" element={<Navigate to="/admindashboard/" replace />} />
        <Route path="/admin/dashboard" element={<PlaceholderDashboard role="Super Administrator" />} />

        <Route path="/dashboard" element={<PlaceholderDashboard role="Staff" />} />

        {/* Fallback Route */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

// Placeholder Dashboard Component (to be replaced with actual dashboards)
function PlaceholderDashboard({ role }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      padding: '40px'
    }}>
      <div style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '24px',
        padding: '48px',
        maxWidth: '600px',
        textAlign: 'center',
        color: '#333'
      }}>
        <h1 style={{ fontSize: '32px', marginBottom: '16px' }}>Welcome to eLoan!</h1>
        <p style={{ fontSize: '18px', marginBottom: '24px', color: '#666' }}>
          You are logged in as: <strong>{role}</strong>
        </p>
        <p style={{ fontSize: '14px', color: '#999' }}>
          Dashboard pages will be implemented here.
        </p>
        <button
          onClick={() => {
            localStorage.clear();
            window.location.href = '/';
          }}
          style={{
            marginTop: '32px',
            padding: '12px 32px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '16px',
            fontWeight: '600',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

export default App;
