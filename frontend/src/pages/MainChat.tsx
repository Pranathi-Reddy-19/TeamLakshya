// frontend/src/pages/MainChat.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import type { QueryResponse, EvidenceItem } from '../types';
import { fetchContextQuery } from '../services/api';
import ChatInput from '../components/ChatInput';
import ChatMessage from '../components/ChatMessage';
import NotificationBell from '../components/NotificationBell';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  evidence?: EvidenceItem[];
  timestamp?: string;
}

const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    {...props}
  >
    <path d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 22.5l-.394-1.933a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
  </svg>
);

const MainChat: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [includeGraph, setIncludeGraph] = useState(false);
  const [userRole, setUserRole] = useState<'analyst' | 'admin'>('analyst');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom only when new assistant messages arrive
  useEffect(() => {
    if (messagesEndRef.current && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Only auto-scroll for assistant messages (answers) and loading states
      if (lastMessage.role === 'assistant' || isLoading) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [messages, isLoading]);

  // Welcome Message
  useEffect(() => {
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: `Hi ${user?.full_name || user?.username || 'there'}! 👋

I'm **Context IQ**, your team's AI assistant. How can I help you today?`,
      timestamp: new Date().toISOString(),
    };
    setMessages([welcomeMessage]);
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() === '' || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const apiHistory = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    try {
      const res: QueryResponse = await fetchContextQuery(
        userMessage.content,
        5,
        includeGraph,
        apiHistory
      );

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        evidence: res.evidence,
        timestamp: new Date().toISOString(),
      };
      
      setMessages((prev) => [...prev, assistantMessage]);
      
    } catch (error) {
      console.error("Error fetching query:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ **Error**\n\nSorry, I encountered an error. Please try again.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const exampleQueries = [
    "What decisions were made last week?",
    "Who is working on the auth feature?",
    "What was the sentiment in #project-phoenix?",
    "Summarize the last Zoom sync",
  ];

  const handleExampleClick = (query: string) => {
    setInput(query);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 61px)',
      background: 'var(--background)',
      color: 'var(--text-primary)'
    }}>
      {/* Consolidated Header */}
      <header style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.75rem 1.5rem',
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border-color)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            Context IQ
          </h1>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.25rem 0.75rem',
            background: 'var(--primary-light)',
            color: 'var(--primary-color)',
            fontSize: '0.75rem',
            fontWeight: 600,
            borderRadius: '9999px',
          }}>
            <SparklesIcon style={{ width: '1rem', height: '1rem' }} />
            AI Powered
          </span>
        </div>

        {/* User info & Notifications */}
        {user && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <NotificationBell />
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              background: 'var(--primary-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              flexShrink: 0
            }}>
              {user.username?.[0]?.toUpperCase() || 'U'}
            </div>
          </div>
        )}
      </header>

      {/* Chat Messages Container */}
      <div
        ref={chatContainerRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.5rem',
          background: 'var(--surface)',
        }}
      >
        <div style={{ 
          maxWidth: '800px', 
          width: '100%', 
          margin: '0 auto', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.5rem' 
        }}>
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Example queries */}
          {messages.length === 1 && !isLoading && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1rem',
              padding: '2rem 1rem',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '1rem',
                width: '100%',
              }}>
                {exampleQueries.map((query, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleExampleClick(query)}
                    className="example-query-button"
                    style={{
                      padding: '1rem',
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-md)',
                      textAlign: 'left',
                      fontSize: '0.9rem',
                      color: 'var(--text-secondary)',
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                    }}
                  >
                    {query}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <ChatMessage
              message={{
                id: 'loading',
                role: 'assistant',
                content: 'Thinking...',
                timestamp: new Date().toISOString(),
              }}
              isLoading={true}
            />
          )}
          
          <div ref={messagesEndRef} style={{ height: '1px' }} />
        </div>
      </div>

      {/* Chat Input */}
      <ChatInput
        input={input}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        includeGraph={includeGraph}
        onGraphToggle={setIncludeGraph}
        userRole={userRole}
        onRoleToggle={setUserRole}
      />

      <style>{`
        .example-query-button:hover {
          background: var(--surface-hover);
          color: var(--text-primary);
          border-color: var(--border-color);
        }
      `}</style>
    </div>
  );
};

export default MainChat;