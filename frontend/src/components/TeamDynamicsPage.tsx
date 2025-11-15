// frontend/src/components/TrustGraph.tsx
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import type { ForceGraphMethods } from 'react-force-graph-2d';
import { fetchTrustGraph } from '../services/api';
import {
  UserGroupIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  FunnelIcon,
  ChartBarIcon,
  MagnifyingGlassIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  AdjustmentsHorizontalIcon,
  SparklesIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline';

// Enhanced node and link interfaces
interface GraphNode {
  id: string;
  name: string;
  community?: number;
  centrality?: number;
  totalAgreements?: number;
  val?: number;
  color?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  value: number;
  trust_score?: number;
  width?: number;
  color?: string;
}

interface EnhancedGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface GraphStatistics {
  totalNodes: number;
  totalLinks: number;
  totalAgreements: number;
  averageAgreements: number;
  maxAgreements: number;
  communities: number;
  networkDensity: number;
  topInfluencers: Array<{ name: string; centrality: number }>;
}

const TrustGraph: React.FC = () => {
  const [graphData, setGraphData] = useState<EnhancedGraphData>({ nodes: [], links: [] });
  const [filteredData, setFilteredData] = useState<EnhancedGraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 600, height: 500 });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<GraphLink>>(new Set());
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  
  // Filters and controls
  const [minAgreements, setMinAgreements] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCommunities, setShowCommunities] = useState(true);
  const [nodeSize, setNodeSize] = useState<'uniform' | 'centrality' | 'agreements'>('centrality');
  const [layoutStrength, setLayoutStrength] = useState(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showParticles, setShowParticles] = useState(true);
  const [activeView, setActiveView] = useState<'graph' | 'stats'>('graph');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods<GraphNode, GraphLink>>();

  // Community colors (distinct palette)
  const communityColors = [
    '#667eea', // Purple
    '#f093fb', // Pink
    '#4facfe', // Blue
    '#43e97b', // Green
    '#fa709a', // Rose
    '#fee140', // Yellow
    '#30cfd0', // Cyan
    '#a8edea', // Mint
    '#fbc2eb', // Lavender
    '#f78ca0'  // Coral
  ];

  // Load and process graph data
  const loadGraphData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTrustGraph(minAgreements);
      
      // Enhance nodes with additional metrics
      const enhancedNodes = data.nodes.map((node: any, idx: number) => {
        // Calculate total agreements for this node
        const totalAgreements = data.links
          .filter((link: any) => link.source === node.id || link.target === node.id)
          .reduce((sum: number, link: any) => sum + (link.value || 0), 0);
        
        return {
          ...node,
          community: idx % 5, // Simple community detection (replace with actual algorithm)
          totalAgreements,
          centrality: 0 // Will be calculated
        };
      });

      // Calculate centrality (degree centrality)
      enhancedNodes.forEach((node: GraphNode) => {
        const connections = data.links.filter(
          (link: any) => link.source === node.id || link.target === node.id
        );
        node.centrality = connections.length;
      });

      // Enhance links
      const enhancedLinks = data.links.map((link: any) => ({
        ...link,
        trust_score: link.trust_score || 0.5
      }));

      const enhancedData = {
        nodes: enhancedNodes,
        links: enhancedLinks
      };

      setGraphData(enhancedData);
      setFilteredData(enhancedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trust graph');
    } finally {
      setIsLoading(false);
    }
  }, [minAgreements]);

  // Apply filters and search
  useEffect(() => {
    if (!graphData.nodes.length) return;

    let filtered = { ...graphData };

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchingNodeIds = new Set(
        filtered.nodes
          .filter(node => node.name.toLowerCase().includes(searchLower))
          .map(node => node.id)
      );

      filtered.nodes = filtered.nodes.filter(node => matchingNodeIds.has(node.id));
      filtered.links = filtered.links.filter(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return matchingNodeIds.has(sourceId) && matchingNodeIds.has(targetId);
      });
    }

    setFilteredData(filtered);
  }, [graphData, searchTerm]);

  // Handle node selection and highlighting
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    
    // Highlight connected nodes and links
    const connectedNodeIds = new Set<string>();
    const connectedLinks = new Set<GraphLink>();

    filteredData.links.forEach(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;

      if (sourceId === node.id) {
        connectedNodeIds.add(targetId);
        connectedLinks.add(link);
      } else if (targetId === node.id) {
        connectedNodeIds.add(sourceId);
        connectedLinks.add(link);
      }
    });

    connectedNodeIds.add(node.id);
    setHighlightNodes(connectedNodeIds);
    setHighlightLinks(connectedLinks);
  }, [filteredData]);

  const handleBackgroundClick = useCallback(() => {
    setSelectedNode(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  // Calculate statistics
  const statistics = useMemo((): GraphStatistics => {
    if (!graphData.nodes.length) {
      return {
        totalNodes: 0,
        totalLinks: 0,
        totalAgreements: 0,
        averageAgreements: 0,
        maxAgreements: 0,
        communities: 0,
        networkDensity: 0,
        topInfluencers: []
      };
    }

    const totalAgreements = graphData.links.reduce((sum, link) => sum + (link.value || 0), 0);
    const maxAgreements = Math.max(...graphData.links.map(link => link.value || 0), 0);
    const communities = new Set(graphData.nodes.map(node => node.community)).size;
    
    // Network density: actual links / possible links
    const possibleLinks = (graphData.nodes.length * (graphData.nodes.length - 1)) / 2;
    const networkDensity = possibleLinks > 0 ? graphData.links.length / possibleLinks : 0;

    // Top influencers by centrality
    const topInfluencers = [...graphData.nodes]
      .sort((a, b) => (b.centrality || 0) - (a.centrality || 0))
      .slice(0, 5)
      .map(node => ({
        name: node.name,
        centrality: node.centrality || 0
      }));

    return {
      totalNodes: graphData.nodes.length,
      totalLinks: graphData.links.length,
      totalAgreements,
      averageAgreements: totalAgreements / graphData.links.length || 0,
      maxAgreements,
      communities,
      networkDensity,
      topInfluencers
    };
  }, [graphData]);

  // Node styling
  const getNodeColor = useCallback((node: GraphNode) => {
    if (selectedNode && !highlightNodes.has(node.id)) {
      return 'rgba(200, 200, 200, 0.3)'; // Dim non-highlighted nodes
    }
    
    if (showCommunities && node.community !== undefined) {
      return communityColors[node.community % communityColors.length];
    }
    
    // Color by centrality
    const centrality = node.centrality || 0;
    const maxCentrality = Math.max(...graphData.nodes.map(n => n.centrality || 0), 1);
    const intensity = centrality / maxCentrality;
    
    return `rgba(102, 126, 234, ${0.4 + intensity * 0.6})`;
  }, [selectedNode, highlightNodes, showCommunities, graphData.nodes, communityColors]);

  const getNodeSize = useCallback((node: GraphNode) => {
    if (nodeSize === 'uniform') return 5;
    
    if (nodeSize === 'centrality') {
      const centrality = node.centrality || 0;
      const maxCentrality = Math.max(...graphData.nodes.map(n => n.centrality || 0), 1);
      return 3 + (centrality / maxCentrality) * 12;
    }
    
    if (nodeSize === 'agreements') {
      const agreements = node.totalAgreements || 0;
      const maxAgreements = Math.max(...graphData.nodes.map(n => n.totalAgreements || 0), 1);
      return 3 + (agreements / maxAgreements) * 12;
    }
    
    return 5;
  }, [nodeSize, graphData.nodes]);

  // Link styling
  const getLinkColor = useCallback((link: GraphLink) => {
    if (selectedNode && !highlightLinks.has(link)) {
      return 'rgba(200, 200, 200, 0.15)';
    }
    
    // Color by trust score
    const trustScore = link.trust_score || 0.5;
    const hue = 120 * trustScore; // 0 = red, 120 = green
    return `hsla(${hue}, 70%, 50%, 0.4)`;
  }, [selectedNode, highlightLinks]);

  const getLinkWidth = useCallback((link: GraphLink) => {
    const baseWidth = Math.min(Math.max(0.5, Math.log(link.value + 1) * 0.8), 5);
    
    if (selectedNode && highlightLinks.has(link)) {
      return baseWidth * 1.5;
    }
    
    return baseWidth;
  }, [selectedNode, highlightLinks]);

  // Zoom controls
  const handleZoomIn = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom * 1.3, 400);
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (graphRef.current) {
      const currentZoom = graphRef.current.zoom();
      graphRef.current.zoom(currentZoom / 1.3, 400);
    }
  }, []);

  const handleZoomToFit = useCallback(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(400, 50);
    }
  }, []);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const width = containerRef.current.offsetWidth;
        const height = Math.max(500, Math.min(width * 0.8, 700));
        setContainerSize({ width, height });
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Load data on mount
  useEffect(() => {
    loadGraphData();
  }, [loadGraphData]);

  // Custom node canvas rendering with labels
  const paintNode = useCallback((node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const size = getNodeSize(node);
    const color = getNodeColor(node);
    
    // Draw node circle
    ctx.beginPath();
    ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    
    // Draw border for selected/hovered node
    if (selectedNode?.id === node.id || hoverNode?.id === node.id) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
    }
    
    // Draw label if enabled and zoom is sufficient
    if (showLabels && globalScale > 1) {
      ctx.font = `${Math.max(10, 12 / globalScale)}px Sans-Serif`;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(node.name, node.x!, node.y! + size + 8 / globalScale);
    }
  }, [getNodeSize, getNodeColor, selectedNode, hoverNode, showLabels]);

  // Render statistics panel
  const renderStatistics = () => (
    <div className="fade-in" style={{ padding: '1rem' }}>
      <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ChartBarIcon className="w-5 h-5" />
        Network Statistics
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Users</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)' }}>{statistics.totalNodes}</div>
        </div>

        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Connections</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)' }}>{statistics.totalLinks}</div>
        </div>

        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Total Agreements</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--success)' }}>{statistics.totalAgreements}</div>
        </div>

        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Network Density</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)' }}>
            {(statistics.networkDensity * 100).toFixed(1)}%
          </div>
        </div>

        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Avg Agreements</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)' }}>
            {statistics.averageAgreements.toFixed(1)}
          </div>
        </div>

        <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Communities</div>
          <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--primary-color)' }}>{statistics.communities}</div>
        </div>
      </div>

      <div style={{ background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
        <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Top Influencers (by connections)</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {statistics.topInfluencers.map((influencer, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.5rem',
                background: 'var(--surface)',
                borderRadius: 'var(--radius-sm)',
                borderLeft: `3px solid ${communityColors[idx % communityColors.length]}`
              }}
            >
              <span style={{ fontWeight: 500 }}>
                {idx + 1}. {influencer.name}
              </span>
              <span style={{ 
                fontSize: '0.85rem', 
                color: 'var(--text-muted)',
                background: 'var(--surface-light)',
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-sm)'
              }}>
                {influencer.centrality} connections
              </span>
            </div>
          ))}
        </div>
      </div>

      {showCommunities && (
        <div style={{ marginTop: '1.5rem', background: 'var(--surface-light)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
          <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>Community Colors</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {communityColors.slice(0, statistics.communities).map((color, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  background: 'var(--surface)',
                  borderRadius: 'var(--radius-sm)'
                }}
              >
                <div style={{
                  width: '16px',
                  height: '16px',
                  borderRadius: '50%',
                  background: color
                }} />
                <span style={{ fontSize: '0.85rem' }}>Community {idx + 1}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="card fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
          <UserGroupIcon className="w-6 h-6" /> Trust & Agreement Network
        </h2>
        
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => setActiveView(activeView === 'graph' ? 'stats' : 'graph')}
            style={{
              padding: '0.5rem 1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--surface-light)',
              border: '1px solid var(--border-color)'
            }}
          >
            {activeView === 'graph' ? (
              <><ChartBarIcon className="w-5 h-5" /> Stats</>
            ) : (
              <><UserGroupIcon className="w-5 h-5" /> Graph</>
            )}
          </button>
          
          <button
            onClick={loadGraphData}
            disabled={isLoading}
            style={{
              padding: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="Refresh Graph"
          >
            <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {activeView === 'stats' ? (
        renderStatistics()
      ) : (
        <>
          {/* Controls Panel */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '1rem',
            padding: '1rem',
            background: 'var(--surface-light)',
            borderRadius: 'var(--radius-md)'
          }}>
            {/* Search */}
            <div>
              <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                <MagnifyingGlassIcon className="w-4 h-4 inline mr-1" />
                Search Users
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type to filter..."
                style={{ width: '100%', fontSize: '0.9rem' }}
              />
            </div>

            {/* Min Agreements Filter */}
            <div>
              <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                <FunnelIcon className="w-4 h-4 inline mr-1" />
                Min Agreements: {minAgreements}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={minAgreements}
                onChange={(e) => setMinAgreements(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
            </div>

            {/* Node Size Mode */}
            <div>
              <label style={{ fontSize: '0.85rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                <AdjustmentsHorizontalIcon className="w-4 h-4 inline mr-1" />
                Node Size
              </label>
              <select
                value={nodeSize}
                onChange={(e) => setNodeSize(e.target.value as any)}
                style={{ width: '100%', fontSize: '0.9rem' }}
              >
                <option value="uniform">Uniform</option>
                <option value="centrality">By Centrality</option>
                <option value="agreements">By Agreements</option>
              </select>
            </div>

            {/* Toggle Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
              <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showCommunities}
                  onChange={(e) => setShowCommunities(e.target.checked)}
                />
                <SparklesIcon className="w-4 h-4" />
                Show Communities
              </label>
              <label style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => setShowLabels(e.target.checked)}
                />
                Show Labels
              </label>
            </div>
          </div>

          {/* Graph Container */}
          <div ref={containerRef} style={{ position: 'relative', minHeight: '500px', background: 'var(--surface)', borderRadius: 'var(--radius-md)' }}>
            {isLoading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: 'var(--surface-light)',
                borderRadius: 'var(--radius-md)',
                zIndex: 10
              }}>
                <ArrowPathIcon className="w-8 h-8 animate-spin text-gray-500" />
              </div>
            )}

            {error && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'var(--error)',
                background: 'var(--surface-light)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem',
                zIndex: 10
              }}>
                <ExclamationCircleIcon className="w-8 h-8 mb-2" />
                <p style={{ fontSize: '0.9rem', textAlign: 'center' }}>{error}</p>
              </div>
            )}

            {!isLoading && !error && filteredData.nodes.length === 0 && (
              <div style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'var(--text-muted)',
                background: 'var(--surface-light)',
                borderRadius: 'var(--radius-md)'
              }}>
                <UserGroupIcon className="w-8 h-8 mb-2" />
                <p style={{ fontSize: '0.9rem' }}>No agreement data found.</p>
                <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>Try adjusting the minimum agreements filter.</p>
              </div>
            )}

            {!isLoading && !error && filteredData.nodes.length > 0 && (
              <>
                <ForceGraph2D
                  ref={graphRef}
                  graphData={filteredData}
                  width={containerSize.width}
                  height={containerSize.height}
                  nodeLabel={(node: any) => `
                    <div style="background: rgba(0,0,0,0.8); color: white; padding: 8px 12px; border-radius: 4px; font-size: 12px;">
                      <strong>${node.name}</strong><br/>
                      Connections: ${node.centrality || 0}<br/>
                      Total Agreements: ${node.totalAgreements || 0}
                      ${node.community !== undefined ? `<br/>Community: ${node.community + 1}` : ''}
                    </div>
                  `}
                  nodeCanvasObject={paintNode}
                  nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                    const size = getNodeSize(node);
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, size + 2, 0, 2 * Math.PI);
                    ctx.fill();
                  }}
                  linkColor={getLinkColor}
                  linkWidth={getLinkWidth}
                  linkDirectionalParticles={showParticles ? 2 : 0}
                  linkDirectionalParticleWidth={2}
                  linkDirectionalParticleSpeed={0.003}
                  linkLabel={(link: any) => `Agreements: ${link.value} | Trust: ${((link.trust_score || 0.5) * 100).toFixed(0)}%`}
                  onNodeClick={handleNodeClick}
                  onNodeHover={(node: any) => setHoverNode(node)}
                  onBackgroundClick={handleBackgroundClick}
                  backgroundColor="transparent"
                  cooldownTicks={100}
                  d3Force="link" // Use d3's link force
                  d3VelocityDecay={0.3}
                  warmupTicks={100}
                  enableNodeDrag={true}
                  enableZoomInteraction={true}
                  enablePanInteraction={true}
                />

                {/* Zoom Controls */}
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  zIndex: 5
                }}>
                  <button
                    onClick={handleZoomIn}
                    style={{
                      padding: '0.5rem',
                      background: 'var(--surface-light)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer'
                    }}
                    title="Zoom In"
                  >
                    <ArrowsPointingInIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleZoomOut}
                    style={{
                      padding: '0.5rem',
                      background: 'var(--surface-light)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer'
                    }}
                    title="Zoom Out"
                  >
                    <ArrowsPointingOutIcon className="w-5 h-5" />
                  </button>
                  <button
                    onClick={handleZoomToFit}
                    style={{
                      padding: '0.5rem',
                      background: 'var(--surface-light)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer'
                    }}
                    title="Fit to View"
                  >
                    <AdjustmentsHorizontalIcon className="w-5 h-5" />
                  </button>
                </div>

                {/* Selected Node Info Panel */}
                {selectedNode && (
                  <div style={{
                    position: 'absolute',
                    bottom: '1rem',
                    left: '1rem',
                    right: '1rem',
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(10px)',
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    zIndex: 5,
                    maxWidth: '400px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>{selectedNode.name}</h4>
                      <button
                        onClick={() => setSelectedNode(null)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '1.25rem',
                          color: 'var(--text-muted)'
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Connections:</span>
                        <strong>{selectedNode.centrality || 0}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Total Agreements:</span>
                        <strong>{selectedNode.totalAgreements || 0}</strong>
                      </div>
                      {selectedNode.community !== undefined && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Community:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{
                              width: '12px',
                              height: '12px',
                              borderRadius: '50%',
                              background: communityColors[selectedNode.community % communityColors.length]
                            }} />
                            <strong>{selectedNode.community + 1}</strong>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Legend and Info */}
          <div style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'var(--info-light)',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.85rem',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'start',
            gap: '0.5rem'
          }}>
            <InformationCircleIcon className="w-5 h-5 flex-shrink-0" style={{ marginTop: '2px' }} />
            <div>
              <strong>How to use:</strong> Click nodes to highlight connections. Hover for details. 
              Link thickness shows agreement frequency. Link color shows trust level (red = low, green = high).
              {showCommunities && ' Colors represent detected communities.'}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TrustGraph;