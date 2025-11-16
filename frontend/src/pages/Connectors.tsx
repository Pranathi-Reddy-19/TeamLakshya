// frontend/src/pages/Connectors.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  CircleStackIcon,
  CloudArrowDownIcon,
  XCircleIcon,
  CloudArrowUpIcon,
  VideoCameraIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

import {
  fetchConnectorStatus,
  runConnectorIngestion,
  uploadAudioFile,
} from '../services/api';

import type {
  ConnectorStatus,
  IngestionRunResponse,
  AudioUploadResponse
} from '../types';

// --- Import the WebSocket hook from AuthContext ---
import { useAuth } from '../context/AuthContext';


const getConnectorIcon = (source: string) => {
  if (source.includes('slack')) return 'SL';
  if (source.includes('notion')) return 'N';
  if (source.includes('google') || source.includes('gdocs') || source.includes('gmail')) return 'G';
  if (source.includes('discord')) return 'D';
  if (source.includes('teams')) return 'T';
  if (source.includes('local_files')) return '📁';
  if (source.includes('jira')) return 'J';
  return '🔗';
};

// === CONNECTOR CARD (Updated) ===
const ConnectorCard: React.FC<{
  source: string;
  configured: boolean;
  onRunIngestion: (source: string) => void;
  loadingState: Record<string, boolean>;
  resultState: Record<string, IngestionRunResponse | null>;
}> = ({ source, configured, onRunIngestion, loadingState, resultState }) => {
  const isLoading = loadingState[source] || false;
  const result = resultState[source] || null;

  // Determine button state
  const isQueued = result?.status === 'queued';
  const buttonDisabled = !configured || isLoading || isQueued;
  
  let buttonIcon = <CloudArrowDownIcon style={{ width: '20px', height: '20px' }} />;
  let buttonText = 'Run Ingestion';
  
  if (isLoading) {
    buttonIcon = <ArrowPathIcon style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} />;
    buttonText = 'Syncing...';
  } else if (isQueued) {
    buttonIcon = <ClockIcon style={{ width: '20px', height: '20px' }} />;
    buttonText = 'Queued...';
  }

  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        opacity: configured ? 1 : 0.6,
        borderLeft: `4px solid ${configured ? 'var(--success)' : 'var(--border-color)'}`,
        minHeight: '200px'
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span
            style={{
              width: '48px',
              height: '48px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-light)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 600,
              flexShrink: 0
            }}
          >
            {getConnectorIcon(source)}
          </span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ 
              margin: 0, 
              textTransform: 'capitalize',
              fontSize: '1.125rem',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {source.replace('_', ' ')}
            </h3>
            <span
              style={{
                fontSize: '0.85rem',
                color: configured ? 'var(--success)' : 'var(--text-muted)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem'
              }}
            >
              {configured ? (
                <CheckCircleIcon style={{ width: '16px', height: '16px' }} />
              ) : (
                <XCircleIcon style={{ width: '16px', height: '16px' }} />
              )}
              {configured ? 'Configured' : 'Not Configured'}
            </span>
          </div>
        </div>
        <p
          style={{
            fontSize: '0.9rem',
            color: 'var(--text-secondary)',
            minHeight: '40px',
            margin: 0
          }}
        >
          {configured
            ? `Sync recent activity from ${source}.`
            : `Please configure this connector in your .env file.`}
        </p>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        {result && (
          <div
            style={{
              padding: '0.75rem',
              background: result.status.startsWith('success')
                ? 'var(--success-light)'
                : result.status === 'queued'
                ? 'var(--info-light)'
                : 'var(--error-light)',
              color: result.status.startsWith('success')
                ? 'var(--success)'
                : result.status === 'queued'
                ? 'var(--info)'
                : 'var(--error)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}
          >
            <p style={{ fontWeight: 600, margin: '0 0 0.25rem 0' }}>{result.message}</p>
            {result.status === 'success' && (
              <p style={{ margin: '0 0 0.25rem 0' }}>Processed: {result.total_events} events</p>
            )}
            {result.duration_seconds > 0 && (
              <p style={{ margin: 0 }}>Duration: {result.duration_seconds.toFixed(2)}s</p>
            )}
          </div>
        )}
        <button
          onClick={() => onRunIngestion(source)}
          disabled={buttonDisabled}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            background: buttonDisabled ? 'var(--surface-light)' : 'var(--primary-color)',
            color: buttonDisabled ? 'var(--text-muted)' : 'white',
            padding: '0.75rem',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: buttonDisabled ? 'not-allowed' : 'pointer',
            opacity: buttonDisabled ? 0.6 : 1
          }}
        >
          {buttonIcon}
          {buttonText}
        </button>
      </div>
    </div>
  );
};

// === AUDIO UPLOAD CARD (Updated) ===
const AudioUploadCard: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<AudioUploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const { lastMessage } = useAuth();

  useEffect(() => {
    if (lastMessage?.type === 'AUDIO_PROCESSED' && result?.status === 'queued') {
      const payload = lastMessage.payload;
      if (payload.filename === file?.name) {
        if (payload.status === 'success') {
          setResult({
            file_name: payload.filename,
            status: 'success',
            message: 'Audio processed and ingested!',
            events_processed: 1
          });
        } else {
          setError(`Transcription failed: ${payload.error}`);
        }
        setIsLoading(false);
        setFile(null);
      }
    }
  }, [lastMessage, file, result]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsLoading(true);
    setProgress(0);
    setError(null);
    setResult(null);
    try {
      const response = await uploadAudioFile(file, (percent) => {
        setProgress(percent);
      });
      setResult(response);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--accent-color)', minHeight: '200px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <span
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--surface-light)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-color)',
            flexShrink: 0
          }}
        >
          <VideoCameraIcon style={{ width: '24px', height: '24px' }} />
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ 
            margin: 0, 
            textTransform: 'capitalize',
            fontSize: '1.125rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            Meeting Transcription
          </h3>
          <span
            style={{
              fontSize: '0.85rem',
              color: 'var(--accent-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem'
            }}
          >
            <CheckCircleIcon style={{ width: '16px', height: '16px' }} />
            Ready to Upload
          </span>
        </div>
      </div>
      <p
        style={{
          fontSize: '0.9rem',
          color: 'var(--text-secondary)',
          minHeight: '40px',
          margin: 0
        }}
      >
        Upload a meeting audio file (MP3, M4A, WAV) to transcribe and ingest it.
      </p>
      <div style={{ marginTop: '1.5rem' }}>
        {result && (
          <div
            style={{
              padding: '0.75rem',
              background: result.status === 'success' ? 'var(--success-light)' : 'var(--info-light)',
              color: result.status === 'success' ? 'var(--success)' : 'var(--info)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}
          >
            <p style={{ fontWeight: 600, margin: 0 }}>{result.message}</p>
          </div>
        )}
        {error && (
          <div
            style={{
              padding: '0.75rem',
              background: 'var(--error-light)',
              color: 'var(--error)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.85rem',
              marginBottom: '1rem'
            }}
          >
            <p style={{ fontWeight: 600, margin: 0 }}>{error}</p>
          </div>
        )}
        {isLoading && result?.status !== 'queued' && (
          <div style={{ marginBottom: '1rem' }}>
            <div
              style={{
                background: 'var(--surface-light)',
                borderRadius: 'var(--radius-sm)',
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '10px',
                  background: 'var(--primary-color)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            <p
              style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: '0.5rem',
                margin: '0.5rem 0 0 0'
              }}
            >
              Uploading {progress.toFixed(0)}%...
            </p>
          </div>
        )}
        {isLoading && result?.status === 'queued' && (
           <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
             <ArrowPathIcon style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite', color: 'var(--text-secondary)', margin: '0 auto' }} />
             <p style={{
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                textAlign: 'center',
                marginTop: '0.5rem',
              }}>
                Transcribing (this may take a minute)...
             </p>
           </div>
        )}

        <input
          type="file"
          id="audio-upload"
          accept="audio/mpeg, audio/mp4, audio/wav, audio/x-m4a, video/mp4"
          onChange={handleFileChange}
          style={{ display: 'none' }}
          disabled={isLoading}
        />
        <label
          htmlFor="audio-upload"
          style={{
            display: 'block',
            padding: '0.75rem',
            background: 'var(--surface-light)',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
            textAlign: 'center',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '0.9rem',
            color: file ? 'var(--text-primary)' : 'var(--text-secondary)',
            marginBottom: '1rem',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            opacity: isLoading ? 0.6 : 1
          }}
        >
          {file ? file.name : 'Click to select audio file'}
        </label>

        <button
          onClick={handleUpload}
          disabled={!file || isLoading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            background: !file || isLoading ? 'var(--surface-light)' : 'var(--primary-color)',
            color: 'white',
            padding: '0.75rem',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: !file || isLoading ? 'not-allowed' : 'pointer',
            opacity: !file || isLoading ? 0.6 : 1
          }}
        >
          <CloudArrowUpIcon style={{ width: '20px', height: '20px' }} />
          Upload and Transcribe
        </button>
      </div>
    </div>
  );
};

// === MAIN CONNECTORS PAGE (Updated) ===
const Connectors: React.FC = () => {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadingState, setLoadingState] = useState<Record<string, boolean>>({});
  const [resultState, setResultState] = useState<Record<string, IngestionRunResponse | null>>({});
  
  const { lastMessage } = useAuth();

  const fetchConnectors = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchConnectorStatus();
      setConnectors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);
  
  useEffect(() => {
    if (lastMessage?.type === 'INGESTION_COMPLETE') {
      const stats = lastMessage.payload as IngestionRunResponse;
      const source = stats.source;
      
      setResultState((prev) => ({
        ...prev,
        [source]: stats,
      }));
      
      setLoadingState((prev) => ({
        ...prev,
        [source]: false
      }));
    }
  }, [lastMessage]);

  const handleRunIngestion = useCallback(async (source: string) => {
    setLoadingState((prev) => ({ ...prev, [source]: true }));
    setResultState((prev) => ({ ...prev, [source]: null }));
    try {
      const result = await runConnectorIngestion(source);
      setResultState((prev) => ({ ...prev, [source]: result }));
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      console.error(err);
      // FIXED: Reset status if the API call itself fails
      setResultState((prev) => ({
        ...prev,
        [source]: {
          source,
          status: 'error',
          error: errorMsg,
          message: 'Failed to start task',
          total_events: 0,
          vectors_inserted: 0,
          duration_seconds: 0
        }
      }));
      setLoadingState((prev) => ({ ...prev, [source]: false }));
    }
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
        <ArrowPathIcon style={{ width: '40px', height: '40px', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem' }}>
        <div className="card" style={{ background: 'var(--error-light)', color: 'var(--error)', borderColor: 'var(--error)' }}>
          <p style={{ margin: 0, fontWeight: 600 }}>Error loading connectors: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1300px', margin: '0 auto', padding: '2rem 1rem' }}>
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
            flexWrap: 'wrap'
          }}
        >
          <CircleStackIcon style={{ width: '40px', height: '40px' }} />
          Data Connectors
        </h2>
        <p style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
          Manage and run data ingestion from your team's tools.
        </p>
      </header>

      {/* Connector Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.5rem'
        }}
      >
        {/* Audio Upload Card */}
        <AudioUploadCard />

        {/* Dynamic Connectors */}
        {connectors
          .filter(conn => conn.source !== 'notion')
          .map((conn) => (
          <ConnectorCard
            key={conn.source}
            source={conn.source}
            configured={conn.configured}
            onRunIngestion={handleRunIngestion}
            loadingState={loadingState}
            resultState={resultState}
          />
        ))}
      </div>
    </div>
  );
};

export default Connectors;