import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, Protected } from './auth.jsx';
import Layout from './components/Layout.jsx';
import Landing from './pages/Landing.jsx';
import { WORKSPACES, WorkspaceProvider } from './workspace.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Vehicles from './pages/Vehicles.jsx';
import Bookings from './pages/Bookings.jsx';
import AdminCustomers from './pages/AdminCustomers.jsx';
import Profile from './pages/Profile.jsx';
import ReportProblem from './pages/ReportProblem.jsx';
import MyProblems from './pages/MyProblems.jsx';
import ProductBacklogPage from './pages/ProductBacklog.jsx';
import ServiceRequestDetails from './pages/ServiceRequestDetails.jsx';
import SprintSummary from './pages/SprintSummary.jsx';
import ScrumDashboard from './pages/scrum/ScrumDashboard.jsx';
import ProductBacklog from './pages/scrum/ProductBacklog.jsx';
import SprintPlanning from './pages/scrum/SprintPlanning.jsx';
import SprintBoard from './pages/scrum/SprintBoard.jsx';
import DailyScrum from './pages/scrum/DailyScrum.jsx';
import Retrospective from './pages/scrum/Retrospective.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/register" element={<Navigate to="/" replace />} />
          <Route path="/customer" element={<Protected ws="customer" roles={WORKSPACES.customer.roles}><WorkspaceProvider value={WORKSPACES.customer}><Layout /></WorkspaceProvider></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="vehicles" element={<Protected roles={['admin', 'customer']}><Vehicles /></Protected>} />
            <Route path="report" element={<Protected roles={['customer']}><ReportProblem /></Protected>} />
            <Route path="problems" element={<Protected roles={['customer']}><MyProblems /></Protected>} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="customers" element={<Protected roles={['admin']}><AdminCustomers /></Protected>} />
            <Route path="profile" element={<Profile />} />
            <Route path="scrum" element={<Protected roles={['admin']}><ScrumDashboard /></Protected>} />
            <Route path="scrum/backlog" element={<Protected roles={['admin']}><ProductBacklog /></Protected>} />
            <Route path="scrum/planning" element={<Protected roles={['admin']}><SprintPlanning /></Protected>} />
            <Route path="scrum/board" element={<Protected roles={['admin', 'mechanic']}><SprintBoard /></Protected>} />
            <Route path="scrum/daily" element={<Protected roles={['admin', 'mechanic']}><DailyScrum /></Protected>} />
            <Route path="scrum/retro" element={<Protected roles={['admin', 'mechanic']}><Retrospective /></Protected>} />
          </Route>
          <Route path="/admin" element={<Protected ws="admin" roles={WORKSPACES.admin.roles}><WorkspaceProvider value={WORKSPACES.admin}><Layout /></WorkspaceProvider></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="vehicles" element={<Protected roles={['admin', 'customer']}><Vehicles /></Protected>} />
            <Route path="backlog" element={<Protected roles={['admin']}><ProductBacklogPage /></Protected>} />
            <Route path="backlog/:id" element={<Protected roles={['admin']}><ServiceRequestDetails /></Protected>} />
            <Route path="sprint" element={<Protected roles={['admin']}><SprintSummary /></Protected>} />
            <Route path="bookings" element={<Bookings />} />
            <Route path="customers" element={<Protected roles={['admin']}><AdminCustomers /></Protected>} />
            <Route path="profile" element={<Profile />} />
            <Route path="scrum" element={<Protected roles={['admin']}><ScrumDashboard /></Protected>} />
            <Route path="scrum/backlog" element={<Protected roles={['admin']}><ProductBacklog /></Protected>} />
            <Route path="scrum/planning" element={<Protected roles={['admin']}><SprintPlanning /></Protected>} />
            <Route path="scrum/board" element={<Protected roles={['admin', 'mechanic']}><SprintBoard /></Protected>} />
            <Route path="scrum/daily" element={<Protected roles={['admin', 'mechanic']}><DailyScrum /></Protected>} />
            <Route path="scrum/retro" element={<Protected roles={['admin', 'mechanic']}><Retrospective /></Protected>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
