import { FormEvent, useState } from 'react';
import Toast from '../components/Toast';
import { participantLogin, participantRegister } from '../lib/api';
import type { Participant } from '../types';

interface Props {
  onLogin: (participant: Participant) => void;
}

export default function ParticipantAuth({ onLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [schoolName, setSchoolName] = useState('UC Berkeley');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    try {
      const participant = mode === 'login'
        ? await participantLogin(email, password)
        : await participantRegister({ name, email, password, teamName, schoolName });
      onLogin(participant);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card animate-fade-in p-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Participant portal</div>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950">
              {mode === 'login' ? 'Team sign in' : 'Create a team account'}
            </h1>
          </div>
          <button className="btn-secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? 'Register' : 'Have an account?'}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          {mode === 'register' && (
            <>
              <input className="input" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
              <input className="input" placeholder="Team name" value={teamName} onChange={(e) => setTeamName(e.target.value)} required />
              <input className="input" placeholder="School / organization" value={schoolName} onChange={(e) => setSchoolName(e.target.value)} required />
            </>
          )}
          <input className="input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <Toast tone="error" message={error} />}
          <button className="btn-primary" type="submit">
            {mode === 'login' ? 'Open participant dashboard' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
