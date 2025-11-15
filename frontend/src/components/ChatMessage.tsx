// frontend/src/components/ChatMessage.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { UserIcon, CpuChipIcon, ClockIcon } from '@heroicons/react/24/solid';
import type { EvidenceItem } from '../types';

// Message type definition
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  evidence?: EvidenceItem[];
  timestamp?: string;
}

// Props for the component
interface ChatMessageProps {
  message: ChatMessage;
}

// Source icon component for evidence items
const SourceIcon: React.FC<{ source: string }> = ({ source }) => {
  const getIconStyle = () => {
    switch (source?.toLowerCase()) {
      case 'slack':
        return { bg: 'var(--primary-color)', text: 'white', label: 'SL' };
      case 'zoom':
        return { bg: '#2D8CFF', text: 'white', label: 'ZM' };
      case 'notion':
        return { bg: '#000000', text: 'white', label: 'N' };
      case 'gmail':
        return { bg: '#EA4335', text: 'white', label: 'G' };
      case 'github':
        return { bg: '#333333', text: 'white', label: 'GH' };
      case 'jira':
        return { bg: '#0052CC', text: 'white', label: 'J' };
      default:
        return { bg: 'var(--surface-light)', text: 'var(--text-primary)', label: 'Link' };
    }
  };

  const style = getIconStyle();

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '24px',
        height: '24px',
        borderRadius: '4px',
        background: style.bg,
        color: style.text,
        fontSize: '0.7rem',
        fontWeight: 'bold',
      }}
      title={source}
    >
      {style.label}
    </span>
  );
};

// Format timestamp helper
const formatTimestamp = (isoString: string | null | undefined): string => {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return 'Invalid Date';
  }
};

const ChatMessageComponent: React.FC<ChatMessageProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '1.5rem',
        animation: 'fadeInUp 0.3s ease-out',
      }}
    >
      {/* Assistant Icon (left side) */}
      {!isUser && (
        <div
          style={{
            flexShrink: 0,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--surface-elevated)',
            border: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: '0.75rem',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <CpuChipIcon style={{ width: '24px', height: '24px', color: 'var(--primary-color)' }} />
        </div>
      )}

      {/* Message Content Container */}
      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '700px', flex: 1 }}>
        {/* Message Bubble */}
        <div
          style={{
            padding: '1rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: isUser ? 'var(--primary-color)' : 'var(--surface-elevated)',
            color: isUser ? 'white' : 'var(--text-primary)',
            border: isUser ? 'none' : '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-md)',
            transition: 'all 0.2s',
            ...(isUser
              ? { borderBottomRightRadius: '4px' }
              : { borderBottomLeftRadius: '4px' }),
          }}
        >
          {isUser ? (
            // Simple text for user messages
            <p
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6',
                wordBreak: 'break-word',
              }}
            >
              {message.content}
            </p>
          ) : (
            // Markdown rendering for assistant messages
            <div className="chat-markdown">
              <ReactMarkdown
                components={{
                  p: ({ children }) => (
                    <p style={{ marginBottom: '0.75rem', lineHeight: '1.6' }}>
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul
                      style={{
                        listStyle: 'disc',
                        paddingLeft: '1.5rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol
                      style={{
                        listStyle: 'decimal',
                        paddingLeft: '1.5rem',
                        marginBottom: '0.75rem',
                      }}
                    >
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li style={{ marginBottom: '0.25rem' }}>{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                      {children}
                    </strong>
                  ),
                  code: ({inline, children }) => {
                    if (inline) {
                      return (
                        <code
                          style={{
                            background: 'var(--surface-light)',
                            color: 'var(--accent-color)',
                            padding: '0.2rem 0.4rem',
                            borderRadius: '4px',
                            fontSize: '0.9em',
                            fontFamily: 'monospace',
                          }}
                        >
                          {children}
                        </code>
                      );
                    }
                    return (
                      <code
                        style={{
                          display: 'block',
                          background: 'var(--surface-light)',
                          color: 'var(--text-primary)',
                          padding: '0.75rem',
                          borderRadius: 'var(--radius-md)',
                          overflowX: 'auto',
                          fontSize: '0.9rem',
                          fontFamily: 'monospace',
                          marginBottom: '0.75rem',
                        }}
                      >
                        {children}
                      </code>
                    );
                  },
                  a: ({ href, children }) => (
                    <a
                      href={href}
                      style={{
                        color: 'var(--primary-color)',
                        textDecoration: 'underline',
                      }}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {children}
                    </a>
                  ),
                  h3: ({ children }) => (
                    <h3
                      style={{
                        fontSize: '1.125rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        marginTop: '1rem',
                      }}
                    >
                      {children}
                    </h3>
                  ),
                  h4: ({ children }) => (
                    <h4
                      style={{
                        fontSize: '1rem',
                        fontWeight: '600',
                        marginBottom: '0.5rem',
                        marginTop: '0.75rem',
                      }}
                    >
                      {children}
                    </h4>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote
                      style={{
                        borderLeft: '4px solid var(--primary-color)',
                        paddingLeft: '1rem',
                        fontStyle: 'italic',
                        margin: '0.75rem 0',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Evidence Section (only for assistant messages) */}
        {!isUser && message.evidence && message.evidence.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <h4
              style={{
                fontSize: '0.75rem',
                fontWeight: '600',
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span
                style={{
                  width: '4px',
                  height: '16px',
                  background: 'var(--primary-color)',
                  borderRadius: '2px',
                }}
              />
              Supporting Evidence ({message.evidence.length})
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {message.evidence.map((item, index) => (
                <div
                  key={item.event_id || index}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.75rem',
                    transition: 'border-color 0.2s',
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--primary-color)')
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = 'var(--border-color)')
                  }
                >
                  {/* Evidence Text */}
                  <p
                    style={{
                      fontSize: '0.875rem',
                      color: 'var(--text-secondary)',
                      fontStyle: 'italic',
                      marginBottom: '0.5rem',
                      lineHeight: '1.5',
                    }}
                  >
                    "{item.text.length > 180 ? `${item.text.substring(0, 180)}...` : item.text}"
                  </p>

                  {/* Evidence Metadata */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      flexWrap: 'wrap',
                    }}
                  >
                    <SourceIcon source={item.source} />
                    <span style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>
                      {item.user_name}
                    </span>
                    <span>•</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <ClockIcon style={{ width: '12px', height: '12px' }} />
                      <span>{formatTimestamp(item.timestamp)}</span>
                    </div>
                    {item.channel && (
                      <>
                        <span>•</span>
                        <span style={{ color: 'var(--text-secondary)' }}>#{item.channel}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional timestamp for message itself */}
        {message.timestamp && (
          <div
            style={{
              marginTop: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
          >
            <ClockIcon style={{ width: '12px', height: '12px' }} />
            <span>{formatTimestamp(message.timestamp)}</span>
          </div>
        )}
      </div>

      {/* User Icon (right side) */}
      {isUser && (
        <div
          style={{
            flexShrink: 0,
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: 'var(--primary-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: '0.75rem',
            transition: 'transform 0.2s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <UserIcon style={{ width: '24px', height: '24px', color: 'white' }} />
        </div>
      )}
    </div>
  );
};

export default ChatMessageComponent;