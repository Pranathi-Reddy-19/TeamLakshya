// frontend/src/components/QueryInput.tsx
import React, { useState } from 'react';

interface QueryInputProps {
  onSubmit: (query: string, includeGraph: boolean, userRole: 'analyst' | 'admin') => void;
  isLoading: boolean;
}

const QueryInput: React.FC<QueryInputProps> = ({ onSubmit, isLoading }) => {
  const [query, setQuery] = useState('');
  const [includeGraph, setIncludeGraph] = useState(false);
  const [userRole, setUserRole] = useState<'analyst' | 'admin'>('analyst');

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) {
      onSubmit(query.trim(), includeGraph, userRole);
    }
  };

  const exampleQueries = [
    "What decisions were made last week?",
    "Show me pending tasks",
    "What feedback did the team receive?",
    "Who worked on the authentication feature?"
  ];

  const handleExampleClick = (exampleQuery: string) => {
    setQuery(exampleQuery);
  };

  return (
    <div style={{ 
      background: 'var(--surface)',
      borderRadius: 'var(--radius-lg)',
      padding: '2rem',
      border: '1px solid var(--border-color)',
      boxShadow: 'var(--shadow-lg)',
      transition: 'all 0.3s ease'
    }}>
      <form onSubmit={handleSubmit}>
        {/* Textarea with enhanced styling */}
        <div style={{ position: 'relative', marginBottom: '1rem' }}>
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask about decisions, tasks, feedback, or any team conversation..."
            rows={4}
            disabled={isLoading}
            style={{ 
              width: '100%',
              background: 'var(--surface-light)',
              border: '2px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '16px',
              fontSize: '1rem',
              color: 'var(--text-primary)',
              resize: 'vertical',
              minHeight: '120px',
              transition: 'all 0.3s ease',
              boxSizing: 'border-box'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'var(--primary-color)';
              e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'var(--border-color)';
              e.target.style.boxShadow = 'none';
            }}
          />
          {/* Character count */}
          <div style={{ 
            position: 'absolute',
            bottom: '8px',
            right: '12px',
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
            background: 'var(--surface-light)',
            padding: '2px 6px',
            borderRadius: '4px'
          }}>
            {query.length} characters
          </div>
        </div>

        {/* Controls Row */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Graph Context Toggle */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center',
              cursor: 'pointer',
              padding: '8px 12px',
              background: includeGraph ? 'rgba(102, 126, 234, 0.1)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              border: includeGraph ? '1px solid rgba(102, 126, 234, 0.3)' : '1px solid transparent',
              transition: 'all 0.3s ease',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                checked={includeGraph}
                onChange={(e) => setIncludeGraph(e.target.checked)}
                disabled={isLoading}
                style={{ 
                  marginRight: '8px',
                  cursor: 'pointer'
                }}
              />
              <span style={{ 
                fontSize: '0.95rem',
                color: includeGraph ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontWeight: includeGraph ? '600' : '400'
              }}>
                🕸️ Graph Context
              </span>
            </label>

            {/* Admin Role Toggle */}
            <label style={{ 
              display: 'flex', 
              alignItems: 'center',
              cursor: 'pointer',
              padding: '8px 12px',
              background: userRole === 'admin' ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
              borderRadius: 'var(--radius-sm)',
              border: userRole === 'admin' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid transparent',
              transition: 'all 0.3s ease',
              userSelect: 'none'
            }}>
              <input
                type="checkbox"
                checked={userRole === 'admin'}
                onChange={(e) => setUserRole(e.target.checked ? 'admin' : 'analyst')}
                disabled={isLoading}
                style={{ 
                  marginRight: '8px',
                  cursor: 'pointer',
                  accentColor: 'var(--error)'
                }}
              />
              <span style={{ 
                fontSize: '0.95rem',
                color: userRole === 'admin' ? 'var(--error)' : 'var(--text-secondary)',
                fontWeight: userRole === 'admin' ? '600' : '400'
              }}>
                🛡️ Admin Mode (Show PII)
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isLoading || !query.trim()}
            style={{
              minWidth: '180px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {isLoading ? (
              <>
                <span style={{ animation: 'pulse 1.5s infinite' }}>🔍</span>
                Searching...
              </>
            ) : (
              <>
                🔍 Search Context
              </>
            )}
          </button>
        </div>
      </form>

      {/* Example Queries */}
      {!isLoading && !query && (
        <div style={{ 
          marginTop: '1.5rem',
          paddingTop: '1.5rem',
          borderTop: '1px solid var(--border-color)'
        }}>
          <p style={{ 
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            marginBottom: '0.75rem',
            fontWeight: '600'
          }}>
            💡 Try these examples:
          </p>
          <div style={{ 
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem'
          }}>
            {exampleQueries.map((example, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleExampleClick(example)}
                style={{
                  background: 'var(--surface-light)',
                  color: 'var(--text-secondary)',
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-color)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontWeight: '400',
                  boxShadow: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary-color)';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = 'var(--primary-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-light)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                }}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Admin Mode Warning */}
      {userRole === 'admin' && (
        <div style={{
          marginTop: '1rem',
          padding: '0.75rem 1rem',
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <span style={{ fontSize: '1.25rem' }}>⚠️</span>
          <span style={{ 
            fontSize: '0.85rem',
            color: 'var(--error)',
            fontWeight: '500'
          }}>
            Admin mode active: PII and sensitive data will be visible in results
          </span>
        </div>
      )}

      {/* Inline Styles */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default QueryInput;