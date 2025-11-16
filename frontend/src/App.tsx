// frontend/src/App.tsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './components/ThemeContext';
import DashboardLayout from './components/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MainChat from './pages/MainChat';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import RiskAnalysisPage from './pages/RiskAnalysisPage';
import TeamDynamicsPage from './pages/TeamDynamicsPage';
import Connectors from './pages/Connectors';
import Productivity from './pages/Productivity';
import TeamAnalytics from './pages/TeamAnalytics';
import SettingsPage from './pages/SettingsPage';
import HelpPage from './pages/HelpPage';

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ThemeProvider>
          <BrowserRouter>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Protected Routes with Dashboard Layout */}
              <Route element={<ProtectedRoute />}>
                <Route element={<DashboardLayout />}>
                  {/* Default redirect to /chat */}
                  <Route index element={<Navigate to="/chat" replace />} />

                  {/* Core */}
                  <Route path="chat" element={<MainChat />} />

                  {/* Analytics */}
                  <Route path="analytics/sentiment" element={<AnalyticsDashboard />} />
                  <Route path="analytics/performance" element={<TeamAnalytics />} />
                  
                  {/* FIXED: Team Dynamics route matches Sidebar link */}
                  <Route path="team-dynamics" element={<TeamDynamicsPage />} />

                  {/* Tools */}
                  <Route path="productivity" element={<Productivity />} />
                  <Route path="predictive-suite" element={<RiskAnalysisPage />} />
                  <Route path="connectors" element={<Connectors />} />

                  {/* Utility */}
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="help" element={<HelpPage />} />

                  {/* Legacy Redirects */}
                  <Route path="analytics" element={<Navigate to="/analytics/sentiment" replace />} />
                  <Route path="trust-graph" element={<Navigate to="/team-dynamics" replace />} />
                  <Route path="analytics/team-dynamics" element={<Navigate to="/team-dynamics" replace />} />
                  <Route path="analytics/trust" element={<Navigate to="/team-dynamics" replace />} />

                  {/* Catch-all */}
                  <Route path="*" element={<Navigate to="/chat" replace />} />
                </Route>
              </Route>
            </Routes>
          </BrowserRouter>
        </ThemeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;