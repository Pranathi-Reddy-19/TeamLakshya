// frontend/src/pages/HelpPage.tsx
import React, { useState } from 'react';
import {
  QuestionMarkCircleIcon,
  BookOpenIcon,
  ChevronDownIcon,
  EnvelopeIcon,
  ChatBubbleLeftRightIcon,
  CircleStackIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

// --- FAQ Item Component ---
interface FAQItemProps {
  question: string;
  children: React.ReactNode;
}

const FAQItem: React.FC<FAQItemProps> = ({ question, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-md)',
      background: 'var(--surface)',
      marginBottom: '1rem'
    }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '1.25rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontSize: '1rem',
          fontWeight: 600,
          color: 'var(--text-primary)'
        }}
      >
        {question}
        <ChevronDownIcon
          style={{
            width: '20px',
            height: '20px',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0,
            marginLeft: '1rem'
          }}
        />
      </button>
      {isOpen && (
        <div style={{
          padding: '0 1.25rem 1.25rem 1.25rem',
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6
        }}>
          {children}
        </div>
      )}
    </div>
  );
};

// --- Main Help Page ---
const HelpPage: React.FC = () => {
  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <header style={{ marginBottom: '2.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <QuestionMarkCircleIcon style={{ width: '40px', height: '40px', color: 'var(--text-primary)' }} />
        <div>
          <h2
            style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'var(--text-primary)',
              margin: 0,
            }}
          >
            Help & Support
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', margin: 0 }}>
            Find answers to your questions and learn how to use ContextIQ.
          </p>
        </div>
      </header>

      {/* Grid Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

        {/* Left Column: FAQs */}
        <div style={{ flex: 2 }}>
          <h3 style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            margin: '0 0 1.5rem 0',
            fontSize: '1.25rem'
          }}>
            <BookOpenIcon style={{ width: '24px', height: '24px' }} />
            Frequently Asked Questions
          </h3>

          <FAQItem question="What is ContextIQ?">
            <p>ContextIQ is an intelligent assistant designed to provide context-aware insights from your team's communication data. It helps you understand sentiment, track tasks, and make better decisions by analyzing conversations from tools like Slack, Jira, and Google Docs.</p>
          </FAQItem>

          <FAQItem question="How do I use the main chat?">
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)'}}>
              <ChatBubbleLeftRightIcon style={{ width: '16px', height: '16px' }} />
              Chat Interface
            </p>
            <p>The chat interface allows you to ask natural language questions. For example: "What is the team's mood this week?", "Summarize the #design channel from yesterday," or "What are Alex's open tasks?" The AI will query your connected data sources to give you a direct answer.</p>
          </FAQItem>
          
          <FAQItem question="What are Data Connectors?">
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)'}}>
              <CircleStackIcon style={{ width: '16px', height: '16px' }} />
              Connecting Your Tools
            </p>
            <p>The <strong>Connectors</strong> page shows the status of all available data sources. Configured connectors (like Slack or Notion) can be "synced" or "ingested" manually by clicking 'Run Ingestion'. This pulls the latest data into ContextIQ for analysis. You can also upload meeting transcripts directly.</p>
          </FAQItem>
          
          <FAQItem question="How do I read the Analytics Dashboards?">
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, color: 'var(--text-primary)'}}>
              <ChartBarIcon style={{ width: '16px', height: '16px' }} />
              Understanding Your Data
            </p>
            <p>Our analytics dashboards provide deep insights:</p>
            <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
              <li><strong>Sentiment:</strong> Tracks the positive, negative, and neutral tone of conversations over time and by channel.</li>
              <li><strong>Trust Graph:</strong> Visualizes who is agreeing with or reinforcing ideas from whom, helping you identify key influencers and collaborators.</li>
              <li><strong>Performance:</strong> Shows team metrics like top contributors, active channels, and average message response times.</li>
            </ul>
          </FAQItem>
        </div>

        {/* Right Column: Contact & Guides */}
        <div style={{ flex: 1 }}>
          {/* Getting Started Card */}
          <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'var(--surface-light)' }}>
            <h3 style={{ margin: '0 0 1rem 0' }}>Getting Started</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              1. Go to the <strong>Connectors</strong> page and sync your data sources.
              <br />
              2. Explore the <strong>Analytics</strong> dashboards to see team insights.
              <br />
              3. Ask a question in the <strong>Chat</strong> to get a specific answer.
            </p>
          </div>

          {/* Contact Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              margin: '0 0 1rem 0'
            }}>
              <EnvelopeIcon style={{ width: '20px', height: '20px' }} />
              Contact Support
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1rem 0' }}>
              Can't find the answer you're looking for? Our team is here to help.
            </p>
            <a
              href="mailto:support@contextiq.com" // Placeholder email
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                background: 'var(--primary-color)',
                color: 'white',
                padding: '0.75rem',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                textDecoration: 'none',
                width: '100%'
              }}
            >
              Email Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HelpPage;