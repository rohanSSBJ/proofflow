import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell.jsx';
import { ProtectedRoute } from './components/ProtectedRoute.jsx';
import { InvitationPage, LoginPage, RegisterPage } from './pages/AuthPages.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { LandingPage } from './pages/LandingPage.jsx';
import { MembersPage } from './pages/MembersPage.jsx';
import { ProjectPage } from './pages/ProjectPage.jsx';
import { ProjectsPage } from './pages/ProjectsPage.jsx';
import { ReviewsPage } from './pages/ReviewsPage.jsx';
import { TaskPage } from './pages/TaskPage.jsx';

export default function App() {
  return <Routes>
    <Route path="/" element={<LandingPage />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/register" element={<RegisterPage />} />
    <Route path="/signup" element={<Navigate to="/register" replace />} />
    <Route path="/accept-invitation" element={<InvitationPage />} />
    <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
      <Route index element={<DashboardPage />} />
      <Route path="projects" element={<ProjectsPage />} />
      <Route path="projects/:projectId" element={<ProjectPage />} />
      <Route path="projects/:projectId/tasks/:taskId" element={<TaskPage />} />
      <Route path="reviews" element={<ProtectedRoute roles={['ADMIN', 'MANAGER', 'AUDITOR']}><ReviewsPage /></ProtectedRoute>} />
      <Route path="members" element={<MembersPage />} />
    </Route>
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
