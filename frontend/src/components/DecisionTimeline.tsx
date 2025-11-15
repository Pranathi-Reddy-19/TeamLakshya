// frontend/src/components/DecisionTimeline.tsx
import React, { useState, useMemo } from 'react';
import { 
  TagIcon, 
  CalendarDaysIcon, 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  ChevronDownIcon, 
  ChevronUpIcon,
  BeakerIcon 
} from '@heroicons/react/24/outline';

// Define a simple Decision type for now
interface Decision {
  id: string;
  text: string;
  timestamp: string | null;
  relatedEventId?: string;
  source?: string;
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
}

interface DecisionTimelineProps {
  decisions: Decision[];
  isLoading?: boolean;
  onSimulateClick?: (decisionId: string, decisionText: string) => void;
}

const DecisionTimeline: React.FC<DecisionTimelineProps> = ({ decisions, isLoading, onSimulateClick }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [expandedDecisions, setExpandedDecisions] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);

  const formatTimestamp = (isoString: string | null): string => {
    if (!isoString) return 'Date unknown';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Invalid Date';
    }
  };

  const getRelativeTime = (isoString: string | null): string => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 7) return `${diffDays} days ago`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
      if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
      return `${Math.floor(diffDays / 365)} years ago`;
    } catch {
      return '';
    }
  };

  // Extract unique sources
  const uniqueSources = useMemo(() => {
    const sources = new Set(decisions.map(d => d.source).filter(Boolean) as string[]);
    return ['all', ...Array.from(sources)];
  }, [decisions]);

  // Filter and sort decisions
  const filteredAndSortedDecisions = useMemo(() => {
    let filtered = decisions.filter(decision => {
      const matchesSearch = decision.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          decision.source?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = selectedSource === 'all' || decision.source === selectedSource;
      return matchesSearch && matchesSource;
    });

    return filtered.sort((a, b) => {
      const dateA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const dateB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
  }, [decisions, searchQuery, selectedSource, sortOrder]);

  const toggleDecisionExpansion = (id: string) => {
    setExpandedDecisions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return 'var(--primary-color)';
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <h2>⏳ Loading Decisions...</h2>
        {[1, 2, 3].map(i => (
          <div key={i} className="skeleton" style={{ height: '60px', marginBottom: '1rem', width: '80%' }}></div>
        ))}
      </div>
    );
  }

  if (!decisions || decisions.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
        <TagIcon className="w-12 h-12 mx-auto text-gray-500 mb-2" />
        <p style={{ color: 'var(--text-muted)' }}>No decisions found in the current context.</p>
      </div>
    );
  }

  return (
    <div className="card fade-in">
      {/* Header with Search and Filters */}
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <TagIcon className="w-6 h-6" /> Decision Timeline
            <span style={{ 
              fontSize: '0.875rem', 
              color: 'var(--text-muted)', 
              fontWeight: 'normal',
              marginLeft: '0.5rem'
            }}>
              ({filteredAndSortedDecisions.length})
            </span>
          </h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.5rem 1rem',
              background: 'var(--surface-elevated)',
              border: '1px solid var(--border-color)',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              transition: 'all 0.2s'
            }}
          >
            <FunnelIcon className="w-4 h-4" />
            {showFilters ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        {/* Search and Filter Controls */}
        {showFilters && (
          <div style={{ 
            display: 'flex', 
            gap: '1rem', 
            flexWrap: 'wrap',
            padding: '1rem',
            background: 'var(--surface-elevated)',
            borderRadius: '0.5rem',
            animation: 'slideDown 0.3s ease-out'
          }}>
            {/* Search Input */}
            <div style={{ flex: '1 1 300px', position: 'relative' }}>
              <MagnifyingGlassIcon 
                className="w-5 h-5" 
                style={{ 
                  position: 'absolute', 
                  left: '0.75rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} 
              />
              <input
                type="text"
                placeholder="Search decisions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.625rem 0.75rem 0.625rem 2.5rem',
                  border: '1px solid var(--border-color)',
                  borderRadius: '0.5rem',
                  background: 'var(--surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.875rem'
                }}
              />
            </div>

            {/* Source Filter */}
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              style={{
                padding: '0.625rem 0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              {uniqueSources.map(source => (
                <option key={source} value={source}>
                  {source === 'all' ? 'All Sources' : source}
                </option>
              ))}
            </select>

            {/* Sort Order */}
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.625rem 0.75rem',
                border: '1px solid var(--border-color)',
                borderRadius: '0.5rem',
                background: 'var(--surface)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              {sortOrder === 'desc' ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronUpIcon className="w-4 h-4" />}
              {sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>
        )}
      </div>

      {/* Timeline */}
      <div style={{ borderLeft: '2px solid var(--border-color)', paddingLeft: '1.5rem', marginLeft: '0.5rem' }}>
        {filteredAndSortedDecisions.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            No decisions match your filters
          </div>
        ) : (
          filteredAndSortedDecisions.map((decision, index) => {
            const isExpanded = expandedDecisions.has(decision.id);
            const isLongText = decision.text.length > 150;
            
            return (
              <div 
                key={decision.id || index} 
                style={{
                  position: 'relative',
                  marginBottom: '1.5rem',
                  paddingBottom: '1.5rem',
                  borderBottom: index < filteredAndSortedDecisions.length - 1 ? '1px dashed var(--border-color)' : 'none',
                  transition: 'all 0.3s ease',
                  cursor: isLongText ? 'pointer' : 'default'
                }}
                onClick={() => isLongText && toggleDecisionExpansion(decision.id)}
              >
                {/* Timeline Dot with Priority Color */}
                <div style={{
                  position: 'absolute',
                  left: '-1.5rem',
                  top: '4px',
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  background: getPriorityColor(decision.priority),
                  marginLeft: '-7px',
                  border: '2px solid var(--surface)',
                  boxShadow: `0 0 0 3px ${getPriorityColor(decision.priority)}20`,
                  animation: 'pulse 2s infinite'
                }} />

                {/* Metadata Tags */}
                <div style={{ 
                  marginBottom: '0.75rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  flexWrap: 'wrap'
                }}>
                  <span className="metadata-tag" style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <CalendarDaysIcon className="w-4 h-4" /> 
                    {formatTimestamp(decision.timestamp)}
                    {decision.timestamp && (
                      <span style={{ color: 'var(--text-muted)', marginLeft: '0.25rem' }}>
                        · {getRelativeTime(decision.timestamp)}
                      </span>
                    )}
                  </span>
                  {decision.source && (
                    <span className="metadata-tag">
                      Source: {decision.source}
                    </span>
                  )}
                  {decision.priority && (
                    <span 
                      className="metadata-tag" 
                      style={{ 
                        background: `${getPriorityColor(decision.priority)}20`,
                        color: getPriorityColor(decision.priority),
                        borderColor: getPriorityColor(decision.priority)
                      }}
                    >
                      {decision.priority.toUpperCase()}
                    </span>
                  )}
                  {decision.tags?.map(tag => (
                    <span key={tag} className="metadata-tag" style={{ fontSize: '0.75rem' }}>
                      #{tag}
                    </span>
                  ))}
                </div>

                {/* Decision Text */}
                <p style={{ 
                  margin: 0, 
                  color: 'var(--text-primary)', 
                  fontSize: '1rem',
                  lineHeight: '1.6',
                  overflow: isLongText && !isExpanded ? 'hidden' : 'visible',
                  textOverflow: 'ellipsis',
                  display: isLongText && !isExpanded ? '-webkit-box' : 'block',
                  WebkitLineClamp: isLongText && !isExpanded ? 3 : 'unset',
                  WebkitBoxOrient: 'vertical'
                }}>
                  {decision.text}
                </p>

                {/* Expand/Collapse Indicator */}
                {isLongText && (
                  <div style={{ 
                    marginTop: '0.5rem', 
                    fontSize: '0.875rem', 
                    color: 'var(--primary-color)',
                    fontWeight: '500'
                  }}>
                    {isExpanded ? '▲ Show less' : '▼ Read more'}
                  </div>
                )}

                {/* Simulate Button */}
                {onSimulateClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent card click if button is clicked
                      onSimulateClick(decision.id, decision.text);
                    }}
                    style={{
                      marginTop: '0.75rem',
                      padding: '0.3rem 0.8rem',
                      fontSize: '0.8rem',
                      background: 'var(--surface-light)',
                      color: 'var(--primary-color)',
                      border: '1px solid var(--primary-color)',
                      borderRadius: '0.375rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    title="Simulate Counterfactual"
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--primary-color)';
                      e.currentTarget.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--surface-light)';
                      e.currentTarget.style.color = 'var(--primary-color)';
                    }}
                  >
                    <BeakerIcon className="w-4 h-4" /> Simulate What-If
                  </button>
                )}

                {/* Related Event Link */}
                {decision.relatedEventId && (
                  <p style={{ 
                    fontSize: '0.8rem', 
                    color: 'var(--text-muted)', 
                    marginTop: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <span>🔗</span> Linked to event: <code style={{ 
                      background: 'var(--surface-elevated)', 
                      padding: '0.125rem 0.375rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem'
                    }}>{decision.relatedEventId}</code>
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add inline styles for animations */}
      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default DecisionTimeline;