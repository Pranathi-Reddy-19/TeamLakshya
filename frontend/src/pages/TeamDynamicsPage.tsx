// frontend/src/pages/TeamDynamicsPage.tsx
import React, { useState, useEffect } from 'react';
import { 
  UsersIcon, 
  UserCircleIcon, 
  SparklesIcon, 
  ExclamationTriangleIcon,
  LinkIcon,
  ChatBubbleLeftRightIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { fetchTeamDynamics } from '../services/api';
import type { TeamDynamicsResponse, KnowledgeSilo, KeyInfluencer, TeamInteraction } from '../types';

// --- Insight Card Components ---

const SiloCard: React.FC<{ silo: KnowledgeSilo }> = ({ silo }) => (
  <div className="card" style={{ background: 'var(--surface-light)', margin: '0.5rem 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <UserCircleIcon style={{ width: '40px', height: '40px', color: 'var(--primary-color)' }} />
      <div>
        <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>{silo.user_name}</p>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Authored <strong style={{ color: 'var(--error)' }}>{(silo.percentage * 100).toFixed(0)}%</strong> of {silo.event_count} events for:
        </p>
        <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500, fontStyle: 'italic' }}>{silo.topic}</p>
      </div>
    </div>
  </div>
);

const InfluencerCard: React.FC<{ influencer: KeyInfluencer, rank: number }> = ({ influencer, rank }) => (
  <div className="card" style={{ background: 'var(--surface-light)', margin: '0.5rem 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-muted)' }}>#{rank}</span>
      <div>
        <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 600 }}>{influencer.user_name}</p>
        <div style={{ display: 'flex', gap: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
          <span><strong style={{ color: 'var(--success)' }}>{influencer.agreements_received}</strong> Agreements</span>
          <span><strong style={{ color: 'var(--info)' }}>{influencer.replies_received}</strong> Replies</span>
        </div>
      </div>
    </div>
  </div>
);

const InteractionCard: React.FC<{ interaction: TeamInteraction }> = ({ interaction }) => (
  <div className="card" style={{ background: 'var(--surface-light)', margin: '0.5rem 0', textAlign: 'center' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
      <span style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.9rem', fontWeight: 600 }}>
        {interaction.team_a}
      </span>
      <LinkIcon style={{ width: '20px', height: '20px', color: 'var(--text-muted)' }} />
      <span style={{ background: 'var(--primary-light)', color: 'var(--primary-color)', padding: '0.25rem 0.75rem', borderRadius: '99px', fontSize: '0.9rem', fontWeight: 600 }}>
        {interaction.team_b}
      </span>
    </div>
    <p style={{ margin: '0.75rem 0 0 0', color: 'var(--text-primary)', fontSize: '1.25rem', fontWeight: 600 }}>
      {interaction.interaction_count}
    </p>
    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Interactions (Last 30 Days)</p>
  </div>
);

// --- Main Page Component ---
// --- RENAMED COMPONENT ---
const TeamDynamicsPage: React.FC = () => {
  const [data, setData] = useState<TeamDynamicsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await fetchTeamDynamics();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data.');
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem' }}>
        <h2
          style={{
            fontSize: '2rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <UsersIcon style={{ width: '40px', height: '40px' }} />
          Team Dynamics
        </h2>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Actionable insights about your organization's knowledge flow and communication patterns.
        </p>
      </header>

      {/* Loading / Error State */}
      {isLoading && (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <ArrowPathIcon style={{ width: '30px', height: '30px', animation: 'spin 1s linear infinite', color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: '1rem' }}>Analyzing the Knowledge Graph...</p>
        </div>
      )}
      {error && (
        <div className="card" style={{ background: 'var(--error-light)', color: 'var(--error)', borderColor: 'var(--error)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
        </div>
      )}

      {/* Insights Grid */}
      {data && (
        <div className="fade-in" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '2rem'
        }}>
          
          {/* Column 1: Knowledge Silos */}
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <ExclamationTriangleIcon style={{ width: '24px', height: '24px' }} />
              Knowledge Silos
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              Topics or tasks dominated by a single person.
            </p>
            {data.knowledge_silos.length > 0 ? (
              data.knowledge_silos.map(silo => <SiloCard key={`${silo.topic}-${silo.user_id}`} silo={silo} />)
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No significant silos found.</p>
            )}
          </div>
          
          {/* Column 2: Key Influencers */}
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <SparklesIcon style={{ width: '24px', height: '24px' }} />
              Key Influencers
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              Users whose contributions get the most engagement.
            </p>
            {data.key_influencers.length > 0 ? (
              data.key_influencers.map((inf, i) => <InfluencerCard key={inf.user_id} influencer={inf} rank={i+1} />)
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Not enough data to determine influencers.</p>
            )}
          </div>

          {/* Column 3: Team Interactions */}
          <div>
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <ChatBubbleLeftRightIcon style={{ width: '24px', height: '24px' }} />
              Team Interactions
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '-0.5rem', marginBottom: '1rem' }}>
              Cross-team communication (based on channels).
            </p>
            {data.team_interactions.length > 0 ? (
              data.team_interactions.map(inter => <InteractionCard key={`${inter.team_a}-${inter.team_b}`} interaction={inter} />)
            ) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No significant cross-team interactions found.</p>
            )}
          </div>

        </div>
      )}
    </div>
  );
};

// --- RENAMED EXPORT ---
export default TeamDynamicsPage;