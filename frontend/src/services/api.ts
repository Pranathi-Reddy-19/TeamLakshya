// frontend/src/services/api.ts
import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios';
import type {
  QueryResponse,
  ChatMessage,
  SentimentOverviewData,
  ChannelSentimentSummary,
  SentimentTimelinePoint,
  ConnectorStatus,
  IngestionRunResponse,
  TaskItem,
  TaskStatus,
  SummarizationResponse,
  JiraIssueRequest,
  JiraIssueResponse,
  AudioUploadResponse,
  PerformanceAnalyticsResponse,
  LoginCredentials,
  RegisterPayload,
  User,
  RiskAnalysisResponse,
  TeamDynamicsResponse, // <-- THIS IS THE FIX
} from '../types';

// ============================================================================
// AXIOS INSTANCE & AUTH SETUP
// ============================================================================

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Request Interceptor: Auto-inject JWT token ---
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- Response Interceptor: Global 401 Handling ---
api.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid → log out globally
      localStorage.removeItem('token');
      window.location.href = '/login';
      return Promise.reject(new Error('Authentication failed. Redirecting to login.'));
    }

    const message = 
      (error.response?.data as any)?.detail || 
      error.message || 
      'An unexpected error occurred';

    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Login user and return access token
 */
export const login = async (credentials: LoginCredentials) => {
  const formData = new URLSearchParams();
  formData.append('username', credentials.username);
  formData.append('password', credentials.password);

  const response = await api.post('/auth/token', formData, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  return response.data; // { access_token: string, token_type: 'bearer' }
};

/**
 * Register a new user
 */
export const register = async (payload: RegisterPayload): Promise<User> => {
  const response = await api.post<User>('/auth/register', payload);
  return response.data;
};

/**
 * Get current authenticated user
 */
export const getMe = async (): Promise<User> => {
  const response = await api.get<User>('/auth/users/me');
  return response.data;
};

// ============================================================================
// QUERY & CONTEXT
// ============================================================================

export const fetchContextQuery = async (
  query: string,
  topK: number = 5,
  includeGraph: boolean = false,
  chatHistory: ChatMessage[] = []
): Promise<QueryResponse> => {
  const response = await api.post<QueryResponse>('/query', {
    text: query,
    top_k: topK,
    include_graph_context: includeGraph,
    chat_history: chatHistory,
  });
  return response.data;
};

// ============================================================================
// CONNECTOR & INGESTION
// ============================================================================

export const fetchConnectorStatus = async (): Promise<ConnectorStatus[]> => {
  const response = await api.get<ConnectorStatus[]>('/ingest/connectors');
  return response.data;
};

export const runConnectorIngestion = async (source: string): Promise<IngestionRunResponse> => {
  const response = await api.post<IngestionRunResponse>(`/ingest/run/${source}`);
  return response.data;
};

export const runIngestion = async (): Promise<IngestionRunResponse> => {
  return runConnectorIngestion('slack');
};

// ============================================================================
// TASK MANAGEMENT
// ============================================================================

export const fetchOpenTasks = async (): Promise<TaskItem[]> => {
  const response = await api.get<TaskItem[]>('/tasks/open');
  return response.data;
};

export const updateTaskStatus = async (taskId: string, status: TaskStatus): Promise<TaskItem> => {
  const response = await api.put<TaskItem>(`/tasks/${taskId}`, { status });
  return response.data;
};

// ============================================================================
// SUMMARIZATION
// ============================================================================

export const fetchSummary = async (
  channelId: string,
  lookbackHours: number
): Promise<SummarizationResponse> => {
  const response = await api.post<SummarizationResponse>('/summarize', {
    channel_id: channelId,
    lookback_hours: lookbackHours,
  });
  return response.data;
};

// ============================================================================
// AUDIO UPLOAD
// ============================================================================

export const uploadAudioFile = async (
  file: File,
  onProgress: (percent: number) => void
): Promise<AudioUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<AudioUploadResponse>('/ingest/upload-audio', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  onProgress(100);
  return response.data;
};

// ============================================================================
// JIRA INTEGRATION
// ============================================================================

export const createJiraIssue = async (issueData: JiraIssueRequest): Promise<JiraIssueResponse> => {
  const response = await api.post<JiraIssueResponse>('/integrations/jira/create-issue', issueData);
  return response.data;
};

// ============================================================================
// PERFORMANCE ANALYTICS
// ============================================================================

export const fetchPerformanceAnalytics = async (): Promise<PerformanceAnalyticsResponse> => {
  const response = await api.get<PerformanceAnalyticsResponse>('/analytics/performance');
  return response.data;
};

// ============================================================================
// RISK ANALYSIS
// ============================================================================

/**
 * Runs a risk and dependency analysis on a proposed decision.
 */
export const runRiskAnalysis = async (decision_text: string): Promise<RiskAnalysisResponse> => {
  const response = await api.post<RiskAnalysisResponse>('/analytics/risk-analysis', {
    decision_text: decision_text,
  });
  return response.data;
};

// ============================================================================
// TEAM DYNAMICS
// ============================================================================

/**
 * Fetches team dynamics insights from the graph.
 */
export const fetchTeamDynamics = async (): Promise<TeamDynamicsResponse> => {
  const response = await api.get<TeamDynamicsResponse>('/analytics/team-dynamics');
  return response.data;
};

// ============================================================================
// SIMULATION
// ============================================================================

export const simulateCounterfactual = async (
  originalDecisionId: string,
  alternateDecisionText: string
): Promise<any> => {
  const response = await api.post('/simulate/counterfactual', {
    original_decision_id: originalDecisionId,
    alternate_decision_text: alternateDecisionText,
  });
  return response.data;
};

// ============================================================================
// SENTIMENT ANALYSIS
// ============================================================================

export const fetchSentimentOverview = async (): Promise<SentimentOverviewData> => {
  const response = await api.get<SentimentOverviewData>('/sentiment/overview');
  return response.data;
};

export const fetchChannelSentimentSummary = async (): Promise<ChannelSentimentSummary[]> => {
  const response = await api.get<ChannelSentimentSummary[]>('/sentiment/channels/summary');
  return response.data;
};

export const fetchSentimentTimeline = async (days: number = 7): Promise<SentimentTimelinePoint[]> => {
  const response = await api.get<SentimentTimelinePoint[]>('/sentiment/timeline', { params: { days } });
  return response.data;
};

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Set or clear JWT token in localStorage and axios headers
 */
export const setAuthToken = (token: string | null) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
  // Request interceptor will pick it up automatically
};