// frontend/src/components/ChatInput.tsx
import React, { useRef, useEffect } from 'react';
import { PaperAirplaneIcon, ShareIcon, ShieldCheckIcon } from '@heroicons/react/24/solid';

// Define the props this component will accept from its parent
interface ChatInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  includeGraph: boolean;
  onGraphToggle: (value: boolean) => void;
  userRole: 'analyst' | 'admin';
  onRoleToggle: (role: 'analyst' | 'admin') => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  input,
  onInputChange,
  onSubmit,
  isLoading,
  includeGraph,
  onGraphToggle,
  userRole,
  onRoleToggle
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize the textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'; // Reset height
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${scrollHeight}px`;
    }
  }, [input]);

  // Handle 'Enter' key press (and 'Shift+Enter' for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent new line
      if (!isLoading && input.trim()) {
        onSubmit(e);
      }
    }
  };

  return (
    <div style={{ 
      width: '100%', 
      padding: '1rem 1.5rem 1.5rem', 
      background: 'var(--surface)', 
      borderTop: '1px solid var(--border-color)',
      marginTop: 'auto' // Pushes it to the bottom of the flex container
    }}>
      <form
        onSubmit={onSubmit}
        style={{
          maxWidth: '800px',
          margin: '0 auto',
          position: 'relative'
        }}
      >
        {/* Main Input Container */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          padding: '0.75rem 1rem',
          background: 'var(--surface-elevated)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-color)',
          transition: 'border-color 0.2s'
        }}
        onFocusCapture={() => {
          const el = document.querySelector('.input-container-class'); // Or add a class
          if (el) (el as HTMLElement).style.borderColor = 'var(--primary-color)';
        }}
        onBlurCapture={() => {
          const el = document.querySelector('.input-container-class'); // Or add a class
          if (el) (el as HTMLElement).style.borderColor = 'var(--border-color)';
        }}
      >
          <textarea
            ref={textareaRef}
            className="chat-input-textarea" // Add this class for specific styling
            rows={1}
            placeholder={isLoading ? 'Thinking...' : 'Ask anything about your organization...'}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            style={{
              flexGrow: 1,
              background: 'transparent',
              color: 'var(--text-primary)',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontSize: '1rem',
              lineHeight: '1.5',
              maxHeight: '200px',
              overflowY: 'auto',
              paddingRight: '3.5rem', // Space for the button
            }}
          />
          <button
            type="submit"
            disabled={isLoading || input.trim() === ''}
            style={{
              position: 'absolute',
              right: '1rem',
              bottom: '0.75rem',
              width: '32px',
              height: '32px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (isLoading || input.trim() === '') ? 'not-allowed' : 'pointer',
              background: (isLoading || input.trim() === '') ? 'var(--surface-light)' : 'var(--primary-color)',
              color: (isLoading || input.trim() === '') ? 'var(--text-muted)' : 'white',
              border: 'none',
              transition: 'background-color 0.2s ease',
            }}
            title={isLoading ? 'Processing...' : 'Send message (Enter)'}
          >
            {isLoading ? (
              <svg
                style={{
                  animation: 'spin 1s linear infinite',
                  width: '18px',
                  height: '18px',
                }}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <PaperAirplaneIcon style={{ width: '18px', height: '18px' }} />
            )}
          </button>
        </div>

        {/* Options Row */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '1.5rem', 
          marginTop: '0.75rem', 
          padding: '0 0.5rem',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            {/* Graph Context Toggle */}
            <label style={{
              display: 'flex', alignItems: 'center', cursor: 'pointer',
              fontSize: '0.875rem', color: 'var(--text-secondary)',
              transition: 'color 0.2s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <input
                type="checkbox"
                checked={includeGraph}
                onChange={(e) => onGraphToggle(e.target.checked)}
                disabled={isLoading}
                style={{ marginRight: '0.5rem', height: '16px', width: '16px' }}
              />
              <ShareIcon style={{ width: '16px', height: '16px', marginRight: '0.375rem' }} />
              Graph Context
            </label>

            {/* Admin Mode Toggle */}
            <label style={{
              display: 'flex', alignItems: 'center', cursor: 'pointer',
              fontSize: '0.875rem',
              color: userRole === 'admin' ? 'var(--error)' : 'var(--text-secondary)',
              transition: 'color 0.2s'
            }}
              onMouseEnter={(e) => e.currentTarget.style.color = userRole === 'admin' ? 'var(--error)' : 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = userRole === 'admin' ? 'var(--error)' : 'var(--text-secondary)'}
            >
              <input
                type="checkbox"
                checked={userRole === 'admin'}
                onChange={(e) => onRoleToggle(e.target.checked ? 'admin' : 'analyst')}
                disabled={isLoading}
                style={{ marginRight: '0.5rem', height: '16px', width: '16px' }}
              />
              <ShieldCheckIcon style={{ width: '16px', height: '16px', marginRight: '0.375rem' }} />
              Admin Mode
            </label>
          </div>

          {/* Hint Text */}
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Shift+Enter for new line
          </div>
        </div>
      </form>
    </div>
  );
};

export default ChatInput;