// frontend/src/pages/Productivity.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircleIcon,
  DocumentTextIcon,
  ListBulletIcon,
  ArrowPathIcon,
  PaperAirplaneIcon,
  UserCircleIcon,
  ClockIcon,
  TicketIcon,
} from '@heroicons/react/24/outline';
import ReactMarkdown from 'react-markdown';
import {
  fetchOpenTasks,
  updateTaskStatus,
  fetchSummary,
  createJiraIssue,
  TaskItem,
  TaskStatus,
  SummarizationResponse,
} from '../services/api';

// === TASK BOARD ===
const TaskBoard: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jiraLoading, setJiraLoading] = useState<Record<string, boolean>>({});

  const loadTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const openTasks = await fetchOpenTasks();
      setTasks(openTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStatusChange = async (taskId: string, newStatus: TaskStatus) => {
    try {
      const updatedTask = await updateTaskStatus(taskId, newStatus);
      if (updatedTask.status === 'completed') {
        setTasks((prev) => prev.filter((t) => t.task_id !== taskId));
      } else {
        setTasks((prev) =>
          prev.map((t) => (t.task_id === taskId ? updatedTask : t))
        );
      }
    } catch (err) {
      alert(
        `Failed to update task: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    }
  };

  // === CREATE JIRA ISSUE ===
  const handleCreateJiraIssue = async (task: TaskItem) => {
    setJiraLoading((prev) => ({ ...prev, [task.task_id]: true }));

    // TODO: In production, show a modal to input project key
    const JIRA_PROJECT_KEY = "PROJ"; // REPLACE with your actual Jira project key

    try {
      const jiraResponse = await createJiraIssue({
        project_key: JIRA_PROJECT_KEY,
        summary: task.text,
        description: `Created from ContextIQ Task ID: ${task.task_id}\n\n${task.text}`,
        task_id: task.task_id,
      });

      alert(`Jira issue created: ${jiraResponse.key}`);
      handleStatusChange(task.task_id, 'in_progress');
    } catch (err) {
      alert(
        `Failed to create Jira issue: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setJiraLoading((prev) => ({ ...prev, [task.task_id]: false }));
    }
  };

  const formatTimeAgo = (isoString?: string): string => {
    if (!isoString) return 'unknown';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return `${diffDays} days ago`;
  };

  return (
    <div className="task-board">
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ListBulletIcon className="w-6 h-6" /> Open Action Items
        </h3>
        <button
          onClick={loadTasks}
          disabled={isLoading}
          style={{
            background: 'var(--surface-light)',
            padding: '0.5rem 1rem',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <ArrowPathIcon
            className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {/* Loading / Error / Empty States */}
      {isLoading && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
          Loading tasks...
        </p>
      )}
      {error && (
        <p style={{ color: 'var(--error)', textAlign: 'center' }}>
          Error: {error}
        </p>
      )}
      {!isLoading && !error && tasks.length === 0 && (
        <div
          style={{
            padding: '2rem',
            background: 'var(--surface-light)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          <CheckCircleIcon
            className="w-12 h-12"
            style={{ margin: '0 auto 1rem', color: 'var(--success)' }}
          />
          <p style={{ margin: 0, fontSize: '1.1rem' }}>All tasks complete!</p>
        </div>
      )}

      {/* Task List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {tasks.map((task) => {
          const isJiraLoading = jiraLoading[task.task_id] || false;

          return (
            <div
              key={task.task_id}
              className="card"
              style={{
                padding: '1rem',
                background: 'var(--surface-light)',
                borderLeft: '4px solid var(--primary-color)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <p
                style={{
                  margin: 0,
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  lineHeight: '1.5',
                }}
              >
                {task.text}
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '1rem',
                  gap: '1rem',
                  flexWrap: 'wrap',
                }}
              >
                {/* Assignee & Time */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1rem',
                    fontSize: '0.85rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <UserCircleIcon className="w-4 h-4" />
                    {task.assignee_name || 'Unassigned'}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <ClockIcon className="w-4 h-4" />
                    {formatTimeAgo(task.created_at)}
                  </span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {/* Jira Button */}
                  <button
                    onClick={() => handleCreateJiraIssue(task)}
                    disabled={isJiraLoading}
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-color)',
                      padding: '0.25rem 0.75rem',
                      fontSize: '0.85rem',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      borderRadius: 'var(--radius-sm)',
                      cursor: isJiraLoading ? 'not-allowed' : 'pointer',
                      opacity: isJiraLoading ? 0.6 : 1,
                    }}
                  >
                    {isJiraLoading ? (
                      <ArrowPathIcon className="w-4 h-4 animate-spin" />
                    ) : (
                      <TicketIcon className="w-4 h-4" />
                    )}
                    Jira
                  </button>

                  {/* Status Dropdown */}
                  <select
                    value={task.status}
                    onChange={(e) =>
                      handleStatusChange(task.task_id, e.target.value as TaskStatus)
                    }
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      padding: '0.25rem 0.5rem',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="blocked">Blocked</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// === SUMMARIZER ===
const Summarizer: React.FC = () => {
  const [channelId, setChannelId] = useState('#project-phoenix');
  const [lookbackHours, setLookbackHours] = useState(72);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SummarizationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSummarize = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetchSummary(channelId, lookbackHours);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="summarizer">
      <h3
        style={{
          margin: 0,
          color: 'var(--text-primary)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1.5rem',
        }}
      >
        <DocumentTextIcon className="w-6 h-6" /> AI Summarizer
      </h3>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <input
          type="text"
          value={channelId}
          onChange={(e) => setChannelId(e.target.value)}
          placeholder="Enter channel (e.g., #project-phoenix)"
          style={{
            flex: 1,
            padding: '0.75rem',
            fontSize: '1rem',
            background: 'var(--surface-light)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        />
        <select
          value={lookbackHours}
          onChange={(e) => setLookbackHours(Number(e.target.value))}
          style={{
            padding: '0.75rem',
            fontSize: '1rem',
            background: 'var(--surface-light)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <option value={24}>Last 24 Hours</option>
          <option value={72}>Last 3 Days</option>
          <option value={168}>Last 7 Days</option>
        </select>
      </div>

      <button
        onClick={handleSummarize}
        disabled={isLoading || !channelId}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.75rem',
          background: 'var(--primary-color)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          cursor: 'pointer',
          fontWeight: '500',
          opacity: isLoading || !channelId ? 0.6 : 1,
        }}
      >
        {isLoading ? (
          <ArrowPathIcon className="w-5 h-5 animate-spin" />
        ) : (
          <PaperAirplaneIcon className="w-5 h-5" />
        )}
        {isLoading ? 'Generating...' : 'Generate Summary'}
      </button>

      {error && (
        <p style={{ color: 'var(--error)', marginTop: '1rem', textAlign: 'center' }}>
          Error: {error}
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1.5rem',
            background: 'var(--surface-light)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h4 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>
            Summary for {result.channel_id} ({result.event_count} events)
          </h4>
          <div className="chat-markdown" style={{ fontSize: '0.95rem', lineHeight: '1.6' }}>
            <ReactMarkdown>{result.summary}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
};

// === MAIN PRODUCTIVITY PAGE ===
const Productivity: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'tasks' | 'summary'>('tasks');

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2rem' }}>
        <h1
          style={{
            fontSize: '2.5rem',
            fontWeight: '700',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}
        >
          Productivity Suite
        </h1>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
          Manage open tasks and generate AI-powered summaries.
        </p>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button
          onClick={() => setActiveTab('tasks')}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: activeTab === 'tasks' ? 'var(--primary-color)' : 'var(--surface-light)',
            color: activeTab === 'tasks' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <ListBulletIcon className="w-5 h-5" />
          Action Items
        </button>
        <button
          onClick={() => setActiveTab('summary')}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: activeTab === 'summary' ? 'var(--primary-color)' : 'var(--surface-light)',
            color: activeTab === 'summary' ? 'white' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <DocumentTextIcon className="w-5 h-5" />
          AI Summarizer
        </button>
      </div>

      {/* Content */}
      <div
        className="card"
        style={{
          padding: '1.5rem 2rem',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        {activeTab === 'tasks' ? <TaskBoard /> : <Summarizer />}
      </div>
    </div>
  );
};

export default Productivity;