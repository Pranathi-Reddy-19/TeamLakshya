// frontend/src/types.ts

export interface EvidenceItem {
  event_id: string;
  score: number; // Relevance score (e.g., L2 distance from vector search)
  text: string;
  source: string;
  channel: string;
  user_name: string;
  timestamp: string | null;

  // Sentiment fields (added for enhanced context)
  sentiment_label?: 'positive' | 'negative' | 'neutral';
  sentiment_score?: number; // VADER compound score: -1.0 (negative) to 1.0 (positive)

  // Graph context from Neo4j relationships
  graph_context?: {
    related_decisions?: any[];
    related_tasks?: any[];
    related_entities?: any[];
  } | null;
}

export interface QueryResponse {
  query: string;
  answer: string;
  evidence: EvidenceItem[];
  metadata?: Record<string, any>;
}

// === NEW TYPES FOR RISK ANALYSIS ===
export interface DependencyItem {
  node_type: string;
  node_id: string;
  summary: string;
  link_type: string;
}

export interface SentimentItem {
  user_name: string;
  text: string;
  sentiment_label: 'positive' | 'negative' | 'neutral';
  sentiment_score: number;
  channel: string;
  timestamp: string;
}

export interface RiskAnalysisResponse {
  decision_text: string;
  key_entities: string[];
  dependencies: DependencyItem[];
  related_sentiments: SentimentItem[];
  summary: string;
}

// === NEW TYPES FOR TEAM DYNAMICS ===
export interface KnowledgeSilo {
  topic: string;
  user_id: string;
  user_name: string;
  event_count: number;
  percentage: number;
}
export interface KeyInfluencer {
  user_id: string;
  user_name: string;
  agreements_received: number;
  replies_received: number;
  total_score: number;
}
export interface TeamInteraction {
  team_a: string;
  team_b: string;
  interaction_count: number;
}
export interface TeamDynamicsResponse {
  knowledge_silos: KnowledgeSilo[];
  key_influencers: KeyInfluencer[];
  team_interactions: TeamInteraction[];
}