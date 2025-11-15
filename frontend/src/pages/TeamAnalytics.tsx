// frontend/src/pages/TeamAnalytics.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ChartBarIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  ClockIcon,
  SparklesIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, CartesianGrid
} from 'recharts';
import { fetchPerformanceAnalytics } from '../services/api';
import type { PerformanceAnalyticsResponse } from '../types';

// --- Stat Card Component ---
const StatCard: React.FC<{ title: string; value: string; icon: React.ReactNode; unit?: string }> = 
  ({ title, value, icon, unit }) => (
  <div className="card" style={{ padding: '1.5rem', background: 'var(--surface-light)' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        padding: '0.75rem',
        borderRadius: '50%',
        background: 'var(--primary-light)',
        color: 'var(--primary-color)',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <p style={{ 
          fontSize: '0.9rem', 
          color: 'var(--text-secondary)', 
          margin: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          {title}
        </p>
        <p style={{ 
          fontSize: '1.75rem', 
          fontWeight: 700, 
          color: 'var(--text-primary)', 
          margin: 0,
          display: 'flex',
          alignItems: 'baseline',
          gap: '0.25rem',
          flexWrap: 'wrap'
        }}>
          {value} 
          {unit && (
            <span style={{ 
              fontSize: '1rem', 
              fontWeight: 500, 
              color: 'var(--text-muted)' 
            }}>
              {unit}
            </span>
          )}
        </p>
      </div>
    </div>
  </div>
);

// --- Custom Bar Chart Component ---
const SimpleBarChart: React.FC<{ data: any[]; title: string }> = ({ data, title }) => (
  <div className="card" style={{ padding: '1.5rem', minHeight: '350px' }}>
    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.125rem' }}>
      {title}
    </h3>
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 0, right: 10, left: -10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis 
          dataKey="name" 
          stroke="var(--text-secondary)"
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 12 }} />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem'
          }}
        />
        <Bar dataKey="value" fill="var(--primary-color)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </div>
);

// --- Custom Line Chart Component ---
const SimpleLineChart: React.FC<{ data: any[]; title: string }> = ({ data, title }) => (
  <div className="card" style={{ padding: '1.5rem', minHeight: '350px' }}>
    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)', fontSize: '1.125rem' }}>
      {title}
    </h3>
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 0, right: 10, left: -10, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
        <XAxis 
          dataKey="date" 
          stroke="var(--text-secondary)"
          tick={{ fontSize: 11 }}
          tickFormatter={(tick) => {
            const date = new Date(tick);
            return `${date.getMonth() + 1}/${date.getDate()}`;
          }}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis 
          domain={[-1, 1]} 
          stroke="var(--text-secondary)" 
          tick={{ fontSize: 12 }}
        />
        <Tooltip
          contentStyle={{
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem'
          }}
          labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })}
        />
        <Legend wrapperStyle={{ fontSize: '0.875rem' }} />
        <Line 
          type="monotone" 
          dataKey="average_score" 
          name="Avg Sentiment" 
          stroke="#8884d8" 
          dot={false} 
          strokeWidth={2} 
        />
        <Line 
          type="monotone" 
          dataKey="positive" 
          name="Positive" 
          stroke="var(--success)" 
          dot={false} 
          strokeWidth={1} 
          opacity={0.5} 
        />
        <Line 
          type="monotone" 
          dataKey="negative" 
          name="Negative" 
          stroke="var(--error)" 
          dot={false} 
          strokeWidth={1} 
          opacity={0.5} 
        />
      </LineChart>
    </ResponsiveContainer>
  </div>
);

// --- Main Page Component ---
const TeamAnalytics: React.FC = () => {
  const [data, setData] = useState<PerformanceAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchPerformanceAnalytics();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '4rem 2rem', 
        color: 'var(--text-secondary)' 
      }}>
        <ArrowPathIcon 
          className="w-12 h-12 animate-spin" 
          style={{ 
            width: '48px', 
            height: '48px', 
            margin: '0 auto 1rem',
            animation: 'spin 1s linear infinite'
          }} 
        />
        <p>Loading performance analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ 
        textAlign: 'center', 
        padding: '4rem 2rem', 
        color: 'var(--error)' 
      }}>
        <h3>Error loading analytics: {error}</h3>
      </div>
    );
  }
  
  const totalContributors = data.top_contributors.reduce((acc, curr) => acc + curr.value, 0);
  const totalMessages = data.top_active_channels.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div style={{ 
      maxWidth: '1400px', 
      margin: '0 auto', 
      padding: '2rem 1rem',
      display: 'flex', 
      flexDirection: 'column', 
      gap: '2rem' 
    }}>
      {/* Header */}
      <header>
        <h2 style={{
          fontSize: '2rem', 
          fontWeight: '700',
          color: 'var(--text-primary)', 
          marginBottom: '0.5rem'
        }}>
          Team Analytics
        </h2>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Insights into your team's communication patterns (Last 30 Days).
        </p>
      </header>
      
      {/* Stat Card Grid - RESPONSIVE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        <StatCard
          title="Avg. Response Time"
          value={data.avg_response_time_seconds ? (data.avg_response_time_seconds / 60).toFixed(1) : 'N/A'}
          unit="minutes"
          icon={<ClockIcon style={{ width: '24px', height: '24px' }} />}
        />
        <StatCard
          title="Total Messages"
          value={totalMessages.toLocaleString()}
          unit="in top 5"
          icon={<ChatBubbleLeftRightIcon style={{ width: '24px', height: '24px' }} />}
        />
        <StatCard
          title="Contributors"
          value={totalContributors.toLocaleString()}
          unit="from top 5"
          icon={<UsersIcon style={{ width: '24px', height: '24px' }} />}
        />
        <StatCard
          title="Sentiment"
          value={data.sentiment_over_time.length > 0 ? 
            (data.sentiment_over_time.reduce((a, b) => a + b.average_score, 0) / data.sentiment_over_time.length).toFixed(2) : 'N/A'}
          unit="Avg."
          icon={<SparklesIcon style={{ width: '24px', height: '24px' }} />}
        />
      </div>
      
      {/* Chart Grid - RESPONSIVE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: '1.5rem'
      }}>
        <SimpleBarChart data={data.top_active_channels} title="Top Active Channels" />
        <SimpleBarChart data={data.top_contributors} title="Top Contributors" />
      </div>
      
      {/* Full-Width Chart */}
      <SimpleLineChart data={data.sentiment_over_time} title="Sentiment Over Time (30 Days)" />
    </div>
  );
};

export default TeamAnalytics;