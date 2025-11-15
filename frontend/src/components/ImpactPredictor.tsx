// frontend/src/components/ImpactPredictor.tsx
import React, { useState, useCallback, useMemo } from 'react';
import { predictImpact, ImpactPredictionResult } from '../services/api';
import {
  LightBulbIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  InformationCircleIcon,
  ScaleIcon,
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  FaceSmileIcon,
  ShieldExclamationIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  UserGroupIcon,
  LinkIcon,
  SparklesIcon,
  BeakerIcon,
  DocumentTextIcon,
  AdjustmentsHorizontalIcon
} from '@heroicons/react/24/outline';

interface PredictionHistory {
  id: string;
  text: string;
  result: ImpactPredictionResult;
  timestamp: Date;
}

const ImpactPredictor: React.FC = () => {
  const [decisionText, setDecisionText] = useState('');
  const [prediction, setPrediction] = useState<ImpactPredictionResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PredictionHistory[]>([]);
  const [activeTab, setActiveTab] = useState<'prediction' | 'insights' | 'history'>('prediction');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Decision templates
  const templates = [
    {
      title: "Feature Delay",
      text: "Delay the API v2 launch by one week due to stability concerns"
    },
    {
      title: "Team Expansion",
      text: "Hire three additional engineers to accelerate the mobile app development"
    },
    {
      title: "Process Change",
      text: "Switch from weekly to bi-weekly sprint cycles to reduce meeting overhead"
    },
    {
      title: "Budget Allocation",
      text: "Reallocate 20% of marketing budget to product development for Q2"
    },
    {
      title: "Policy Update",
      text: "Implement mandatory code review for all pull requests starting next sprint"
    }
  ];

  const handlePredictClick = useCallback(async () => {
    if (!decisionText.trim()) return;

    setIsLoading(true);
    setError(null);
    setPrediction(null);

    try {
      const result = await predictImpact(decisionText.trim());

      if (result.error) {
        setError(result.error);
      } else {
        setPrediction(result);
        
        // Add to history
        setHistory(prev => [{
          id: Date.now().toString(),
          text: decisionText.trim(),
          result,
          timestamp: new Date()
        }, ...prev].slice(0, 10)); // Keep last 10
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Prediction failed');
    } finally {
      setIsLoading(false);
    }
  }, [decisionText]);

  const loadTemplate = useCallback((templateText: string) => {
    setDecisionText(templateText);
    setPrediction(null);
    setError(null);
  }, []);

  const getImpactColor = useCallback((impactLevel?: string): string => {
    switch (impactLevel?.toLowerCase()) {
      case 'high': return 'var(--error)';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--success)';
      default: return 'var(--text-muted)';
    }
  }, []);

  const getImpactIcon = useCallback((impactLevel?: string) => {
    switch (impactLevel?.toLowerCase()) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }, []);

  // Calculate risk level from score
  const getRiskLevel = useCallback((riskScore: number): string => {
    if (riskScore > 0.7) return 'High Risk';
    if (riskScore > 0.4) return 'Medium Risk';
    return 'Low Risk';
  }, []);

  // Render confidence gauge
  const renderConfidenceGauge = useCallback((confidence: number) => {
    const percentage = confidence * 100;
    const color = confidence > 0.7 ? 'var(--success)' : confidence > 0.4 ? 'var(--warning)' : 'var(--error)';

    return (
      <div style={{ position: 'relative', width: '120px', height: '120px' }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke="var(--surface-light)"
            strokeWidth="10"
          />
          {/* Progress circle */}
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - confidence)}`}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color }}>{percentage.toFixed(0)}%</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Confidence</div>
        </div>
      </div>
    );
  }, []);

  // Render impact breakdown chart
  const renderImpactBreakdown = useCallback((result: ImpactPredictionResult) => {
    if (!result.predictions) return null;

    const metrics = [
      {
        label: 'Timeline',
        value: result.predictions.timeline_days || 0,
        max: 30,
        unit: 'days',
        icon: ClockIcon,
        color: '#667eea'
      },
      {
        label: 'Cost',
        value: (result.predictions.cost_estimate || 0) / 1000,
        max: 50,
        unit: 'K',
        icon: CurrencyDollarIcon,
        color: '#f093fb'
      },
      {
        label: 'Risk',
        value: (result.predictions.risk_score || 0) * 100,
        max: 100,
        unit: '%',
        icon: ShieldExclamationIcon,
        color: '#fa709a'
      },
      {
        label: 'Cascade',
        value: (result.predictions.cascade_effect_probability || 0) * 100,
        max: 100,
        unit: '%',
        icon: LinkIcon,
        color: '#4facfe'
      }
    ];

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {metrics.map((metric, idx) => {
          const percentage = Math.min((metric.value / metric.max) * 100, 100);
          
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <metric.icon className="w-6 h-6 flex-shrink-0" style={{ color: metric.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{metric.label}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: metric.color }}>
                    {metric.value.toFixed(metric.unit === '%' ? 0 : 1)}{metric.unit}
                  </span>
                </div>
                <div style={{
                  height: '8px',
                  background: 'var(--surface-light)',
                  borderRadius: '4px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${percentage}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, ${metric.color}, ${metric.color}cc)`,
                    transition: 'width 0.8s ease-out',
                    borderRadius: '4px'
                  }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }, []);

  // Render ML insights
  const renderMLInsights = useCallback((result: ImpactPredictionResult) => {
    if (!result.ml_insights) return null;

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        <div style={{
          padding: '1rem',
          background: 'var(--surface-light)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <SparklesIcon className="w-5 h-5" />
            Feature Importance
          </h4>
          
          {result.ml_insights.feature_importance && (
            <div style={{ display: 'grid', gap: '0.5rem' }}>
              {Object.entries(result.ml_insights.feature_importance).map(([feature, importance]: [string, any], idx) => {
                const importanceArray = Array.isArray(importance) ? importance : [importance];
                const avgImportance = importanceArray.reduce((a: number, b: number) => a + b, 0) / importanceArray.length;
                
                return (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', minWidth: '120px', color: 'var(--text-secondary)' }}>
                      {feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                    <div style={{ flex: 1, height: '6px', background: 'var(--surface)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${avgImportance * 100}%`,
                        height: '100%',
                        background: 'var(--primary-color)',
                        transition: 'width 0.5s ease-out'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', minWidth: '40px', textAlign: 'right', color: 'var(--text-muted)' }}>
                      {(avgImportance * 100).toFixed(0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {result.confidence_intervals && (
          <div style={{
            padding: '1rem',
            background: 'var(--info-light)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--info)'
          }}>
            <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <InformationCircleIcon className="w-5 h-5" />
              Confidence Intervals (95%)
            </h4>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.5rem' }}>
              {result.confidence_intervals.timeline && (
                <div>
                  <strong>Timeline:</strong> {result.confidence_intervals.timeline[0].toFixed(1)} - {result.confidence_intervals.timeline[1].toFixed(1)} days
                </div>
              )}
              {result.confidence_intervals.cost && (
                <div>
                  <strong>Cost:</strong> ${result.confidence_intervals.cost[0].toLocaleString()} - ${result.confidence_intervals.cost[1].toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }, []);

  // Render risk matrix
  const renderRiskMatrix = useCallback((result: ImpactPredictionResult) => {
    const riskScore = result.predictions?.risk_score || 0;
    const impactLevel = result.predicted_impact || 'medium';
    
    // Map to coordinates
    const impactY = impactLevel === 'high' ? 0.2 : impactLevel === 'medium' ? 0.5 : 0.8;
    const probabilityX = 0.5; // Assuming medium probability

    return (
      <div style={{
        padding: '1rem',
        background: 'var(--surface-light)',
        borderRadius: 'var(--radius-md)'
      }}>
        <h4 style={{ fontSize: '0.9rem', marginBottom: '1rem' }}>Risk Assessment Matrix</h4>
        <div style={{
          position: 'relative',
          width: '100%',
          paddingBottom: '100%',
          background: 'linear-gradient(to right, #10b981 0%, #fbbf24 50%, #ef4444 100%)',
          borderRadius: 'var(--radius-md)',
          opacity: 0.3
        }}>
          <div style={{
            position: 'absolute',
            left: `${probabilityX * 100}%`,
            top: `${impactY * 100}%`,
            width: '20px',
            height: '20px',
            background: getImpactColor(impactLevel),
            border: '3px solid white',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            zIndex: 1
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '0.5rem',
          fontSize: '0.75rem',
          color: 'var(--text-muted)'
        }}>
          <span>Low Probability</span>
          <span>High Probability</span>
        </div>
        <div style={{
          position: 'absolute',
          left: '-60px',
          top: '50%',
          transform: 'rotate(-90deg)',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          whiteSpace: 'nowrap'
        }}>
          Impact Level
        </div>
      </div>
    );
  }, [getImpactColor]);

  // Render prediction details
  const renderPredictionDetails = useCallback((result: ImpactPredictionResult) => {
    return (
      <div className="fade-in" style={{ marginTop: '1.5rem', display: 'grid', gap: '1.5rem' }}>
        {/* Summary Card with Gauge */}
        <div style={{
          padding: '1.5rem',
          background: `linear-gradient(135deg, ${getImpactColor(result.predicted_impact)}15 0%, var(--surface-light) 70%)`,
          border: `2px solid ${getImpactColor(result.predicted_impact)}30`,
          borderRadius: 'var(--radius-lg)',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: '1.5rem',
          alignItems: 'center',
          animation: 'slideIn 0.5s ease-out'
        }}>
          <div>
            <div style={{ fontSize: '3rem', lineHeight: 1 }}>
              {getImpactIcon(result.predicted_impact)}
            </div>
          </div>
          
          <div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
              Predicted Impact
            </div>
            <div style={{
              fontSize: '2rem',
              fontWeight: 700,
              color: getImpactColor(result.predicted_impact),
              textTransform: 'capitalize',
              lineHeight: 1.2,
              marginBottom: '0.5rem'
            }}>
              {result.predicted_impact}
            </div>
            {result.predictions?.risk_score !== undefined && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {getRiskLevel(result.predictions.risk_score)} · {(result.predictions.risk_score * 100).toFixed(0)}% Risk Score
              </div>
            )}
          </div>

          {renderConfidenceGauge(result.confidence)}
        </div>

        {/* Key Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {result.predictions?.timeline_days !== undefined && (
            <div style={{
              textAlign: 'center',
              background: 'linear-gradient(135deg, #667eea15 0%, transparent 100%)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <ClockIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#667eea' }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Estimated Timeline
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: '#667eea' }}>
                {result.predictions.timeline_days.toFixed(1)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>days</div>
            </div>
          )}

          {result.predictions?.cost_estimate !== undefined && (
            <div style={{
              textAlign: 'center',
              background: 'linear-gradient(135deg, #f093fb15 0%, transparent 100%)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <CurrencyDollarIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#f093fb' }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Cost Estimate
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f093fb' }}>
                ${(result.predictions.cost_estimate / 1000).toFixed(1)}K
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ${result.predictions.cost_estimate.toLocaleString()}
              </div>
            </div>
          )}

          {result.predictions?.sentiment_impact && (
            <div style={{
              textAlign: 'center',
              background: 'linear-gradient(135deg, #43e97b15 0%, transparent 100%)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <FaceSmileIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#43e97b' }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Sentiment Impact
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: 600,
                color: result.predictions.sentiment_impact.includes('negative') ? 'var(--error)' :
                  result.predictions.sentiment_impact.includes('positive') ? 'var(--success)' : 'var(--text-secondary)'
              }}>
                {result.predictions.sentiment_impact.includes('positive') ? '😊' :
                  result.predictions.sentiment_impact.includes('negative') ? '😟' : '😐'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {result.predictions.sentiment_impact.split('(')[0].trim()}
              </div>
            </div>
          )}

          {result.predictions?.cascade_effect_probability !== undefined && (
            <div style={{
              textAlign: 'center',
              background: 'linear-gradient(135deg, #4facfe15 0%, transparent 100%)',
              padding: '1.5rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)'
            }}>
              <LinkIcon className="w-8 h-8 mx-auto mb-2" style={{ color: '#4facfe' }} />
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Cascade Effect
              </div>
              <div style={{ fontSize: '2rem', fontWeight: 600, color: '#4facfe' }}>
                {(result.predictions.cascade_effect_probability * 100).toFixed(0)}%
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>probability</div>
            </div>
          )}
        </div>

        {/* Impact Breakdown */}
        <div style={{
          padding: '1.5rem',
          background: 'var(--surface-light)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)'
        }}>
          <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ChartBarIcon className="w-5 h-5" />
            Impact Breakdown
          </h4>
          {renderImpactBreakdown(result)}
        </div>

        {/* Risk & Recommendations Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
          {/* Risk Factors */}
          {result.analysis?.risk_factors && result.analysis.risk_factors.length > 0 && (
            <div style={{
              padding: '1.5rem',
              background: 'rgba(239, 68, 68, 0.05)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid rgba(239, 68, 68, 0.2)'
            }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--error)', marginBottom: '1rem' }}>
                <ExclamationTriangleIcon className="w-5 h-5" />
                Risk Factors
              </h4>
              <ul style={{ paddingLeft: '1.5rem', margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.5rem' }}>
                {result.analysis.risk_factors.map((factor, i) => (
                  <li key={i} style={{ lineHeight: 1.5 }}>{factor}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommendations */}
          {result.recommendations && result.recommendations.length > 0 && (
            <div style={{
              padding: '1.5rem',
              background: 'rgba(16, 185, 129, 0.05)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid rgba(16, 185, 129, 0.2)'
            }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', marginBottom: '1rem' }}>
                <CheckCircleIcon className="w-5 h-5" />
                Recommendations
              </h4>
              <ul style={{ paddingLeft: '1.5rem', margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', display: 'grid', gap: '0.5rem' }}>
                {result.recommendations.map((rec, i) => (
                  <li key={i} style={{ lineHeight: 1.5 }}>{rec}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Affected Teams & Analysis */}
        {result.analysis && (
          <div style={{
            padding: '1.5rem',
            background: 'var(--surface-light)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
          }}>
            <h4 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserGroupIcon className="w-5 h-5" />
              Additional Analysis
            </h4>
            
            <div style={{ display: 'grid', gap: '1rem', fontSize: '0.9rem' }}>
              {result.analysis.affected_teams && result.analysis.affected_teams.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Affected Teams:</strong>
                  <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {result.analysis.affected_teams.map((team, idx) => (
                      <span
                        key={idx}
                        style={{
                          padding: '0.25rem 0.75rem',
                          background: 'var(--primary-light)',
                          color: 'var(--primary-color)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          fontWeight: 500
                        }}
                      >
                        {team}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {result.analysis.key_entities && result.analysis.key_entities.length > 0 && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Key Entities:</strong>
                  <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                    {result.analysis.key_entities.join(', ')}
                  </div>
                </div>
              )}

              {result.analysis.historical_precedents !== undefined && (
                <div>
                  <strong style={{ color: 'var(--text-secondary)' }}>Historical Precedents:</strong>
                  <div style={{ marginTop: '0.5rem', color: 'var(--text-muted)' }}>
                    Found {result.analysis.historical_precedents} similar past decisions
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }, [getImpactColor, getImpactIcon, getRiskLevel, renderConfidenceGauge, renderImpactBreakdown]);

  // Render history
  const renderHistory = useCallback(() => {
    if (history.length === 0) {
      return (
        <div style={{
          padding: '3rem',
          textAlign: 'center',
          color: 'var(--text-muted)',
          background: 'var(--surface-light)',
          borderRadius: 'var(--radius-md)'
        }}>
          <DocumentTextIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No prediction history yet.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            Make some predictions to see them here.
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: 'grid', gap: '1rem' }}>
        {history.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '1rem',
              background: 'var(--surface-light)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onClick={() => {
              setDecisionText(item.text);
              setPrediction(item.result);
              setActiveTab('prediction');
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
              <div style={{ flex: 1, fontSize: '0.9rem', color: 'var(--text-secondary)', marginRight: '1rem' }}>
                {item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text}
              </div>
              <div style={{
                padding: '0.25rem 0.75rem',
                background: getImpactColor(item.result.predicted_impact),
                color: 'white',
                borderRadius: 'var(--radius-sm)',
                fontSize: '0.75rem',
                fontWeight: 600,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap'
              }}>
                {item.result.predicted_impact}
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {item.timestamp.toLocaleString()}
            </div>
          </div>
        ))}
      </div>
    );
  }, [history, getImpactColor]);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <LightBulbIcon className="w-6 h-6" /> Decision Impact Predictor
        </h2>

        {/* Tab Navigation */}
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--surface-light)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          {[
            { id: 'prediction', label: 'Predict', icon: BeakerIcon },
            { id: 'insights', label: 'Insights', icon: SparklesIcon },
            { id: 'history', label: 'History', icon: DocumentTextIcon }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '0.5rem 1rem',
                background: activeTab === tab.id ? 'var(--primary-color)' : 'transparent',
                color: activeTab === tab.id ? 'white' : 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: activeTab === tab.id ? 600 : 400,
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
      </div>

      {/* Prediction Tab */}
      {activeTab === 'prediction' && (
        <>
          {/* Templates */}
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', display: 'block' }}>
              Quick Templates:
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {templates.map((template, idx) => (
                <button
                  key={idx}
                  onClick={() => loadTemplate(template.text)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'var(--surface-light)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'var(--primary-light)';
                    e.currentTarget.style.borderColor = 'var(--primary-color)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'var(--surface-light)';
                    e.currentTarget.style.borderColor = 'var(--border-color)';
                  }}
                >
                  {template.title}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div>
            <label htmlFor="decisionText" style={{
              display: 'block',
              fontSize: '0.9rem',
              color: 'var(--text-secondary)',
              marginBottom: '0.5rem',
              fontWeight: 500
            }}>
              Enter a potential decision or action:
            </label>
            <textarea
              id="decisionText"
              value={decisionText}
              onChange={(e) => setDecisionText(e.target.value)}
              placeholder="e.g., 'Delay the API v2 launch by one week due to stability concerns'"
              rows={4}
              disabled={isLoading}
              style={{ minHeight: '120px', fontSize: '0.95rem' }}
            />
            
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                onClick={handlePredictClick}
                disabled={isLoading || !decisionText.trim()}
                style={{
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {isLoading ? (
                  <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Predicting...</>
                ) : (
                  <><LightBulbIcon className="w-5 h-5" /> Predict Impact</>
                )}
              </button>

              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  padding: '0.75rem 1rem',
                  background: 'var(--surface-light)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
                title="Advanced Options"
              >
                <AdjustmentsHorizontalIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 'var(--radius-md)',
              border: '2px solid var(--error)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--error)' }}>
                <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                <strong>Prediction Error</strong>
              </div>
              <p style={{ margin: '0.5rem 0 0 2.25rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                {error}
              </p>
            </div>
          )}

          {/* Prediction Results */}
          {prediction && !isLoading && !error && renderPredictionDetails(prediction)}
        </>
      )}

      {/* Insights Tab */}
      {activeTab === 'insights' && (
        <div>
          {prediction ? (
            renderMLInsights(prediction)
          ) : (
            <div style={{
              padding: '3rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              background: 'var(--surface-light)',
              borderRadius: 'var(--radius-md)'
            }}>
              <SparklesIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>Run a prediction first to see ML insights.</p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && renderHistory()}

      {/* Animation Styles */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .fade-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default ImpactPredictor;