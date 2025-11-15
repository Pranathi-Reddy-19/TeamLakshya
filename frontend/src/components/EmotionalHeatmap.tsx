// frontend/src/components/EmotionalHeatmap.tsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChartBarIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  CalendarDaysIcon,
  ClockIcon,
  UserGroupIcon,
  ArrowTrendingUpIcon, // CORRECTED
  ArrowTrendingDownIcon, // CORRECTED
  MinusIcon,
  SparklesIcon,
  FunnelIcon,
  ChartPieIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';
import {
  fetchSentimentOverview,
  SentimentOverviewData,
  fetchChannelSentimentSummary,
  ChannelSentimentSummary,
  fetchSentimentTimeline,
  SentimentTimelinePoint
} from '../services/api';

const EmotionalHeatmap: React.FC = () => {
  // State for different data types
  const [overviewData, setOverviewData] = useState<SentimentOverviewData | null>(null);
  const [channelData, setChannelData] = useState<ChannelSentimentSummary[]>([]);
  const [timelineData, setTimelineData] = useState<SentimentTimelinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animateStats, setAnimateStats] = useState(false);
  const [activeView, setActiveView] = useState<'overview' | 'channels' | 'timeline'>('overview');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('7d');
  const [refreshing, setRefreshing] = useState(false);

  // Combined Loading Effect
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      setAnimateStats(false);
      try {
        // Fetch all data concurrently
        const days = parseInt(timeRange.replace('d', ''));
        const [overview, channels, timeline] = await Promise.all([
          fetchSentimentOverview(),
          fetchChannelSentimentSummary(),
          fetchSentimentTimeline(days)
        ]);

        setOverviewData(overview);
        setChannelData(channels);
        setTimelineData(timeline);

        setTimeout(() => setAnimateStats(true), 100);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sentiment data');
        setOverviewData(null);
        setChannelData([]);
        setTimelineData([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [timeRange]);

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const days = parseInt(timeRange.replace('d', ''));
      const [overview, channels, timeline] = await Promise.all([
        fetchSentimentOverview(),
        fetchChannelSentimentSummary(),
        fetchSentimentTimeline(days)
      ]);

      setOverviewData(overview);
      setChannelData(channels);
      setTimelineData(timeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh data');
    } finally {
      setRefreshing(false);
    }
  }, [timeRange]);

  // Derived Metrics
  const totalMessages = useMemo(() => {
    if (!overviewData) return 0;
    const dist = overviewData.sentiment_distribution || { positive: 0, neutral: 0, negative: 0 };
    return (dist.positive || 0) + (dist.neutral || 0) + (dist.negative || 0);
  }, [overviewData]);

  const getPercentage = useCallback((count: number): string => {
    if (totalMessages === 0) return '0.0';
    return ((count / totalMessages) * 100).toFixed(1);
  }, [totalMessages]);

  const getSentimentColor = useCallback((score: number): string => {
    if (score >= 0.3) return '#10b981'; // Green
    if (score <= -0.3) return '#ef4444'; // Red
    return '#6b7280'; // Gray
  }, []);

  const getSentimentLabel = useCallback((score: number): string => {
    if (score >= 0.3) return 'Positive';
    if (score <= -0.3) return 'Negative';
    return 'Neutral';
  }, []);

  const getSentimentEmoji = useCallback((score: number): string => {
    if (score >= 0.5) return '😄';
    if (score >= 0.3) return '🙂';
    if (score >= 0.1) return '😊';
    if (score >= -0.1) return '😐';
    if (score >= -0.3) return '😕';
    return '😟';
  }, []);

  const getTrendIcon = useCallback((trend: string) => {
    if (trend === 'improving') return <ArrowTrendingUpIcon className="w-5 h-5 text-green-500" />;
    if (trend === 'declining') return <ArrowTrendingDownIcon className="w-5 h-5 text-red-500" />;
    return <MinusIcon className="w-5 h-5 text-gray-500" />;
  }, []);

  // Calculate sentiment trend from timeline data
  const sentimentTrend = useMemo(() => {
    if (timelineData.length < 4) return 'stable';
    
    const recentAvg = timelineData.slice(-3).reduce((sum, p) => sum + p.average_score, 0) / 3;
    const olderAvg = timelineData.slice(0, 3).reduce((sum, p) => sum + p.average_score, 0) / 3;
    const change = recentAvg - olderAvg;
    
    if (change > 0.1) return 'improving';
    if (change < -0.1) return 'declining';
    return 'stable';
  }, [timelineData]);

  // Render distribution bar
  const renderDistributionBar = useCallback((positive: number, neutral: number, negative: number, total: number) => {
    if (total === 0) return null;

    const posPercent = (positive / total) * 100;
    const neuPercent = (neutral / total) * 100;
    const negPercent = (negative / total) * 100;

    return (
      <div style={{ 
        display: 'flex', 
        height: '12px', 
        borderRadius: '6px', 
        overflow: 'hidden', 
        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)' 
      }}>
        <div 
          title={`Positive: ${posPercent.toFixed(1)}%`}
          style={{ 
            width: `${posPercent}%`, 
            background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)',
            transition: 'width 0.5s ease-out'
          }} 
        />
        <div 
          title={`Neutral: ${neuPercent.toFixed(1)}%`}
          style={{ 
            width: `${neuPercent}%`, 
            background: 'linear-gradient(90deg, #6b7280 0%, #9ca3af 100%)',
            transition: 'width 0.5s ease-out 0.2s'
          }} 
        />
        <div 
          title={`Negative: ${negPercent.toFixed(1)}%`}
          style={{ 
            width: `${negPercent}%`, 
            background: 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)',
            transition: 'width 0.5s ease-out 0.4s'
          }} 
        />
      </div>
    );
  }, []);

  // Render channel breakdown
  const renderChannelBreakdown = useCallback(() => {
    if (isLoading) {
      return <div className="skeleton" style={{ height: '150px', width: '100%' }}></div>;
    }

    if (channelData.length === 0) {
      return (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          background: 'var(--surface-light)',
          borderRadius: 'var(--radius-md)'
        }}>
          <UserGroupIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No channel data available.</p>
        </div>
      );
    }

    // Sort channels by message count
    const sortedChannels = [...channelData].sort((a, b) => b.message_count - a.message_count);

    return (
      <div style={{ marginTop: '1rem' }}>
        <h3 style={{ 
          fontSize: '1rem', 
          marginBottom: '1rem', 
          color: 'var(--text-secondary)', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem' 
        }}>
          <UserGroupIcon className="w-5 h-5" />
          Sentiment by Channel
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {sortedChannels.map((channel, idx) => {
            const total = channel.positive + channel.neutral + channel.negative;
            
            return (
              <div 
                key={idx}
                style={{
                  padding: '1rem',
                  background: 'var(--surface-light)',
                  borderRadius: 'var(--radius-md)',
                  border: `2px solid ${getSentimentColor(channel.average_score)}30`,
                  transition: 'all 0.2s ease-out',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  marginBottom: '0.75rem' 
                }}>
                  <div style={{ 
                    fontWeight: 600, 
                    fontSize: '0.95rem', 
                    color: 'var(--text-primary)' 
                  }}>
                    {channel.channel}
                  </div>
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '0.5rem',
                    padding: '0.25rem 0.75rem',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius-sm)'
                  }}>
                    <span style={{ fontSize: '1.25rem' }}>
                      {getSentimentEmoji(channel.average_score)}
                    </span>
                    <span style={{ 
                      fontWeight: 700, 
                      color: getSentimentColor(channel.average_score)
                    }}>
                      {channel.average_score.toFixed(2)}
                    </span>
                  </div>
                </div>

                {renderDistributionBar(channel.positive, channel.neutral, channel.negative, total)}

                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-around', 
                  marginTop: '0.75rem',
                  fontSize: '0.8rem',
                  color: 'var(--text-muted)'
                }}>
                  <span>✅ {channel.positive}</span>
                  <span>➖ {channel.neutral}</span>
                  <span>❌ {channel.negative}</span>
                  <span style={{ marginLeft: 'auto', fontWeight: 500 }}>
                    Total: {channel.message_count}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [channelData, isLoading, getSentimentColor, getSentimentEmoji, renderDistributionBar]);

  // Render timeline
  const renderTimeline = useCallback(() => {
    if (isLoading) {
      return <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>;
    }

    if (timelineData.length === 0) {
      return (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          background: 'var(--surface-light)',
          borderRadius: 'var(--radius-md)'
        }}>
          <CalendarDaysIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No timeline data available for this range.</p>
        </div>
      );
    }

    const maxScore = Math.max(...timelineData.map(p => Math.abs(p.average_score)), 0.1);
    const maxMessages = Math.max(...timelineData.map(p => p.message_count), 1);

    return (
      <div style={{ marginTop: '1rem' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: '1rem' 
        }}>
          <h3 style={{ 
            fontSize: '1rem', 
            color: 'var(--text-secondary)', 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            margin: 0 
          }}>
            <CalendarDaysIcon className="w-5 h-5" />
            Sentiment Trend (Last {timeRange.replace('d', '')} Days)
          </h3>
          
          {/* Time Range Selector */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            style={{ 
              fontSize: '0.85rem', 
              padding: '0.5rem 0.75rem',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-color)',
              background: 'var(--surface)',
              cursor: 'pointer'
            }}
            disabled={isLoading}
          >
            <option value="7d">7 Days</option>
            <option value="30d">30 Days</option>
            <option value="90d">90 Days</option>
          </select>
        </div>

        <div style={{ 
          position: 'relative', 
          height: '220px', 
          background: 'var(--surface-light)', 
          borderRadius: 'var(--radius-md)',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: `${Math.max(2, 12 / timelineData.length)}px`
        }}>
          {/* Zero line */}
          <div style={{
            position: 'absolute',
            left: '1rem',
            right: '1rem',
            top: '50%',
            height: '2px',
            background: 'var(--border-color)',
            zIndex: 0
          }} />

          {/* Y-axis labels */}
          <div style={{
            position: 'absolute',
            left: '0.5rem',
            top: '1rem',
            fontSize: '0.7rem',
            color: 'var(--text-muted)'
          }}>
            +
          </div>
          <div style={{
            position: 'absolute',
            left: '0.5rem',
            bottom: '1rem',
            fontSize: '0.7rem',
            color: 'var(--text-muted)'
          }}>
            -
          </div>

          {timelineData.map((point, idx) => {
            const height = (Math.abs(point.average_score) / maxScore) * 45;
            const isPositive = point.average_score >= 0;
            const barOpacity = 0.5 + (point.message_count / maxMessages) * 0.5;
            const date = new Date(point.date);
            const dateLabel = date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            });

            return (
              <div 
                key={idx}
                style={{ 
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  position: 'relative',
                  height: '100%',
                  justifyContent: 'center'
                }}
              >
                <div
                  title={`${dateLabel}\nAvg Score: ${point.average_score.toFixed(3)}\nMessages: ${point.message_count}`}
                  style={{
                    width: '100%',
                    maxWidth: '40px',
                    height: `${height}%`,
                    minHeight: '4px',
                    background: getSentimentColor(point.average_score),
                    borderRadius: '4px 4px 0 0',
                    transition: 'all 0.3s ease-out',
                    cursor: 'pointer',
                    opacity: barOpacity,
                    position: 'absolute',
                    bottom: isPositive ? '50%' : 'auto',
                    top: isPositive ? 'auto' : '50%',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.transform = 'scaleY(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = `${barOpacity}`;
                    e.currentTarget.style.transform = 'scaleY(1)';
                  }}
                />
                
                {/* Date label - show every nth label to avoid crowding */}
                {(timelineData.length <= 14 || idx % Math.ceil(timelineData.length / 14) === 0) && (
                  <div style={{
                    position: 'absolute',
                    bottom: '-25px',
                    fontSize: '0.7rem',
                    color: 'var(--text-muted)',
                    transform: 'rotate(-45deg)',
                    transformOrigin: 'top left',
                    whiteSpace: 'nowrap'
                  }}>
                    {dateLabel}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ 
          fontSize: '0.75rem', 
          color: 'var(--text-muted)', 
          marginTop: '2rem', 
          textAlign: 'center',
          padding: '0.75rem',
          background: 'var(--info-light)',
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '0.5rem'
        }}>
          <InformationCircleIcon className="w-4 h-4" />
          Bar height shows average sentiment. Bar opacity indicates message volume. Hover for details.
        </div>

        {/* Trend indicator */}
        {timelineData.length >= 4 && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'var(--surface-light)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.85rem'
          }}>
            {getTrendIcon(sentimentTrend)}
            <span style={{ color: 'var(--text-secondary)' }}>
              Sentiment is <strong>{sentimentTrend}</strong> over the selected period
            </span>
          </div>
        )}
      </div>
    );
  }, [timelineData, isLoading, timeRange, getSentimentColor, getTrendIcon, sentimentTrend]);

  // Loading state
  if (isLoading && !overviewData) {
    return (
      <div className="card">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ChartBarIcon className="w-6 h-6" /> Emotional Intelligence Dashboard
        </h2>
        <div className="skeleton" style={{ height: '200px', width: '100%', marginBottom: '1rem' }}></div>
        <div className="skeleton" style={{ height: '150px', width: '100%' }}></div>
      </div>
    );
  }

  // Error state
  if (error && !overviewData) {
    return (
      <div className="card error-card fade-in">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)' }}>
          <ExclamationCircleIcon className="w-6 h-6" /> Error Loading Sentiment Data
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>{error}</p>
        <button 
          onClick={handleRefresh} 
          style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
        >
          <ArrowPathIcon className="w-5 h-5" />
          Retry
        </button>
      </div>
    );
  }

  // No data state
  if (!overviewData || totalMessages === 0) {
    return (
      <div className="card fade-in">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ChartBarIcon className="w-6 h-6" /> Emotional Intelligence Dashboard
        </h2>
        <div style={{ 
          padding: '3rem', 
          textAlign: 'center', 
          color: 'var(--text-muted)',
          background: 'var(--surface-light)',
          borderRadius: 'var(--radius-md)',
          marginTop: '1rem'
        }}>
          <SparklesIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No sentiment data available yet.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Process some messages to see emotional insights.
          </p>
        </div>
      </div>
    );
  }

  // Main render with live data
  return (
    <div className="card fade-in">
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        marginBottom: '1.5rem' 
      }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <ChartBarIcon className="w-6 h-6" /> Emotional Intelligence Dashboard
        </h2>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* View Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem', 
            background: 'var(--surface-light)', 
            padding: '0.25rem', 
            borderRadius: 'var(--radius-md)' 
          }}>
            {[
              { id: 'overview', label: 'Overview', icon: ChartPieIcon },
              { id: 'timeline', label: 'Timeline', icon: CalendarDaysIcon },
              { id: 'channels', label: 'Channels', icon: UserGroupIcon }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                style={{
                  padding: '0.5rem 1rem',
                  background: activeView === tab.id ? 'var(--primary-color)' : 'transparent',
                  color: activeView === tab.id ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: activeView === tab.id ? 600 : 400,
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Refresh Data"
          >
            <ArrowPathIcon className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Overview Section */}
      {activeView === 'overview' && (
        <>
          {/* Summary Card */}
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              Overall sentiment based on <strong>{totalMessages.toLocaleString()}</strong> analyzed messages
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              padding: '1.5rem',
              background: `linear-gradient(135deg, ${getSentimentColor(overviewData.average_score)}15 0%, transparent 100%)`,
              border: `2px solid ${getSentimentColor(overviewData.average_score)}30`,
              borderRadius: 'var(--radius-lg)',
              animation: animateStats ? 'scaleIn 0.5s ease-out' : 'none',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <span style={{ fontSize: '4rem', lineHeight: 1 }}>
                {getSentimentEmoji(overviewData.average_score)}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ 
                  fontSize: '2.5rem', 
                  fontWeight: '700', 
                  color: getSentimentColor(overviewData.average_score), 
                  lineHeight: 1,
                  marginBottom: '0.5rem'
                }}>
                  {overviewData.average_score.toFixed(3)}
                </div>
                <div style={{ 
                  fontSize: '1rem', 
                  color: 'var(--text-secondary)', 
                  fontWeight: 500
                }}>
                  {getSentimentLabel(overviewData.average_score)} · Average Sentiment
                </div>
              </div>
              <div style={{ 
                fontSize: '0.85rem', 
                textAlign: 'right', 
                padding: '1rem', 
                background: 'var(--surface-elevated)', 
                borderRadius: 'var(--radius-md)',
                minWidth: '120px'
              }}>
                <div style={{ marginBottom: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Range
                </div>
                <div style={{ 
                  color: getSentimentColor(overviewData.min_score),
                  fontWeight: 600,
                  marginBottom: '0.5rem'
                }}>
                  Min: {overviewData.min_score.toFixed(2)}
                </div>
                <div style={{ 
                  color: getSentimentColor(overviewData.max_score),
                  fontWeight: 600
                }}>
                  Max: {overviewData.max_score.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          {/* Distribution Section */}
          <div>
            <h3 style={{ 
              fontSize: '1rem', 
              marginBottom: '1rem', 
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <FunnelIcon className="w-5 h-5" />
              Sentiment Distribution
            </h3>
            
            {/* Animated Distribution Bar */}
            <div style={{ 
              display: 'flex', 
              height: '20px', 
              borderRadius: 'var(--radius-md)', 
              overflow: 'hidden', 
              marginBottom: '1.5rem', 
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)' 
            }}>
              <div 
                title={`Positive: ${getPercentage(overviewData.sentiment_distribution.positive)}%`}
                style={{ 
                  width: animateStats ? `${getPercentage(overviewData.sentiment_distribution.positive)}%` : '0%', 
                  background: 'linear-gradient(90deg, #10b981 0%, #34d399 100%)', 
                  transition: 'width 1s ease-out 0.3s',
                  cursor: 'pointer'
                }} 
              />
              <div 
                title={`Neutral: ${getPercentage(overviewData.sentiment_distribution.neutral)}%`}
                style={{ 
                  width: animateStats ? `${getPercentage(overviewData.sentiment_distribution.neutral)}%` : '0%', 
                  background: 'linear-gradient(90deg, #6b7280 0%, #9ca3af 100%)', 
                  transition: 'width 1s ease-out 0.6s',
                  cursor: 'pointer'
                }} 
              />
              <div 
                title={`Negative: ${getPercentage(overviewData.sentiment_distribution.negative)}%`}
                style={{ 
                  width: animateStats ? `${getPercentage(overviewData.sentiment_distribution.negative)}%` : '0%', 
                  background: 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)', 
                  transition: 'width 1s ease-out 0.9s',
                  cursor: 'pointer'
                }} 
              />
            </div>

            {/* Enhanced Legend Cards */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
              gap: '1rem' 
            }}>
              {[
                { 
                  label: 'Positive', 
                  count: overviewData.sentiment_distribution.positive, 
                  color: '#10b981', 
                  icon: '😊',
                  gradient: 'linear-gradient(135deg, #10b98120 0%, #34d39920 100%)'
                },
                { 
                  label: 'Neutral', 
                  count: overviewData.sentiment_distribution.neutral, 
                  color: '#6b7280', 
                  icon: '😐',
                  gradient: 'linear-gradient(135deg, #6b728020 0%, #9ca3af20 100%)'
                },
                { 
                  label: 'Negative', 
                  count: overviewData.sentiment_distribution.negative, 
                  color: '#ef4444', 
                  icon: '😟',
                  gradient: 'linear-gradient(135deg, #ef444420 0%, #f8717120 100%)'
                }
              ].map((item) => (
                <div 
                  key={item.label} 
                  style={{ 
                    padding: '1.25rem', 
                    background: item.gradient,
                    borderRadius: 'var(--radius-md)', 
                    border: `2px solid ${item.color}30`, 
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between', 
                    marginBottom: '0.75rem' 
                  }}>
                    <span style={{ fontSize: '2rem', lineHeight: 1 }}>{item.icon}</span>
                    <span style={{ 
                      fontSize: '2rem', 
                      fontWeight: '700', 
                      color: item.color,
                      lineHeight: 1
                    }}>
                      {item.count}
                    </span>
                  </div>
                  <div style={{ 
                    fontSize: '0.9rem', 
                    color: 'var(--text-secondary)', 
                    fontWeight: 600,
                    marginBottom: '0.25rem'
                  }}>
                    {item.label}
                  </div>
                  <div style={{ 
                    fontSize: '1.1rem', 
                    color: item.color, 
                    fontWeight: 700
                  }}>
                    {getPercentage(item.count)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Timeline View */}
      {activeView === 'timeline' && renderTimeline()}

      {/* Channels View */}
      {activeView === 'channels' && renderChannelBreakdown()}

      {/* Inline Styles for Animations */}
      <style>{`
        @keyframes scaleIn {
          from { 
            opacity: 0; 
            transform: scale(0.95); 
          }
          to { 
            opacity: 1; 
            transform: scale(1); 
          }
        }
        
        .skeleton {
          background: linear-gradient(90deg, var(--surface-light) 25%, var(--surface-elevated) 50%, var(--surface-light) 75%);
          background-size: 200% 100%;
          animation: loading 1.5s ease-in-out infinite;
          border-radius: var(--radius-md);
        }
        
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .fade-in {
          animation: scaleIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default EmotionalHeatmap;