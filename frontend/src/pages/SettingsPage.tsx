// frontend/src/pages/SettingsPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../components/ThemeContext';
import {
  UserCircleIcon,
  SunIcon,
  MoonIcon,
  Cog8ToothIcon,
  ArrowRightOnRectangleIcon,
  ShieldCheckIcon,
  EnvelopeIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';

const SettingsPage: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // State for form inputs
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleProfileUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you would call an API endpoint:
    // api.updateUser({ full_name: fullName }).then(...)
    console.log('Updating profile with name:', fullName);
    setMessage({ type: 'success', text: 'Profile updated successfully!' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, you would call an API endpoint:
    // api.changePassword({ currentPassword, newPassword }).then(...)
    console.log('Changing password...');
    if (newPassword.length < 8) {
       setMessage({ type: 'error', text: 'New password must be at least 8 characters long.' });
       return;
    }
    setMessage({ type: 'success', text: 'Password changed successfully!' });
    setCurrentPassword('');
    setNewPassword('');
    setTimeout(() => setMessage(null), 3000);
  };

  // Helper styles for inputs and buttons (to match your project)
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.75rem',
    fontSize: '0.9rem',
    background: 'var(--surface-light)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    boxSizing: 'border-box', // Ensure padding doesn't break layout
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
    background: 'var(--primary-color)',
    color: 'white',
    padding: '0.75rem',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: 'auto',
    minWidth: '120px',
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Cog8ToothIcon style={{ width: '40px', height: '40px', color: 'var(--text-primary)' }} />
        <div>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Settings
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>
            Manage your account, preferences, and appearance.
          </p>
        </div>
      </header>

      {/* Message Display */}
      {message && (
        <div
          style={{
            padding: '1rem',
            background: message.type === 'success' ? 'var(--success-light)' : 'var(--error-light)',
            color: message.type === 'success' ? 'var(--success)' : 'var(--error)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            marginBottom: '1.5rem',
            fontWeight: 500,
          }}
        >
          {message.text}
        </div>
      )}

      {/* Settings Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        
        {/* Profile Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0' }}>
            <UserCircleIcon style={{ width: '24px', height: '24px' }} />
            My Profile
          </h3>
          <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="email" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>Email Address</label>
              <input
                type="email"
                id="email"
                value={user?.email || 'Loading...'}
                disabled
                style={{ ...inputStyle, background: 'var(--surface)', cursor: 'not-allowed' }}
              />
            </div>
            <div>
              <label htmlFor="fullName" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>Full Name</label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <button type="submit" style={buttonStyle}>
              Save Changes
            </button>
          </form>
        </div>

        {/* Security Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0' }}>
            <ShieldCheckIcon style={{ width: '24px', height: '24px' }} />
            Change Password
          </h3>
          <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <label htmlFor="currentPassword" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>Current Password</label>
              <input
                type="password"
                id="currentPassword"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label htmlFor="newPassword" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.5rem' }}>New Password</label>
              <input
                type="password"
                id="newPassword"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={inputStyle}
              />
            </div>
            <button type="submit" style={buttonStyle}>
              Update Password
            </button>
          </form>
        </div>

        {/* Appearance Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0' }}>
            {theme === 'light' ? 
              <SunIcon style={{ width: '24px', height: '24px' }} /> : 
              <MoonIcon style={{ width: '24px', height: '24px' }} />
            }
            Appearance
          </h3>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Toggle {theme === 'light' ? 'Dark' : 'Light'} Mode</p>
            <button
              onClick={toggleTheme}
              style={{
                background: 'var(--primary-light)',
                color: 'var(--primary-color)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              {theme === 'light' ? 
                <MoonIcon style={{ width: '20px', height: '20px' }} /> :
                <SunIcon style={{ width: '20px', height: '20px' }} />
              }
            </button>
          </div>
        </div>

        {/* Account Actions Card */}
        <div className="card" style={{ padding: '1.5rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: '0 0 1.5rem 0' }}>
            <ArrowRightOnRectangleIcon style={{ width: '24px', height: '24px' }} />
            Account Actions
          </h3>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Log out of your account on this device.
          </p>
          <button
            onClick={logout}
            style={{
              ...buttonStyle,
              background: 'var(--surface-light)',
              color: 'var(--error)',
              border: '1px solid var(--error-light)',
              width: '100%',
            }}
          >
            Log Out
          </button>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: '2rem 0 1rem 0' }}>
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            onClick={() => alert('This action is permanent. Please contact support to proceed.')}
            style={{
              ...buttonStyle,
              background: 'var(--error-light)',
              color: 'var(--error)',
              width: '100%',
            }}
          >
            Delete Account
          </button>
        </div>

      </div>
    </div>
  );
};

export default SettingsPage;