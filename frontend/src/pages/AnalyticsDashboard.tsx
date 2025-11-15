import React, { useState, useEffect } from 'react';
import EmotionalHeatmap from '../components/EmotionalHeatmap';
// import TrustGraph from '../components/TrustGraph'; // <-- REMOVED this line
import DecisionTimeline from '../components/DecisionTimeline';

// Decision type for timeline
interface Decision {
  id: string;
  text: string;
  timestamp: string | null;
  relatedEventId?: string;
  source?: string;
}

const AnalyticsDashboard: React.FC = () => {
  const [decisions, setDecisions] = useState<Decision[]>([
    {
      id: 'd-1',
      text: 'Proceed with v2 API deployment to production',
      timestamp: new Date().toISOString(),
      source: 'slack',
      relatedEventId: 'evt-123',
    },
    {
      id: 'd-2',
      text: 'Delay feature release by one week for QA stability',
      timestamp: new Date(Date.now() - 86400000 * 2).toISOString(),
      source: 'zoom',
      relatedEventId: 'evt-124',
    },
    {
      id: 'd-3',
      text: 'Adopt React Query for data fetching in frontend',
      timestamp: new Date(Date.now() - 86400000 * 5).toISOString(),
      source: 'github',
      relatedEventId: 'pr-89',
    },
    {
      id: 'd-4',
      text: 'Migrate authentication to OAuth 2.0 with PKCE',
      timestamp: new Date(Date.now() - 86400000 * 7).toISOString(),
      source: 'jira',
      relatedEventId: 'JIRA-567',
    },
  ]);

  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSimulateClick = (id: string, text: string) => {
    console.log(`Simulate requested for decision: ${id} – "${text}"`);
    alert(`Simulate counterfactual for:\n"${text}"\n\n(Navigation to Predictive Suite can be added here)`);
  };

  return (
    <div
      style={{
        padding: '2rem',
        animation: 'fadeIn 0.5s ease-out',
        background: 'var(--background)',
        minHeight: '100vh',
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <header style={{ marginBottom: '2.5rem' }}>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
            }}
          >
            Analytics Dashboard
          </h2>
          <p
            style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              maxWidth: '800px',
            }}
          >
            Visualize your team's emotional intelligence, trust networks, and key decisions in real time.
          </p>
        </header>

        {/* Responsive Analytics Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: '1.5rem',
            alignItems: 'start',
          }}
        >
          {/* Card 1: Emotional Heatmap */}
          <div
            className="card"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              padding: '1.5rem',
              height: 'fit-content',
            }}
          >
            <h3
              style={{
                margin: '0 0 1rem 0',
                fontSize: '1.125rem',
                color: 'var(--text-primary)',
                fontWeight: '600',
              }}
            >
              Emotional Sentiment
            </h3>
            <EmotionalHeatmap />
          </div>

          {/* --- CARD 2 (TRUST GRAPH) REMOVED --- */}
          {/* It is now its own page and no longer rendered here */}

          {/* Card 2: Decision Timeline (was Card 3) */}
          <div
            className="card"
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)',
              padding: '1.5rem',
              height: 'fit-content',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: '1.125rem',
                  color: 'var(--text-primary)',
                  fontWeight: '600',
                }}
              >
                Recent Decisions
              </h3>
              {isLoading && (
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Loading...
                </span>
              )}
            </div>
            <DecisionTimeline
              decisions={decisions}
              isLoading={isLoading}
              onSimulateClick={handleSimulateClick}
            />
          </div>
        </div>

        {/* Footer Note */}
        <div
          style={{
            marginTop: '3rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontSize: '0.875rem',
          }}
        >
          <p>
            Data updates every 15 minutes • Last sync: {new Date().toLocaleTimeString()}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;