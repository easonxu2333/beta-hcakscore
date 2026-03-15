import { Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import type { Judge, Participant } from './types';
import Layout from './components/Layout';
import Login from './pages/Login';
import ProjectList from './pages/ProjectList';
import ScoringPage from './pages/ScoringPage';
import Leaderboard from './pages/Leaderboard';
import AdminDashboard from './pages/AdminDashboard';
import ParticipantAuth from './pages/ParticipantAuth';
import ParticipantDashboard from './pages/ParticipantDashboard';
import ParticipantSubmissionForm from './pages/ParticipantSubmissionForm';

const JUDGE_STORAGE_KEY = 'hackscore_judge';
const PARTICIPANT_STORAGE_KEY = 'hackscore_participant';

export default function App() {
  const [judge, setJudge] = useState<Judge | null>(() => {
    try {
      const raw = localStorage.getItem(JUDGE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [participant, setParticipant] = useState<Participant | null>(() => {
    try {
      const raw = localStorage.getItem(PARTICIPANT_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (nextJudge: Judge) => {
    setJudge(nextJudge);
    localStorage.setItem(JUDGE_STORAGE_KEY, JSON.stringify(nextJudge));
  };

  const handleParticipantLogin = (nextParticipant: Participant) => {
    setParticipant(nextParticipant);
    localStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify(nextParticipant));
  };

  const handleLogout = () => {
    setJudge(null);
    setParticipant(null);
    localStorage.removeItem(JUDGE_STORAGE_KEY);
    localStorage.removeItem(PARTICIPANT_STORAGE_KEY);
  };

  return (
    <Layout judge={judge} participant={participant} onLogout={handleLogout}>
      <Routes>
        <Route path="/login" element={judge ? <Navigate to="/projects" replace /> : <Login onLogin={handleLogin} />} />
        <Route path="/projects" element={judge ? <ProjectList judge={judge} /> : <Navigate to="/login" replace />} />
        <Route path="/score/:projectId" element={judge ? <ScoringPage judge={judge} /> : <Navigate to="/login" replace />} />
        <Route path="/participant/login" element={participant ? <Navigate to="/participant/dashboard" replace /> : <ParticipantAuth onLogin={handleParticipantLogin} />} />
        <Route path="/participant/dashboard" element={participant ? <ParticipantDashboard participant={participant} /> : <Navigate to="/participant/login" replace />} />
        <Route path="/participant/projects/new" element={participant ? <ParticipantSubmissionForm participant={participant} /> : <Navigate to="/participant/login" replace />} />
        <Route path="/participant/projects/:projectId/edit" element={participant ? <ParticipantSubmissionForm participant={participant} /> : <Navigate to="/participant/login" replace />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/" element={<Navigate to={judge ? '/projects' : participant ? '/participant/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
