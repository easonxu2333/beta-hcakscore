import { Navigate, Route, Routes } from 'react-router-dom';
import { useState } from 'react';
import type { Judge } from './types';
import Layout from './components/Layout';
import Login from './pages/Login';
import ProjectList from './pages/ProjectList';
import ScoringPage from './pages/ScoringPage';
import Leaderboard from './pages/Leaderboard';
import AdminDashboard from './pages/AdminDashboard';
import ParticipantSubmissionForm from './pages/ParticipantSubmissionForm';

const JUDGE_STORAGE_KEY = 'hackscore_judge';

export default function App() {
  const [judge, setJudge] = useState<Judge | null>(() => {
    try {
      const raw = localStorage.getItem(JUDGE_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const handleLogin = (nextJudge: Judge) => {
    setJudge(nextJudge);
    localStorage.setItem(JUDGE_STORAGE_KEY, JSON.stringify(nextJudge));
  };

  const handleLogout = () => {
    setJudge(null);
    localStorage.removeItem(JUDGE_STORAGE_KEY);
  };

  return (
    <Layout judge={judge} onLogout={handleLogout}>
      <Routes>
        <Route path="/login" element={judge ? <Navigate to="/projects" replace /> : <Login onLogin={handleLogin} />} />
        <Route path="/projects" element={judge ? <ProjectList judge={judge} /> : <Navigate to="/login" replace />} />
        <Route path="/score/:projectId" element={judge ? <ScoringPage judge={judge} /> : <Navigate to="/login" replace />} />
        <Route path="/submit" element={<ParticipantSubmissionForm />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/" element={<Navigate to={judge ? '/projects' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
