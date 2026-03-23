import { useNavigate } from 'react-router-dom';
import '../styles/RoleSelection.css';

function RoleSelection() {
  const navigate = useNavigate();

  const handleRoleSelect = (role) => {
    navigate(`/login/${role}`);
  };

  return (
    <div className="role-selection-container">
      <div className="role-selection-card">
        <div className="role-selection-header">
          <div className="logo">
            <span className="logo-icon">$</span>
            <span className="logo-text">eLoan</span>
          </div>
          <h1 className="role-selection-title">Select Your Role</h1>
          <p className="role-selection-subtitle">Choose your access portal to continue</p>
        </div>

        <div className="roles-grid">
          <button
            className="role-card"
            onClick={() => handleRoleSelect('Bookkeeper')}
          >
            <span className="role-card-name">Bookkeeper</span>
          </button>

          <button
            className="role-card"
            onClick={() => handleRoleSelect('Treasurer')}
          >
            <span className="role-card-name">Treasurer</span>
          </button>

          <button
            className="role-card"
            onClick={() => handleRoleSelect('Credit Committee')}
          >
            <span className="role-card-name">Credit Committee</span>
          </button>

          <button
            className="role-card"
            onClick={() => handleRoleSelect('Account Member Officer')}
          >
            <span className="role-card-name">Account Member Officer</span>
          </button>
        </div>

        <div className="role-selection-footer">
          <p className="footer-text">
            eLoan Management System • Staff Access Only
          </p>
        </div>
      </div>
    </div>
  );
}

export default RoleSelection;
