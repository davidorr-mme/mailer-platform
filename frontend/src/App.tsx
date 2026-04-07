import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import DataMap from './pages/DataMap';
import Audience from './pages/Audience';
import SegmentBuilder from './pages/Audience/SegmentBuilder';
import Campaigns from './pages/Campaigns';
import CampaignCreate from './pages/Campaigns/CampaignCreate';
import AutomationsPage from './pages/Automations';
import AutomationCanvas from './pages/Automations/AutomationCanvas';
import ReportsPage from './pages/Reports';
import CampaignReportPage from './pages/Reports/CampaignReport';
import DataImport from './pages/DataImport';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/datamap"
          element={
            <ProtectedRoute>
              <Layout>
                <DataMap />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audience"
          element={
            <ProtectedRoute>
              <Layout>
                <Audience />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audience/segments/new"
          element={
            <ProtectedRoute>
              <Layout>
                <SegmentBuilder />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/audience/segments/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <SegmentBuilder />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns"
          element={
            <ProtectedRoute>
              <Layout>
                <Campaigns />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/new"
          element={
            <ProtectedRoute>
              <Layout>
                <CampaignCreate />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/campaigns/:id/edit"
          element={
            <ProtectedRoute>
              <Layout>
                <CampaignCreate />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations"
          element={
            <ProtectedRoute>
              <Layout>
                <AutomationsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/automations/:id/canvas"
          element={
            <ProtectedRoute>
              <AutomationCanvas />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Layout>
                <ReportsPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/campaigns/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <CampaignReportPage />
              </Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/import"
          element={
            <ProtectedRoute>
              <Layout>
                <DataImport />
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
