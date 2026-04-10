import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RoleSelection from './pages/RoleSelection';
import Login from './pages/Login';
import SuperAdminLogin from './pages/SuperAdminLogin';
import StaffRegister from './pages/StaffRegister';
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
import TreasurerApplicantLoanHistory from './pages/treasurer/ApplicantLoanHistory';

// Credit Committee Module
import CreditCommitteeLayout from './components/credit-committee/CreditCommitteeLayout';
import CreditCommitteeDashboard from './pages/credit-committee/Dashboard';
import CreditCommitteeApplications from './pages/credit-committee/Applications';
import CreditCommitteeApplicationDetail from './pages/credit-committee/ApplicationDetail';
import CreditCommitteeDecisionHistory from './pages/credit-committee/DecisionHistory';
import CreditCommitteeReports from './pages/credit-committee/Reports';
import CreditCommitteeNotifications from './pages/credit-committee/Notifications';
import CreditCommitteeSettings from './pages/credit-committee/Settings';

// Account Member Officer Module
import AMOLayout from './components/account-member-officer/AMOLayout';
import AMODashboard from './pages/account-member-officer/Dashboard';
import AMOMemberApplications from './pages/account-member-officer/MemberApplications';
import AMOMembers from './pages/account-member-officer/Members';
import AMOSavingsCapital from './pages/account-member-officer/SavingsCapital';
import AMOReports from './pages/account-member-officer/Reports';
import AMOActivityLogs from './pages/account-member-officer/ActivityLogs';
import AMONotifications from './pages/account-member-officer/Notifications';
import AMOSettings from './pages/account-member-officer/Settings';
import AMOEmploymentStatusRequests from './pages/account-member-officer/EmploymentStatusRequests';

// Super Administrator Module
import SuperAdminLayout from './components/superadmin/SuperAdminLayout';
import SuperAdminDashboard from './pages/superadmin/Dashboard';
import SuperAdminNotifications from './pages/superadmin/Notifications';
import SuperAdminStaffApprovals from './pages/superadmin/StaffApprovals';
import SuperAdminMembers from './pages/superadmin/Members';
import SuperAdminViolations from './pages/superadmin/Violations';
import SuperAdminDisciplinaryActions from './pages/superadmin/DisciplinaryActions';
import SuperAdminSettings from './pages/superadmin/Settings';

function App() {
  return (
    <Router>
      <Routes>
        {/* Role Selection (Home) */}
        <Route path="/" element={<RoleSelection />} />

        {/* Superadmin Login (dedicated, not linked from role selection) */}
        <Route path="/superadmin/login" element={<SuperAdminLogin />} />

        {/* Authentication Routes */}
        <Route path="/login/:role" element={<Login />} />
        <Route path="/staff/register" element={<StaffRegister />} />
        <Route path="/staff/register/:role" element={<StaffRegister />} />
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
          <Route path="member-history" element={<TreasurerApplicantLoanHistory />} />
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

        {/* Account Member Officer Module */}
        <Route path="/amo" element={<AMOLayout />}>
          <Route index element={<Navigate to="/amo/dashboard" replace />} />
          <Route path="dashboard" element={<AMODashboard />} />
          <Route path="applications" element={<AMOMemberApplications />} />
          <Route path="members" element={<AMOMembers />} />
          <Route path="savings-capital" element={<AMOSavingsCapital />} />
          <Route path="reports" element={<AMOReports />} />
          <Route path="activity-logs" element={<AMOActivityLogs />} />
          <Route path="notifications" element={<AMONotifications />} />
          <Route path="settings" element={<AMOSettings />} />
          <Route path="employment-status-requests" element={<AMOEmploymentStatusRequests />} />
        </Route>

        {/* Super Administrator Module */}
        <Route path="/superadmin" element={<SuperAdminLayout />}>
          <Route index element={<Navigate to="/superadmin/dashboard" replace />} />
          <Route path="dashboard" element={<SuperAdminDashboard />} />
          <Route path="staff" element={<SuperAdminStaffApprovals />} />
          <Route path="members" element={<SuperAdminMembers />} />
          <Route path="violations" element={<SuperAdminViolations />} />
          <Route path="disciplinary" element={<SuperAdminDisciplinaryActions />} />
          <Route path="notifications" element={<SuperAdminNotifications />} />
          <Route path="settings" element={<SuperAdminSettings />} />
        </Route>

        {/* Legacy admin redirect */}
        <Route path="/admin" element={<Navigate to="/superadmin/dashboard" replace />} />

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
