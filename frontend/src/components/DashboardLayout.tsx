import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { ArrowUpIcon } from '@heroicons/react/24/outline';
import Sidebar from './Sidebar';

const DashboardLayout: React.FC = () => {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });

  // Persist sidebar collapse state
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(isSidebarCollapsed));
  }, [isSidebarCollapsed]);

  // Scroll handling for the main content area
  useEffect(() => {
    const mainElement = document.getElementById('main-content-area');

    const handleScroll = () => {
      if (!mainElement) return;
      const currentScrollY = mainElement.scrollTop;
      setShowScrollTop(currentScrollY > 300);
    };

    if (mainElement) {
      mainElement.addEventListener('scroll', handleScroll, { passive: true });
      return () => mainElement.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    const mainElement = document.getElementById('main-content-area');
    if (mainElement) {
      mainElement.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--background)',
        position: 'relative',
      }}
    >
      {/* Animated Background Pattern */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: `
            radial-gradient(circle at 20% 50%, rgba(120, 119, 198, 0.08) 0%, transparent 45%),
            radial-gradient(circle at 80% 80%, rgba(56, 189, 248, 0.08) 0%, transparent 45%)
          `,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Sidebar */}
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Layout Container */}
      <div
        style={{
          flexGrow: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          position: 'relative',
          transition: 'margin-left 0.3s ease',
          width: 'calc(100% - var(--sidebar-width))',
        }}
      >
        {/* Main Content Area */}
        <main
          id="main-content-area"
          style={{
            flexGrow: 1,
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
          }}
        >
          <Outlet />
        </main>

        {/* Footer */}
        <footer
          style={{
            padding: '1rem 2rem',
            background: 'var(--surface)',
            borderTop: '1px solid var(--border-color)',
            position: 'relative',
            zIndex: 1,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              maxWidth: '1400px',
              margin: '0 auto',
              minHeight: '28px',
            }}
          >
            <p
              style={{
                margin: 0,
                color: 'var(--text-muted)',
                fontSize: '0.875rem',
              }}
            >
              Context IQ • Cognitive Operating System
            </p>
            <div
              style={{
                display: 'flex',
                gap: '1.5rem',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
              }}
            >
              {/* Optional: Add links back later */}
              {/* <a href="#" style={{ color: 'inherit', textDecoration: 'none' }}>About</a> */}
            </div>
          </div>
        </footer>
      </div>

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'var(--primary-color)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
            transition: 'all 0.3s',
            zIndex: 1000,
            animation: 'fadeInUp 0.3s ease-out',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.25)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }}
          title="Scroll to top"
        >
          <ArrowUpIcon style={{ width: '24px', height: '24px' }} />
        </button>
      )}

      {/* --- THIS IS THE FIX ---
          Replaced the invalid <style jsx> tag with a standard <style> tag.
      --- END OF FIX --- */}
      <style>
        {`
          @keyframes fadeInUp {
            from {
              opacity: 0;
              transform: translateY(20px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
          html {
            scroll-behavior: smooth;
          }
        `}
      </style>
    </div>
  );
};

export default DashboardLayout;