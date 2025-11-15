// frontend/src/pages/LoginPage.tsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Navigate, Link } from 'react-router-dom';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, token } = useAuth();
  const navigate = useNavigate();

  // If already logged in → go home
  if (token) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login({ username, password });
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid username or password');
      console.error('Login failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .input-focus:focus {
          border-color: #667eea !important;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1) !important;
          outline: none;
        }
        .float-bg-1 {
          animation: float 6s ease-in-out infinite;
        }
        .float-bg-2 {
          animation: float 8s ease-in-out infinite;
          animation-delay: 1s;
        }
      `}</style>

      <div className="float-bg-1" style={styles.bgCircle1} />
      <div className="float-bg-2" style={styles.bgCircle2} />

      <form onSubmit={handleSubmit} style={styles.form}>
        <div style={styles.logoContainer}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </div>

        <h1 style={styles.title}>Context IQ</h1>
        <p style={styles.subtitle}>Welcome back! Sign in to continue</p>

        {error && (
          <div style={styles.error}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <div style={styles.inputGroup}>
          <label style={styles.label}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Username
          </label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="input-focus"
            style={styles.input}
            placeholder="Enter your username"
          />
        </div>

        <div style={styles.inputGroup}>
          <label style={styles.label}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input-focus"
            style={styles.input}
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" disabled={isLoading} style={{
          ...styles.button,
          ...(isLoading ? styles.buttonDisabled : {}),
        }}>
          {isLoading ? (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                <line x1="12" y1="2" x2="12" y2="6" />
                <line x1="12" y1="18" x2="12" y2="22" />
                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
                <line x1="2" y1="12" x2="6" y2="12" />
                <line x1="18" y1="12" x2="22" y2="12" />
                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
              </svg>
              Signing in...
            </>
          ) : (
            <>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              Sign In
            </>
          )}
        </button>

        <div style={styles.divider}>
          <div style={styles.dividerLine} />
          <span style={styles.dividerText}>OR</span>
          <div style={styles.dividerLine} />
        </div>

        <p style={styles.registerText}>
          Don't have an account?{' '}
          <Link to="/register" style={styles.link}>
            Create one now →
          </Link>
        </p>
      </form>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '1rem',
    fontFamily: 'system-ui, sans-serif',
    position: 'relative',
    overflow: 'hidden',
  },
  bgCircle1: {
    position: 'absolute',
    top: '-10%',
    left: '-10%',
    width: '40%',
    height: '40%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)',
    borderRadius: '50%',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: '-15%',
    right: '-15%',
    width: '50%',
    height: '50%',
    background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)',
    borderRadius: '50%',
  },
  form: {
    background: 'white',
    padding: '3rem 2.5rem',
    borderRadius: '24px',
    boxShadow: '0 30px 60px rgba(0,0,0,0.15)',
    width: '100%',
    maxWidth: '440px',
    textAlign: 'center' as const,
    position: 'relative',
    zIndex: 1,
    animation: 'slideIn 0.5s ease-out',
  },
  logoContainer: {
    width: '80px',
    height: '80px',
    margin: '0 auto 1.5rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    borderRadius: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 8px 16px rgba(102, 126, 234, 0.3)',
  },
  title: {
    margin: '0 0 0.5rem',
    fontSize: '2rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    fontWeight: '800',
  },
  subtitle: {
    margin: '0 0 2rem',
    fontSize: '0.95rem',
    color: '#888',
    fontWeight: '500',
  },
  error: {
    background: 'linear-gradient(135deg, #fee 0%, #fdd 100%)',
    color: '#c33',
    padding: '1rem',
    borderRadius: '12px',
    margin: '0 0 1.5rem',
    fontSize: '0.9rem',
    border: '1px solid #fcc',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  inputGroup: {
    marginBottom: '1.25rem',
    textAlign: 'left' as const,
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '0.5rem',
    fontWeight: '600',
    color: '#333',
    fontSize: '0.9rem',
  },
  input: {
    width: '100%',
    padding: '0.85rem 1rem',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    fontSize: '1rem',
    transition: 'all 0.2s ease',
    backgroundColor: '#fafafa',
    boxSizing: 'border-box' as const,
  },
  button: {
    width: '100%',
    padding: '1rem',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '1rem',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  buttonDisabled: {
    background: '#ccc',
    cursor: 'not-allowed',
    boxShadow: 'none',
  },
  divider: {
    margin: '2rem 0 1.5rem',
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  dividerLine: {
    flex: 1,
    height: '1px',
    background: 'linear-gradient(to right, transparent, #ddd, transparent)',
  },
  dividerText: {
    color: '#999',
    fontSize: '0.85rem',
    fontWeight: '500',
  },
  registerText: {
    margin: '0',
    fontSize: '0.95rem',
    color: '#666',
  },
  link: {
    color: '#667eea',
    textDecoration: 'none',
    fontWeight: '700',
  },
};

export default LoginPage;