// frontend/src/components/ResultsDisplay.tsx
import React from 'react';
import type { QueryResponse, EvidenceItem } from '../types';

interface ResultsDisplayProps {
  results: QueryResponse | null;
  isLoading: boolean;
}

// --- HELPER ICON COMPONENTS ---
const SourceIcon: React.FC<{ source: string }> = ({ source }) => {
  switch (source?.toLowerCase()) {
    case 'slack':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
      );
    case 'zoom':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
        </svg>
      );
  }
};

const SentimentIcon: React.FC<{ label?: 'positive' | 'negative' | 'neutral' }> = ({ label }) => {
  switch (label) {
    case 'positive':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" style={{ color: '#10b981' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
        </svg>
      );
    case 'negative':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" style={{ color: '#ef4444' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      );
    case 'neutral':
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" style={{ color: '#6b7280' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" style={{ color: '#6b7280' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      );
  }
};

const ClockIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const UserIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
  </svg>
);

const ShareIcon: React.FC = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
  </svg>
);

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results, isLoading }) => {

  // --- LOADING STATE ---
  if (isLoading) {
    return (
      <div style={{ 
        textAlign: 'center',
        padding: '3rem',
        animation: 'fadeIn 0.3s ease-out'
      }}>
        <div style={{ 
          display: 'inline-block',
          animation: 'pulse 1.5s infinite'
        }}>
          <div style={{ 
            fontSize: '3rem',
            marginBottom: '1rem'
          }}>
            🔍
          </div>
          <p style={{ 
            color: 'var(--text-secondary)',
            fontSize: '1.1rem'
          }}>
            Searching through your context...
          </p>
        </div>
        
        <div style={{ 
          maxWidth: '800px',
          margin: '2rem auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {[1, 2, 3].map((i) => (
            <div 
              key={i}
              className="skeleton"
              style={{ 
                height: '120px',
                width: '100%',
                borderRadius: 'var(--radius-md)'
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // --- INITIAL/NO RESULTS STATE ---
  if (!results) {
    return (
      <div style={{ 
        textAlign: 'center',
        padding: '4rem 2rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>💬</div>
        <p style={{ fontSize: '1.1rem' }}>
          No search performed yet. Try asking a question above!
        </p>
      </div>
    );
  }

  // --- HELPER FUNCTIONS ---
  const formatTimestamp = (isoString: string | null): string => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', { 
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getScoreColor = (score: number): string => {
    if (score < 0.5) return '#10b981';
    if (score < 1.0) return '#f59e0b';
    return '#ef4444';
  };

  const getScoreLabel = (score: number): string => {
    if (score < 0.5) return 'Highly Relevant';
    if (score < 1.0) return 'Relevant';
    return 'Somewhat Relevant';
  };

  // --- RENDER GRAPH CONTEXT HELPER ---
  const renderGraphContext = (context: EvidenceItem['graph_context']) => {
    if (!context || (!context.related_decisions?.length && !context.related_tasks?.length && !context.related_entities?.length)) {
      return null;
    }

    return (
      <div style={{ 
        background: 'rgba(102, 126, 234, 0.05)',
        padding: '1rem',
        borderRadius: 'var(--radius-md)',
        border: '1px solid rgba(102, 126, 234, 0.2)'
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '0.75rem'
        }}>
          <ShareIcon />
          <strong style={{ 
            color: 'var(--primary-color)',
            fontSize: '0.9rem'
          }}>
            Graph Context
          </strong>
        </div>

        {/* Related Decisions */}
        {context.related_decisions && context.related_decisions.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ 
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
              fontWeight: '600'
            }}>
              📋 Related Decisions:
            </div>
            <div style={{ 
              paddingLeft: '1rem',
              fontSize: '0.85rem',
              color: 'var(--text-primary)'
            }}>
              {context.related_decisions.map((d: any, idx: number) => (
                <div key={idx} style={{ 
                  marginBottom: '0.5rem',
                  paddingLeft: '0.75rem',
                  borderLeft: '2px solid rgba(102, 126, 234, 0.3)',
                  paddingTop: '0.25rem',
                  paddingBottom: '0.25rem'
                }}>
                  • {d.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Tasks */}
        {context.related_tasks && context.related_tasks.length > 0 && (
          <div style={{ marginBottom: '0.75rem' }}>
            <div style={{ 
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
              fontWeight: '600'
            }}>
              ✅ Related Tasks:
            </div>
            <div style={{ 
              paddingLeft: '1rem',
              fontSize: '0.85rem',
              color: 'var(--text-primary)'
            }}>
              {context.related_tasks.map((t: any, idx: number) => (
                <div key={idx} style={{ 
                  marginBottom: '0.5rem',
                  paddingLeft: '0.75rem',
                  borderLeft: '2px solid rgba(102, 126, 234, 0.3)',
                  paddingTop: '0.25rem',
                  paddingBottom: '0.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <span>•</span>
                  <span style={{ flex: '1', minWidth: '150px' }}>{t.text}</span>
                  <span style={{ 
                    background: t.status === 'completed' ? '#10b981' : '#f59e0b',
                    color: 'white',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    textTransform: 'capitalize'
                  }}>
                    {t.status || 'Open'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Related Entities */}
        {context.related_entities && context.related_entities.length > 0 && (
          <div>
            <div style={{ 
              fontSize: '0.85rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
              fontWeight: '600'
            }}>
              🏷️ Related Entities:
            </div>
            <div style={{ 
              paddingLeft: '1rem',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem'
            }}>
              {context.related_entities.map((e: any, idx: number) => (
                <span key={idx} style={{ 
                  background: 'var(--surface-light)',
                  color: 'var(--text-secondary)',
                  padding: '4px 12px',
                  borderRadius: '16px',
                  fontSize: '0.8rem',
                  border: '1px solid var(--border-color)',
                  fontWeight: '500'
                }}>
                  {e.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- MAIN RENDER ---
  return (
    <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
      {/* Query Header */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.5rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>🔎</span>
          <h2 style={{ margin: 0, fontSize: '1.3rem' }}>
            Results for: "{results.query}"
          </h2>
        </div>
        {results.evidence && (
          <p style={{ 
            margin: 0,
            color: 'var(--text-muted)',
            fontSize: '0.9rem'
          }}>
            Found {results.evidence.length} relevant {results.evidence.length === 1 ? 'item' : 'items'}
          </p>
        )}
      </div>

      {/* Answer Summary */}
      <div className="glass-card" style={{
        padding: '2rem',
        marginBottom: '2rem',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ 
          position: 'absolute',
          top: '-50px',
          right: '-50px',
          width: '150px',
          height: '150px',
          background: 'radial-gradient(circle, rgba(102, 126, 234, 0.1) 0%, transparent 70%)',
          borderRadius: '50%'
        }} />
        
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1rem'
        }}>
          <span style={{ fontSize: '1.5rem' }}>💡</span>
          <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>
            Answer Summary
          </h3>
        </div>
        
        <div style={{ 
          color: 'var(--text-primary)',
          fontSize: '1.05rem',
          lineHeight: '1.7',
          whiteSpace: 'pre-wrap',
          position: 'relative'
        }}>
          {results.answer}
        </div>
      </div>

      {/* Evidence Section */}
      {results.evidence && results.evidence.length > 0 && (
        <div>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '1.5rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>📚</span>
            <h3 style={{ margin: 0 }}>
              Evidence ({results.evidence.length})
            </h3>
          </div>

          <div style={{ 
            display: 'grid',
            gap: '1.5rem'
          }}>
            {results.evidence.map((item, index) => (
              <div 
                key={item.event_id || index}
                className="card fade-in"
                style={{ 
                  padding: '1.5rem',
                  animationDelay: `${index * 0.1}s`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem'
                }}
              >
                {/* --- Top Row: Metadata & Score --- */}
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'flex-start', 
                  flexWrap: 'wrap', 
                  gap: '1rem' 
                }}>
                  {/* Left Metadata Tags */}
                  <div style={{ 
                    display: 'flex', 
                    flexWrap: 'wrap', 
                    gap: '0.75rem', 
                    alignItems: 'center' 
                  }}>
                    {/* Source */}
                    <span style={{ 
                      background: 'var(--surface-light)',
                      color: 'var(--text-secondary)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      border: '1px solid var(--border-color)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '500'
                    }}>
                      <SourceIcon source={item.source} />
                      {item.source}
                    </span>
                    
                    {/* Channel */}
                    <span style={{ 
                      background: 'var(--surface-light)',
                      color: 'var(--text-secondary)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      border: '1px solid var(--border-color)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '500'
                    }}>
                      💬 {item.channel}
                    </span>
                    
                    {/* User */}
                    <span style={{ 
                      background: 'var(--surface-light)',
                      color: 'var(--text-secondary)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      border: '1px solid var(--border-color)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '500'
                    }}>
                      <UserIcon />
                      {item.user_name}
                    </span>
                    
                    {/* Timestamp */}
                    <span style={{ 
                      background: 'var(--surface-light)',
                      color: 'var(--text-secondary)',
                      padding: '6px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.85rem',
                      border: '1px solid var(--border-color)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontWeight: '500'
                    }}>
                      <ClockIcon />
                      {formatTimestamp(item.timestamp)}
                    </span>
                  </div>

                  {/* Right Score Tag */}
                  <div style={{ 
                    background: 'var(--surface-light)',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: `1px solid ${getScoreColor(item.score)}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <div style={{ 
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: getScoreColor(item.score)
                    }} />
                    <span style={{ 
                      fontSize: '0.85rem',
                      color: getScoreColor(item.score),
                      fontWeight: '600'
                    }}>
                      {getScoreLabel(item.score)}
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem',
                      color: 'var(--text-muted)',
                      marginLeft: '4px'
                    }}>
                      ({item.score.toFixed(3)})
                    </span>
                  </div>
                </div>

                {/* --- Middle Row: Text & Sentiment --- */}
                <div style={{ 
                  display: 'flex', 
                  gap: '1rem', 
                  alignItems: 'flex-start' 
                }}>
                  {/* Sentiment Icon */}
                  <div 
                    style={{ flexShrink: 0, marginTop: '0.25rem' }}
                    title={`Sentiment: ${item.sentiment_label || 'Unknown'} (${item.sentiment_score?.toFixed(3) || 'N/A'})`}
                  >
                    <SentimentIcon label={item.sentiment_label} />
                  </div>
                  
                  {/* Text Content */}
                  <div style={{ 
                    background: 'var(--surface-light)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '3px solid var(--primary-color)',
                    flex: 1
                  }}>
                    <p style={{ 
                      margin: 0,
                      color: 'var(--text-primary)',
                      fontSize: '0.95rem',
                      lineHeight: '1.6',
                      fontStyle: 'italic'
                    }}>
                      "{item.text}"
                    </p>
                  </div>
                </div>

                {/* --- Bottom Row: Graph Context --- */}
                {renderGraphContext(item.graph_context)}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Evidence Found */}
      {results.evidence && results.evidence.length === 0 && !results.metadata?.error && (
        <div className="card" style={{ 
          textAlign: 'center', 
          padding: '3rem' 
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🤷</div>
          <h3 style={{ 
            color: 'var(--text-primary)', 
            marginBottom: '0.5rem' 
          }}>
            No Specific Evidence Found
          </h3>
          <p style={{ color: 'var(--text-muted)' }}>
            Try rephrasing your query or using different keywords.
          </p>
        </div>
      )}

      {/* API Error Display */}
      {results.metadata?.error && (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: 'var(--radius-lg)',
          padding: '1.5rem',
          marginTop: '1rem'
        }}>
          <div style={{ 
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            color: '#ef4444'
          }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <strong>Error fetching results</strong>
          </div>
          <p style={{ 
            margin: '0.5rem 0 0 2.25rem',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem'
          }}>
            Could not connect to the API or an error occurred.
            {results.answer && (
              <>
                <br />
                <i>{results.answer}</i>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default ResultsDisplay;