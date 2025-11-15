// frontend/src/components/CounterfactualSimulator.tsx
import React, { useState, useMemo, useCallback } from 'react';
import {
  BeakerIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ScaleIcon,
  ChartBarIcon,
  LightBulbIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  PlusCircleIcon,
  TrashIcon,
  CloudArrowDownIcon,
  AdjustmentsHorizontalIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// Enhanced API response structure with advanced features
interface CausalAnalysis {
  average_treatment_effect: {
    timeline_days: number;
    cost: number;
    sentiment: number;
  };
  effect_sizes: {
    timeline: number;
    cost: number;
  };
  interpretation: {
    timeline: string;
    cost: string;
    sentiment: string;
  };
}

interface SimulationParameters {
  num_simulations: number;
  confidence_level: number;
}

interface SimulationResult {
  original_outcome: {
    timeline_days: number | null;
    cost: number | null;
    sentiment: number | null;
    risk_score?: number;
  };
  counterfactual_outcome: {
    timeline_days_mean: number | null;
    cost_mean: number | null;
    sentiment_mean: number | null;
    risk_score?: number;
    timeline_days_ci?: [number, number];
    cost_ci?: [number, number];
    sentiment_ci?: [number, number];
  };
  comparison: {
    timeline_change: { absolute: number; percentage: number; interpretation: string };
    cost_change: { absolute: number; percentage: number; interpretation: string };
    sentiment_change: { absolute: number; interpretation: string };
    risk_change?: { absolute: number; interpretation: string };
    overall_recommendation: string;
    improvements_count?: number;
    summary: string;
  };
  causal_analysis?: CausalAnalysis;
  simulation_parameters?: SimulationParameters;
  confidence: number;
  recommendation: string;
}

interface Scenario {
  id: string;
  name: string;
  text: string;
  result?: SimulationResult;
  isLoading: boolean;
  error?: string;
}

interface CounterfactualSimulatorProps {
  originalDecisionId: string;
  originalDecisionText: string;
  simulationResult: SimulationResult | null;
  isLoading: boolean;
  error: string | null;
  onRunSimulation?: (alternateText: string, params?: SimulationParameters) => void;
}

const CounterfactualSimulator: React.FC<CounterfactualSimulatorProps> = ({
  originalDecisionId,
  originalDecisionText,
  simulationResult,
  isLoading,
  error,
  onRunSimulation
}) => {
  const [alternateText, setAlternateText] = useState('');
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeTab, setActiveTab] = useState<'simulation' | 'comparison' | 'causal' | 'sensitivity'>('simulation');
  const [showAdvancedParams, setShowAdvancedParams] = useState(false);
  const [simParams, setSimParams] = useState<SimulationParameters>({
    num_simulations: 100,
    confidence_level: 0.95
  });
  const [selectedMetric, setSelectedMetric] = useState<'timeline' | 'cost' | 'sentiment' | 'risk'>('timeline');

  // Handle simulation run
  const handleSimulateClick = useCallback(() => {
    if (onRunSimulation && alternateText.trim()) {
      onRunSimulation(alternateText.trim(), simParams);
    }
  }, [onRunSimulation, alternateText, simParams]);

  // Add scenario for comparison
  const addScenario = useCallback(() => {
    if (!alternateText.trim()) return;
    
    const newScenario: Scenario = {
      id: `scenario-${Date.now()}`,
      name: `Scenario ${scenarios.length + 1}`,
      text: alternateText.trim(),
      isLoading: false
    };
    
    setScenarios(prev => [...prev, newScenario]);
    setAlternateText('');
  }, [alternateText, scenarios.length]);

  // Remove scenario
  const removeScenario = useCallback((id: string) => {
    setScenarios(prev => prev.filter(s => s.id !== id));
  }, []);

  // Run simulation for specific scenario
  const runScenarioSimulation = useCallback((scenarioId: string) => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (scenario && onRunSimulation) {
      setScenarios(prev => prev.map(s => 
        s.id === scenarioId ? { ...s, isLoading: true, error: undefined } : s
      ));
      onRunSimulation(scenario.text, simParams);
      // Note: In real implementation, you'd need to handle the result and update the specific scenario
    }
  }, [scenarios, onRunSimulation, simParams]);

  // Format numbers
  const formatNumber = (num: number | null | undefined, decimals = 0, prefix = '', suffix = ''): string => {
    if (num === null || num === undefined) return 'N/A';
    return `${prefix}${num.toFixed(decimals)}${suffix}`;
  };

  const formatConfidenceInterval = (ci?: [number, number], decimals = 0, prefix = '', suffix = ''): string => {
    if (!ci) return '';
    return `${formatNumber(ci[0], decimals, prefix, suffix)} - ${formatNumber(ci[1], decimals, prefix, suffix)}`;
  };

  // Get recommendation styling
  const getRecommendationIcon = (recommendation?: string) => {
    if (!recommendation) return <ScaleIcon className="w-6 h-6 text-gray-500" />;
    if (recommendation.includes('Strongly Recommend')) return <CheckCircleIcon className="w-6 h-6 text-green-500" />;
    if (recommendation.includes('Recommend')) return <CheckCircleIcon className="w-6 h-6 text-blue-500" />;
    if (recommendation.includes('Original Decision Preferred')) return <XCircleIcon className="w-6 h-6 text-red-500" />;
    return <ScaleIcon className="w-6 h-6 text-yellow-500" />;
  };

  const getRecommendationColor = (recommendation: string): string => {
    if (recommendation.includes('strongly_recommend')) return 'var(--success)';
    if (recommendation.includes('not_recommended')) return 'var(--error)';
    if (recommendation.includes('neutral')) return 'var(--warning)';
    return 'var(--primary-color)';
  };

  // Calculate improvement metrics
  const improvementMetrics = useMemo(() => {
    if (!simulationResult) return null;

    const { comparison } = simulationResult;
    const metrics = [
      { name: 'Timeline', improved: comparison.timeline_change.absolute < 0, change: comparison.timeline_change.percentage },
      { name: 'Cost', improved: comparison.cost_change.absolute < 0, change: comparison.cost_change.percentage },
      { name: 'Sentiment', improved: comparison.sentiment_change.absolute > 0, change: comparison.sentiment_change.absolute * 100 },
      { name: 'Risk', improved: (comparison.risk_change?.absolute || 0) < 0, change: (comparison.risk_change?.absolute || 0) * 100 }
    ];

    const improvedCount = metrics.filter(m => m.improved).length;
    const improvementScore = (improvedCount / metrics.length) * 100;

    return { metrics, improvedCount, improvementScore };
  }, [simulationResult]);

  // Export simulation data
  const exportSimulationData = useCallback(() => {
    if (!simulationResult) return;

    const exportData = {
      original_decision: {
        id: originalDecisionId,
        text: originalDecisionText,
        outcomes: simulationResult.original_outcome
      },
      alternate_decision: {
        text: alternateText,
        outcomes: simulationResult.counterfactual_outcome
      },
      comparison: simulationResult.comparison,
      causal_analysis: simulationResult.causal_analysis,
      confidence: simulationResult.confidence,
      simulation_parameters: simulationResult.simulation_parameters,
      exported_at: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `counterfactual-simulation-${originalDecisionId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [simulationResult, originalDecisionId, originalDecisionText, alternateText]);

  // Render Monte Carlo Distribution (simplified visualization)
  const renderDistributionChart = () => {
    if (!simulationResult?.counterfactual_outcome) return null;

    const { timeline_days_mean, timeline_days_ci, cost_mean, cost_ci } = simulationResult.counterfactual_outcome;
    
    // Simplified distribution visualization
    const getDistributionBars = (mean: number | null, ci?: [number, number]) => {
      if (!mean || !ci) return null;
      
      const range = ci[1] - ci[0];
      const normalizedMean = 50; // Center position
      const lowerBound = ((mean - ci[0]) / range) * 100;
      const upperBound = ((ci[1] - mean) / range) * 100;

      return (
        <div style={{ position: 'relative', height: '40px', margin: '0.5rem 0' }}>
          {/* CI Range */}
          <div style={{
            position: 'absolute',
            left: '10%',
            right: '10%',
            height: '20px',
            top: '10px',
            background: 'linear-gradient(90deg, transparent, var(--primary-light), transparent)',
            borderRadius: '4px',
            opacity: 0.3
          }} />
          {/* Mean marker */}
          <div style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '3px',
            height: '40px',
            background: 'var(--primary-color)',
            borderRadius: '2px'
          }} />
          {/* Labels */}
          <div style={{ position: 'absolute', left: '10%', top: '25px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {ci[0].toFixed(1)}
          </div>
          <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', top: '25px', fontSize: '0.7rem', fontWeight: 600 }}>
            {mean.toFixed(1)}
          </div>
          <div style={{ position: 'absolute', right: '10%', top: '25px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
            {ci[1].toFixed(1)}
          </div>
        </div>
      );
    };

    return (
      <div style={{ marginTop: '1.5rem' }}>
        <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <ChartBarIcon className="w-5 h-5" />
          Monte Carlo Simulation Results
        </h4>
        
        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ marginBottom: '1.5rem' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
              Timeline Distribution (days)
            </label>
            {getDistributionBars(timeline_days_mean, timeline_days_ci)}
          </div>
          
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: '0.25rem' }}>
              Cost Distribution ($)
            </label>
            {getDistributionBars(cost_mean, cost_ci)}
          </div>
        </div>

        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          background: 'var(--info-light)', 
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'start',
          gap: '0.5rem'
        }}>
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0" style={{ marginTop: '2px' }} />
          <span>
            Based on {simulationResult.simulation_parameters?.num_simulations || 100} Monte Carlo simulations 
            with {((simulationResult.simulation_parameters?.confidence_level || 0.95) * 100).toFixed(0)}% confidence intervals. 
            The mean represents the most likely outcome, while the range shows uncertainty.
          </span>
        </div>
      </div>
    );
  };

  // Render Causal Analysis Tab
  const renderCausalAnalysis = () => {
    if (!simulationResult?.causal_analysis) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          Causal analysis data not available for this simulation.
        </div>
      );
    }

    const { average_treatment_effect, effect_sizes, interpretation } = simulationResult.causal_analysis;

    return (
      <div className="fade-in">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <LightBulbIcon className="w-5 h-5" />
          Causal Inference Analysis
        </h3>

        <div style={{ 
          background: 'var(--surface-light)', 
          padding: '1rem', 
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem'
        }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>Average Treatment Effect (ATE)</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            The causal impact of choosing the alternate decision over the original:
          </p>

          <div style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '0.75rem',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${average_treatment_effect.timeline_days < 0 ? 'var(--success)' : 'var(--error)'}`
            }}>
              <span style={{ fontWeight: 500 }}>Timeline Effect</span>
              <span style={{ 
                color: average_treatment_effect.timeline_days < 0 ? 'var(--success)' : 'var(--error)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {average_treatment_effect.timeline_days < 0 ? <ArrowTrendingDownIcon className="w-4 h-4" /> : <ArrowTrendingUpIcon className="w-4 h-4" />}
                {formatNumber(average_treatment_effect.timeline_days, 2, average_treatment_effect.timeline_days > 0 ? '+' : '', ' days')}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ({interpretation.timeline})
                </span>
              </span>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '0.75rem',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${average_treatment_effect.cost < 0 ? 'var(--success)' : 'var(--error)'}`
            }}>
              <span style={{ fontWeight: 500 }}>Cost Effect</span>
              <span style={{ 
                color: average_treatment_effect.cost < 0 ? 'var(--success)' : 'var(--error)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {average_treatment_effect.cost < 0 ? <ArrowTrendingDownIcon className="w-4 h-4" /> : <ArrowTrendingUpIcon className="w-4 h-4" />}
                {formatNumber(average_treatment_effect.cost, 0, average_treatment_effect.cost > 0 ? '+' : '$', '')}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ({interpretation.cost})
                </span>
              </span>
            </div>

            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '0.75rem',
              background: 'var(--surface)',
              borderRadius: 'var(--radius-sm)',
              borderLeft: `3px solid ${average_treatment_effect.sentiment > 0 ? 'var(--success)' : 'var(--error)'}`
            }}>
              <span style={{ fontWeight: 500 }}>Sentiment Effect</span>
              <span style={{ 
                color: average_treatment_effect.sentiment > 0 ? 'var(--success)' : 'var(--error)',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}>
                {average_treatment_effect.sentiment > 0 ? <ArrowTrendingUpIcon className="w-4 h-4" /> : <ArrowTrendingDownIcon className="w-4 h-4" />}
                {formatNumber(average_treatment_effect.sentiment, 3, average_treatment_effect.sentiment > 0 ? '+' : '')}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  ({interpretation.sentiment})
                </span>
              </span>
            </div>
          </div>
        </div>

        <div style={{ 
          background: 'var(--surface-light)', 
          padding: '1rem', 
          borderRadius: 'var(--radius-md)'
        }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>Effect Size (Cohen's d)</h4>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
            Standardized measure of the magnitude of difference:
          </p>

          <div style={{ display: 'flex', gap: '1rem' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                {effect_sizes.timeline.toFixed(3)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Timeline Effect Size
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {Math.abs(effect_sizes.timeline) < 0.2 ? 'Small' : Math.abs(effect_sizes.timeline) < 0.5 ? 'Medium' : 'Large'}
              </div>
            </div>

            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                {effect_sizes.cost.toFixed(3)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                Cost Effect Size
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {Math.abs(effect_sizes.cost) < 0.2 ? 'Small' : Math.abs(effect_sizes.cost) < 0.5 ? 'Medium' : 'Large'}
              </div>
            </div>
          </div>
        </div>

        <div style={{ 
          marginTop: '1rem', 
          padding: '0.75rem', 
          background: 'var(--info-light)', 
          borderRadius: 'var(--radius-md)',
          fontSize: '0.85rem',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'start',
          gap: '0.5rem'
        }}>
          <InformationCircleIcon className="w-5 h-5 flex-shrink-0" style={{ marginTop: '2px' }} />
          <span>
            <strong>Effect Size Interpretation:</strong> Small (0.2), Medium (0.5), Large (0.8+). 
            Positive values indicate the alternate decision improves outcomes, negative values indicate degradation.
          </span>
        </div>
      </div>
    );
  };

  // Render Sensitivity Analysis
  const renderSensitivityAnalysis = () => {
    if (!simulationResult) {
      return (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
          Run a simulation first to see sensitivity analysis.
        </div>
      );
    }

    return (
      <div className="fade-in">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <AdjustmentsHorizontalIcon className="w-5 h-5" />
          Sensitivity Analysis
        </h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ fontSize: '0.9rem', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>
            Select Metric to Analyze
          </label>
          <select 
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as any)}
            style={{ width: '100%' }}
          >
            <option value="timeline">Timeline</option>
            <option value="cost">Cost</option>
            <option value="sentiment">Sentiment</option>
            <option value="risk">Risk Score</option>
          </select>
        </div>

        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '1rem' }}>Uncertainty Breakdown</h4>
          
          {selectedMetric === 'timeline' && simulationResult.counterfactual_outcome.timeline_days_ci && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem' }}>Best Case</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                  {formatNumber(simulationResult.counterfactual_outcome.timeline_days_ci[0], 1, '', ' days')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem' }}>Expected</span>
                <span style={{ fontWeight: 600 }}>
                  {formatNumber(simulationResult.counterfactual_outcome.timeline_days_mean, 1, '', ' days')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem' }}>Worst Case</span>
                <span style={{ fontWeight: 600, color: 'var(--error)' }}>
                  {formatNumber(simulationResult.counterfactual_outcome.timeline_days_ci[1], 1, '', ' days')}
                </span>
              </div>
              
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Uncertainty Range
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                  ±{formatNumber(
                    (simulationResult.counterfactual_outcome.timeline_days_ci[1] - simulationResult.counterfactual_outcome.timeline_days_ci[0]) / 2,
                    1,
                    '',
                    ' days'
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {(((simulationResult.counterfactual_outcome.timeline_days_ci[1] - simulationResult.counterfactual_outcome.timeline_days_ci[0]) / 
                     (simulationResult.counterfactual_outcome.timeline_days_mean || 1)) * 100).toFixed(1)}% relative uncertainty
                </div>
              </div>
            </div>
          )}

          {selectedMetric === 'cost' && simulationResult.counterfactual_outcome.cost_ci && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem' }}>Best Case</span>
                <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                  {formatNumber(simulationResult.counterfactual_outcome.cost_ci[0], 0, '$')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem' }}>Expected</span>
                <span style={{ fontWeight: 600 }}>
                  {formatNumber(simulationResult.counterfactual_outcome.cost_mean, 0, '$')}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.85rem' }}>Worst Case</span>
                <span style={{ fontWeight: 600, color: 'var(--error)' }}>
                  {formatNumber(simulationResult.counterfactual_outcome.cost_ci[1], 0, '$')}
                </span>
              </div>
              
              <div style={{ marginTop: '1rem', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Uncertainty Range
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--primary-color)' }}>
                  ±{formatNumber(
                    (simulationResult.counterfactual_outcome.cost_ci[1] - simulationResult.counterfactual_outcome.cost_ci[0]) / 2,
                    0,
                    '$'
                  )}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  {(((simulationResult.counterfactual_outcome.cost_ci[1] - simulationResult.counterfactual_outcome.cost_ci[0]) / 
                     (simulationResult.counterfactual_outcome.cost_mean || 1)) * 100).toFixed(1)}% relative uncertainty
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>Robustness Assessment</h4>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Confidence Level:</strong> {((simulationResult.confidence || 0) * 100).toFixed(1)}%
            </p>
            <p style={{ marginBottom: '0.5rem' }}>
              <strong>Simulation Runs:</strong> {simulationResult.simulation_parameters?.num_simulations || 100}
            </p>
            <p style={{ margin: 0 }}>
              <strong>Recommendation Stability:</strong>{' '}
              {simulationResult.confidence > 0.8 ? (
                <span style={{ color: 'var(--success)' }}>High - Results are stable</span>
              ) : simulationResult.confidence > 0.6 ? (
                <span style={{ color: 'var(--warning)' }}>Medium - Some uncertainty exists</span>
              ) : (
                <span style={{ color: 'var(--error)' }}>Low - High uncertainty</span>
              )}
            </p>
          </div>
        </div>
      </div>
    );
  };

  // Render Multi-Scenario Comparison
  const renderScenarioComparison = () => {
    return (
      <div className="fade-in">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
          <ScaleIcon className="w-5 h-5" />
          Multi-Scenario Comparison
        </h3>

        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Enter scenario description..."
              value={alternateText}
              onChange={(e) => setAlternateText(e.target.value)}
              style={{ flex: 1 }}
            />
            <button
              onClick={addScenario}
              disabled={!alternateText.trim()}
              style={{ 
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                whiteSpace: 'nowrap'
              }}
            >
              <PlusCircleIcon className="w-5 h-5" />
              Add Scenario
            </button>
          </div>
        </div>

        {scenarios.length === 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: '2rem', 
            color: 'var(--text-muted)',
            background: 'var(--surface-light)',
            borderRadius: 'var(--radius-md)'
          }}>
            Add multiple scenarios above to compare them side-by-side
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {scenarios.map((scenario) => (
              <div 
                key={scenario.id}
                style={{ 
                  background: 'var(--surface-light)', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      value={scenario.name}
                      onChange={(e) => setScenarios(prev => prev.map(s => 
                        s.id === scenario.id ? { ...s, name: e.target.value } : s
                      ))}
                      style={{ 
                        fontWeight: 600, 
                        fontSize: '0.95rem',
                        marginBottom: '0.5rem',
                        border: 'none',
                        background: 'transparent',
                        padding: '0.25rem 0.5rem'
                      }}
                    />
                    <p style={{ 
                      fontSize: '0.85rem', 
                      color: 'var(--text-secondary)', 
                      margin: 0,
                      padding: '0 0.5rem'
                    }}>
                      {scenario.text}
                    </p>
                  </div>
                  <button
                    onClick={() => removeScenario(scenario.id)}
                    style={{ 
                      padding: '0.5rem',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--error)',
                      cursor: 'pointer'
                    }}
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                </div>

                {scenario.result ? (
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', 
                    gap: '0.75rem',
                    marginTop: '1rem'
                  }}>
                    <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Timeline</div>
                      <div style={{ fontWeight: 600, color: scenario.result.comparison.timeline_change.absolute < 0 ? 'var(--success)' : 'var(--error)' }}>
                        {formatNumber(scenario.result.comparison.timeline_change.absolute, 1, scenario.result.comparison.timeline_change.absolute > 0 ? '+' : '', 'd')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Cost</div>
                      <div style={{ fontWeight: 600, color: scenario.result.comparison.cost_change.absolute < 0 ? 'var(--success)' : 'var(--error)' }}>
                        {formatNumber(scenario.result.comparison.cost_change.absolute, 0, scenario.result.comparison.cost_change.absolute > 0 ? '+$' : '$', '')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Sentiment</div>
                      <div style={{ fontWeight: 600, color: scenario.result.comparison.sentiment_change.absolute > 0 ? 'var(--success)' : 'var(--error)' }}>
                        {formatNumber(scenario.result.comparison.sentiment_change.absolute, 2, scenario.result.comparison.sentiment_change.absolute > 0 ? '+' : '')}
                      </div>
                    </div>
                    <div style={{ textAlign: 'center', padding: '0.75rem', background: 'var(--surface)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Score</div>
                      <div style={{ fontWeight: 600 }}>
                        {scenario.result.comparison.improvements_count || 0}/4
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => runScenarioSimulation(scenario.id)}
                    disabled={scenario.isLoading}
                    style={{ 
                      width: '100%', 
                      marginTop: '0.75rem',
                      display: 'flex',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    {scenario.isLoading ? (
                      <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Running...</>
                    ) : (
                      <><BeakerIcon className="w-4 h-4" /> Run Simulation</>
                    )}
                  </button>
                )}

                {scenario.error && (
                  <p style={{ color: 'var(--error)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    {scenario.error}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <BeakerIcon className="w-6 h-6" /> Counterfactual Simulator
        </h2>
        
        {simulationResult && (
          <button
            onClick={exportSimulationData}
            style={{ 
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--surface-light)',
              border: '1px solid var(--border-color)'
            }}
          >
            <CloudArrowDownIcon className="w-5 h-5" />
            Export
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        marginBottom: '1.5rem',
        borderBottom: '2px solid var(--border-color)',
        overflowX: 'auto'
      }}>
        {[
          { id: 'simulation', label: 'Simulation', icon: BeakerIcon },
          { id: 'comparison', label: 'Multi-Scenario', icon: ScaleIcon },
          { id: 'causal', label: 'Causal Analysis', icon: LightBulbIcon },
          { id: 'sensitivity', label: 'Sensitivity', icon: AdjustmentsHorizontalIcon }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '0.75rem 1rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary-color)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary)',
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              whiteSpace: 'nowrap',
              marginBottom: '-2px'
            }}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'simulation' && (
        <div>
          {/* Input Section */}
          <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Original Decision (ID: {originalDecisionId})
              </label>
              <p className="evidence-text" style={{ margin: 0, fontSize: '0.9rem', background: 'var(--surface-light)' }}>
                "{originalDecisionText}"
              </p>
            </div>

            <div>
              <label htmlFor="alternateText" style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Alternative Decision Scenario
              </label>
              <textarea
                id="alternateText"
                value={alternateText}
                onChange={(e) => setAlternateText(e.target.value)}
                placeholder="Enter the alternative decision text here..."
                rows={3}
                disabled={isLoading}
                style={{ minHeight: '80px' }}
              />
            </div>

            {/* Advanced Parameters */}
            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={() => setShowAdvancedParams(!showAdvancedParams)}
                style={{
                  padding: '0.5rem',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--primary-color)',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <AdjustmentsHorizontalIcon className="w-4 h-4" />
                {showAdvancedParams ? 'Hide' : 'Show'} Advanced Parameters
              </button>

              {showAdvancedParams && (
                <div style={{ 
                  marginTop: '1rem', 
                  padding: '1rem', 
                  background: 'var(--surface-light)', 
                  borderRadius: 'var(--radius-md)',
                  display: 'grid',
                  gap: '1rem'
                }}>
                  <div>
                    <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                      Number of Simulations: {simParams.num_simulations}
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="500"
                      step="50"
                      value={simParams.num_simulations}
                      onChange={(e) => setSimParams(prev => ({ ...prev, num_simulations: parseInt(e.target.value) }))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>50</span>
                      <span>500</span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem' }}>
                      Confidence Level: {(simParams.confidence_level * 100).toFixed(0)}%
                    </label>
                    <input
                      type="range"
                      min="0.80"
                      max="0.99"
                      step="0.01"
                      value={simParams.confidence_level}
                      onChange={(e) => setSimParams(prev => ({ ...prev, confidence_level: parseFloat(e.target.value) }))}
                      style={{ width: '100%' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>80%</span>
                      <span>99%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {onRunSimulation && (
              <button
                onClick={handleSimulateClick}
                disabled={isLoading || !alternateText.trim()}
                style={{ marginTop: '1rem', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}
              >
                {isLoading ? (
                  <><ArrowPathIcon className="w-5 h-5 animate-spin" /> Simulating...</>
                ) : (
                  <><BeakerIcon className="w-5 h-5" /> Run Advanced Simulation</>
                )}
              </button>
            )}
            {error && <p style={{ color: 'var(--error)', fontSize: '0.9rem', marginTop: '0.5rem' }}>Error: {error}</p>}
          </div>

          {/* Results Section */}
          {simulationResult && !isLoading && !error && (
            <div className="fade-in">
              {/* Improvement Score */}
              {improvementMetrics && (
                <div style={{
                  background: `linear-gradient(135deg, ${improvementMetrics.improvementScore > 60 ? 'var(--success-light)' : 'var(--warning-light)'}, var(--surface-light))`,
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '1.5rem',
                  border: '1px solid var(--border-color)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Overall Improvement Score</h3>
                    <div style={{ 
                      fontSize: '2rem', 
                      fontWeight: 700, 
                      color: improvementMetrics.improvementScore > 60 ? 'var(--success)' : 'var(--warning)'
                    }}>
                      {improvementMetrics.improvementScore.toFixed(0)}%
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {improvementMetrics.metrics.map(metric => (
                      <div
                        key={metric.name}
                        style={{
                          padding: '0.5rem 1rem',
                          background: metric.improved ? 'var(--success-light)' : 'var(--error-light)',
                          color: metric.improved ? 'var(--success)' : 'var(--error)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.85rem',
                          fontWeight: 500
                        }}
                      >
                        {metric.improved ? '✓' : '✗'} {metric.name}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                <ScaleIcon className="w-5 h-5" /> Detailed Comparison
                <span
                  style={{
                    fontSize: '0.8rem',
                    color: 'var(--text-muted)',
                    background: 'var(--surface-light)',
                    padding: '0.25rem 0.75rem',
                    borderRadius: '1rem',
                    marginLeft: 'auto'
                  }}
                  title={`Simulation Confidence: ${(simulationResult.confidence * 100).toFixed(0)}%`}
                >
                  Confidence: {(simulationResult.confidence * 100).toFixed(0)}%
                </span>
              </h3>

              {/* Comparison Table */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: '0.75rem 1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Metric</div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'right' }}>Original</div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'right' }}>Simulated</div>
                <div style={{ fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'right' }}>Change</div>

                <div>Timeline</div>
                <div style={{ textAlign: 'right' }}>{formatNumber(simulationResult.original_outcome.timeline_days, 1, '', ' days')}</div>
                <div style={{ textAlign: 'right' }}>{formatNumber(simulationResult.counterfactual_outcome.timeline_days_mean, 1, '', ' days')}</div>
                <div style={{ textAlign: 'right', color: simulationResult.comparison.timeline_change.absolute < 0 ? 'var(--success)' : 'var(--error)' }}>
                  {formatNumber(simulationResult.comparison.timeline_change.absolute, 1, simulationResult.comparison.timeline_change.absolute > 0 ? '+' : '', ' days')}
                  <small> ({formatNumber(simulationResult.comparison.timeline_change.percentage, 0, simulationResult.comparison.timeline_change.percentage > 0 ? '+' : '', '%')})</small>
                </div>

                <div>Cost</div>
                <div style={{ textAlign: 'right' }}>{formatNumber(simulationResult.original_outcome.cost, 0, '$')}</div>
                <div style={{ textAlign: 'right' }}>{formatNumber(simulationResult.counterfactual_outcome.cost_mean, 0, '$')}</div>
                <div style={{ textAlign: 'right', color: simulationResult.comparison.cost_change.absolute < 0 ? 'var(--success)' : 'var(--error)' }}>
                  {formatNumber(simulationResult.comparison.cost_change.absolute, 0, simulationResult.comparison.cost_change.absolute > 0 ? '+$' : '$', '')}
                  <small> ({formatNumber(simulationResult.comparison.cost_change.percentage, 0, simulationResult.comparison.cost_change.percentage > 0 ? '+' : '', '%')})</small>
                </div>

                <div>Sentiment</div>
                <div style={{ textAlign: 'right' }}>{formatNumber(simulationResult.original_outcome.sentiment, 2)}</div>
                <div style={{ textAlign: 'right' }}>{formatNumber(simulationResult.counterfactual_outcome.sentiment_mean, 2)}</div>
                <div style={{ textAlign: 'right', color: simulationResult.comparison.sentiment_change.absolute > 0 ? 'var(--success)' : 'var(--error)' }}>
                  {formatNumber(simulationResult.comparison.sentiment_change.absolute, 2, simulationResult.comparison.sentiment_change.absolute > 0 ? '+' : '')}
                </div>

                {simulationResult.original_outcome.risk_score !== undefined && simulationResult.counterfactual_outcome.risk_score !== undefined && simulationResult.comparison.risk_change && (
                  <>
                    <div>Risk Score</div>
                    <div style={{ textAlign: 'right' }}>{formatNumber(simulationResult.original_outcome.risk_score, 2)}</div>
                    <div style={{ textAlign: 'right' }}>{formatNumber(simulationResult.counterfactual_outcome.risk_score, 2)}</div>
                    <div style={{ textAlign: 'right', color: simulationResult.comparison.risk_change.absolute < 0 ? 'var(--success)' : 'var(--error)' }}>
                      {formatNumber(simulationResult.comparison.risk_change.absolute, 2, simulationResult.comparison.risk_change.absolute > 0 ? '+' : '')}
                    </div>
                  </>
                )}
              </div>

              {/* Monte Carlo Visualization */}
              {renderDistributionChart()}

              {/* Recommendation */}
              <div style={{
                background: 'var(--surface-light)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
                borderLeft: `4px solid ${getRecommendationColor(simulationResult.comparison.overall_recommendation)}`,
                marginTop: '1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  {getRecommendationIcon(simulationResult.recommendation)}
                  <h4 style={{ margin: 0, fontSize: '1rem' }}>Recommendation</h4>
                </div>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  {simulationResult.recommendation}
                </p>
                <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  {simulationResult.comparison.summary}
                </p>
              </div>
            </div>
          )}

          {!simulationResult && !isLoading && !error && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 0' }}>
              Enter an alternative scenario above and click "Run Advanced Simulation" to see the comparison.
            </div>
          )}
        </div>
      )}

      {activeTab === 'comparison' && renderScenarioComparison()}
      {activeTab === 'causal' && renderCausalAnalysis()}
      {activeTab === 'sensitivity' && renderSensitivityAnalysis()}
    </div>
  );
};

export default CounterfactualSimulator;