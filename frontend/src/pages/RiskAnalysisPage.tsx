// frontend/src/pages/RiskAnalysisPage.tsx
import React, { useState } from 'react';
import { 
  BeakerIcon, 
  ExclamationTriangleIcon,
  LinkIcon,
  ChatBubbleBottomCenterTextIcon,
  UserCircleIcon,
  CalendarDaysIcon,
  HashtagIcon,
  ArrowPathIcon // <-- ADDED THIS MISSING IMPORT
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import { runRiskAnalysis } from '../services/api'; // We need to add this to api.ts
import type { RiskAnalysisResponse, DependencyItem, SentimentItem } from '../types'; // We need to add these to types.ts

// --- New Component: Dependency Card ---
const DependencyCard: React.FC<{ item: DependencyItem }> = ({ item }) => (
  <div className="card" style={{ background: 'var(--surface-light)', margin: '0.5rem 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ 
        padding: '0.5rem', 
        background: 'var(--surface-elevated)', 
        borderRadius: 'var(--radius-sm)',
        color: 'var(--text-secondary)'
      }}>
        <LinkIcon style={{ width: '20px', height: '20px' }} />
      </span>
      <div>
        <span style={{
          fontSize: '0.75rem',
          fontWeight: 600,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase'
        }}>
          {item.node_type} / {item.link_type.replace('_', ' ')}
        </span>
        <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500 }}>
          {item.summary}
        </p>
      </div>
    </div>
  </div>
);

// --- New Component: Sentiment Card ---
const SentimentCard: React.FC<{ item: SentimentItem }> = ({ item }) => {
  const sentimentColor = item.sentiment_label === 'positive' 
    ? 'var(--success)' 
    : item.sentiment_label === 'negative' 
    ? 'var(--error)' 
    : 'var(--text-muted)';
  
  return (
    <div className="card" style={{ background: 'var(--surface-light)', margin: '0.5rem 0' }}>
      <p style={{ 
        fontStyle: 'italic', 
        color: 'var(--text-primary)', 
        borderLeft: `3px solid ${sentimentColor}`, 
        paddingLeft: '0.75rem',
        margin: '0 0 0.75rem 0'
      }}>
        "{item.text}"
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <UserCircleIcon style={{ width: '16px', height: '16px' }} />
          {item.user_name}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <HashtagIcon style={{ width: '16px', height: '16px' }} />
          {item.channel}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <CalendarDaysIcon style={{ width: '16px', height: '16px' }} />
          {new Date(item.timestamp).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};


// --- Main Page Component ---
// --- RENAMED COMPONENT ---
const RiskAnalysisPage: React.FC = () => {
  const [decisionText, setDecisionText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<RiskAnalysisResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (decisionText.trim().length < 10) {
      setError('Please enter a more detailed decision text (min. 10 characters).');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setAnalysis(null);
    
    try {
      const result = await runRiskAnalysis(decisionText);
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
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
          <BeakerIcon style={{ width: '40px', height: '40px' }} />
          Risk & Dependency Analyzer
        </h2>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Propose a decision and the AI will analyze the Knowledge Graph to surface related dependencies and sentiments.
        </p>
      </header>
      
      {/* Input Form */}
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <div className="card">
          <label 
            htmlFor="decision-text"
            style={{ 
              display: 'block', 
              marginBottom: '0.75rem', 
              color: 'var(--text-secondary)',
              fontWeight: 600
            }}
          >
            Propose a Decision or Change:
          </label>
          <textarea
            id="decision-text"
            value={decisionText}
            onChange={(e) => setDecisionText(e.target.value)}
            disabled={isLoading}
            placeholder="e.g., 'Delay Project Phoenix launch by two weeks to fix auth module bugs'"
            style={{
              width: '100%',
              minHeight: '100px',
              padding: '0.75rem',
              background: 'var(--surface-light)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '1rem',
              resize: 'vertical'
            }}
          />
          <button
            type="submit"
            disabled={isLoading}
            style={{
              marginTop: '1rem',
              width: '100%',
              padding: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              fontSize: '1rem'
            }}
          >
            {isLoading ? (
              <ArrowPathIcon style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />
            ) : (
              <BeakerIcon style={{ width: '20px', height: '20px' }} />
            )}
            {isLoading ? 'Analyzing...' : 'Analyze Potential Impact'}
          </button>
        </div>
      </form>
      
      {/* Error Display */}
      {error && (
        <div className="card" style={{ background: 'var(--error-light)', color: 'var(--error)', borderColor: 'var(--error)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>{error}</p>
        </div>
      )}
      
      {/* Results Display */}
      {analysis && (
        <div className="card fade-in" style={{ marginTop: '2rem' }}>
          <h3>Analysis for: "{analysis.decision_text}"</h3>
          
          <hr style={{ margin: '1.5rem 0' }} />
          
          {/* Column Layout */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '2rem'
          }}>
            
            {/* Dependencies Column */}
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <LinkIcon style={{ width: '20px', height: '20px' }} />
                Potential Dependencies ({analysis.dependencies.length})
              </h4>
              {analysis.dependencies.length > 0 ? (
                analysis.dependencies.map(item => <DependencyCard key={item.node_id} item={item} />)
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No direct dependencies found.</p>
              )}
            </div>
            
            {/* Sentiments Column */}
            <div>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
                <ChatBubbleBottomCenterTextIcon style={{ width: '20px', height: '20px' }} />
                Related Sentiments ({analysis.related_sentiments.length})
              </h4>
              {analysis.related_sentiments.length > 0 ? (
                analysis.related_sentiments.map((item, i) => <SentimentCard key={i} item={item} />)
              ) : (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No strong related sentiments found.</p>
              )}
            </div>
          </div>
          
          <hr style={{ margin: '1.5rem 0' }} />
          
          {/* AI Summary */}
          <div>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-primary)' }}>
              <ExclamationTriangleIcon style={{ width: '20px', height: '20px' }} />
              AI-Generated Risk Summary
            </h4>
            <div className="chat-markdown" style={{ 
              background: 'var(--surface-light)', 
              padding: '0.5rem 1rem', 
              borderRadius: 'var(--radius-md)' 
            }}>
              <ReactMarkdown>{analysis.summary}</ReactMarkdown>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};

// --- RENAMED EXPORT ---
export default RiskAnalysisPage;