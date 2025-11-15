// frontend/src/components/Sidebar.tsx
import React, { useState, useEffect } from 'react';
import {
  ChatBubbleLeftRightIcon,
  ChartBarIcon,
  UserGroupIcon,
  Cog6ToothIcon,
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  QuestionMarkCircleIcon,
  LightBulbIcon,
  CircleStackIcon,
  ClipboardDocumentCheckIcon,
  ChartPieIcon,
  XMarkIcon,
  Bars3Icon,
} from '@heroicons/react/24/outline';
import { NavLink } from 'react-router-dom';

interface SidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, onToggleCollapse }) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Sync sidebar width to CSS variable
  useEffect(() => {
    if (isMobile) {
      document.documentElement.style.setProperty('--sidebar-width', '0px');
    } else {
      document.documentElement.style.setProperty(
        '--sidebar-width',
        isCollapsed ? '80px' : '260px'
      );
    }
  }, [isCollapsed, isMobile]);

  // Close mobile menu on route change
  useEffect(() => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  }, [isMobile]);

  const handleLinkClick = () => {
    if (isMobile) {
      setIsMobileOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Hamburger Button */}
      {isMobile && (
        <button
          onClick={() => setIsMobileOpen(true)}
          style={{
            position: 'fixed',
            top: '1rem',
            left: '1rem',
            zIndex: 200,
            background: 'var(--surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '0.75rem',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-primary)'
          }}
        >
          <Bars3Icon style={{ width: '24px', height: '24px' }} />
        </button>
      )}

      {/* Backdrop for mobile */}
      {isMobile && isMobileOpen && (
        <div
          onClick={() => setIsMobileOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 150,
            animation: 'fadeIn 0.2s ease-out'
          }}
        />
      )}

      {/* Sidebar */}
      <nav
        style={{
          width: isMobile ? '280px' : (isCollapsed ? '80px' : '260px'),
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s ease-in-out, width 0.3s ease-in-out',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: isMobile ? 200 : 100,
          padding: '1.5rem 0.75rem',
          overflowX: 'hidden',
          overflowY: 'auto',
          transform: isMobile ? (isMobileOpen ? 'translateX(0)' : 'translateX(-100%)') : 'translateX(0)',
          boxShadow: isMobile && isMobileOpen ? 'var(--shadow-xl)' : 'none'
        }}
      >
        {/* Logo and Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: isCollapsed && !isMobile ? 'center' : 'space-between',
            padding: '0 0.75rem',
            marginBottom: '1.5rem',
            minHeight: '40px'
          }}
        >
          {(!isCollapsed || isMobile) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.75rem' }}>🧠</span>
              <span
                style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: 'var(--text-primary)',
                  whiteSpace: 'nowrap',
                }}
              >
                Context IQ
              </span>
            </div>
          )}
          {isCollapsed && !isMobile && (
            <span style={{ fontSize: '1.75rem' }} title="Context IQ">
              🧠
            </span>
          )}
          
          {/* Mobile Close / Desktop Collapse */}
          {isMobile ? (
            <button
              onClick={() => setIsMobileOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                transition: 'color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <XMarkIcon style={{ width: '24px', height: '24px' }} />
            </button>
          ) : (
            !isCollapsed && (
              <button
                onClick={onToggleCollapse}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'color 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
                title="Collapse sidebar"
              >
                <ChevronDoubleLeftIcon style={{ width: '20px', height: '20px' }} />
              </button>
            )
          )}
        </div>

        {/* Expand button when collapsed (desktop only) */}
        {isCollapsed && !isMobile && (
          <button
            onClick={onToggleCollapse}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '0.5rem',
              borderRadius: 'var(--radius-sm)',
              transition: 'color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1.5rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            title="Expand sidebar"
          >
            <ChevronDoubleRightIcon style={{ width: '20px', height: '20px' }} />
          </button>
        )}

        {/* Main Navigation */}
        <div style={{ flexGrow: 1, overflowY: 'auto' }}>
          {/* Core */}
          <SidebarLink
            to="/chat"
            icon={<ChatBubbleLeftRightIcon />}
            label="Team Memory"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />

          {/* Analytics Section */}
          {(!isCollapsed || isMobile) && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                padding: '0 1.25rem',
                marginTop: '1.5rem',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Analytics
            </p>
          )}
          <SidebarLink
            to="/analytics/sentiment"
            icon={<ChartBarIcon />}
            label="Sentiment"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />
          <SidebarLink
            to="/analytics/trust"
            icon={<UserGroupIcon />}
            label="Trust Network"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />
          <SidebarLink
            to="/analytics/performance"
            icon={<ChartPieIcon />}
            label="Performance"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />

          {/* Tools Section */}
          {(!isCollapsed || isMobile) && (
            <p
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                fontWeight: 600,
                padding: '0 1.25rem',
                marginTop: '1.5rem',
                marginBottom: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              Tools
            </p>
          )}
          <SidebarLink
            to="/productivity"
            icon={<ClipboardDocumentCheckIcon />}
            label="Productivity"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />
          <SidebarLink
            to="/predictive-suite"
            icon={<LightBulbIcon />}
            label="Predictive Suite"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />
          <SidebarLink
            to="/connectors"
            icon={<CircleStackIcon />}
            label="Connectors"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />
        </div>

        {/* Footer Navigation */}
        <div style={{ marginTop: 'auto', paddingTop: '1rem' }}>
          <SidebarLink
            to="/settings"
            icon={<Cog6ToothIcon />}
            label="Settings"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />
          <SidebarLink
            to="/help"
            icon={<QuestionMarkCircleIcon />}
            label="Help"
            isCollapsed={isCollapsed && !isMobile}
            onClick={handleLinkClick}
          />
        </div>
      </nav>
    </>
  );
};

// Helper component for NavLink
interface SidebarLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  isCollapsed: boolean;
  onClick?: () => void;
}

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, label, isCollapsed, onClick }) => {
  return (
    <NavLink
      to={to}
      end={to === '/chat'}
      onClick={onClick}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '0.75rem 1rem',
        margin: '0.25rem 0',
        borderRadius: 'var(--radius-md)',
        textDecoration: 'none',
        color: isActive ? 'white' : 'var(--text-secondary)',
        background: isActive ? 'var(--primary-color)' : 'transparent',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        justifyContent: isCollapsed ? 'center' : 'flex-start',
        transition: 'all 0.2s',
        cursor: 'pointer',
        fontWeight: isActive ? '600' : '400',
      })}
      onMouseEnter={(e) => {
        const target = e.currentTarget as HTMLAnchorElement;
        const isActive = target.getAttribute('aria-current') === 'page';
        if (!isActive) {
          target.style.background = 'var(--surface-hover)';
          target.style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        const target = e.currentTarget as HTMLAnchorElement;
        const isActive = target.getAttribute('aria-current') === 'page';
        if (!isActive) {
          target.style.background = 'transparent';
          target.style.color = 'var(--text-secondary)';
        }
      }}
      title={isCollapsed ? label : undefined}
    >
      {/* Fixed icon container */}
      <span style={{ 
        width: '20px', 
        height: '20px', 
        flexShrink: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center' 
      }}>
        {React.cloneElement(icon as React.ReactElement, { 
          style: { width: '20px', height: '20px' } 
        })}
      </span>
      {!isCollapsed && <span>{label}</span>}
    </NavLink>
  );
};

export default Sidebar;