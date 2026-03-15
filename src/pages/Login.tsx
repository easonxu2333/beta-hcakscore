import { FormEvent, useState } from 'react';
import { login } from '../lib/api';
import type { Judge } from '../types';
import Toast from '../components/Toast';

interface Props {
  onLogin: (judge: Judge) => void;
}

export default function Login({ onLogin }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [judgeCode, setJudgeCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const judge = await login(name.trim(), email.trim(), judgeCode.trim().toUpperCase());
      onLogin(judge);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="card animate-fade-in overflow-hidden">
        <div className="grid gap-10 px-6 py-8 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
          <div className="space-y-6">
            <div className="inline-flex items-center rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              Demo day ready
            </div>
            <div className="space-y-4">
              <h1 className="font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                Score projects fast. Keep rankings live.
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-600">
                Built for university hackathons where judges walk table to table, organizers monitor coverage,
                and the public screen updates in real time without slowing down the floor.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ['<15s', 'target scoring time'],
                ['12+', 'sample projects preloaded'],
                ['4', 'leaderboard modes'],
              ].map(([value, label]) => (
                <div key={label} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="font-display text-3xl font-bold text-slate-950">{value}</div>
                  <div className="mt-1 text-sm text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 rounded-[28px] border border-slate-200 bg-slate-50 p-6">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Judge sign-in</div>
              <h2 className="mt-2 font-display text-2xl font-bold text-slate-950">Start scoring</h2>
              <p className="mt-1 text-sm text-slate-500">Use the code provided by organizers.</p>
            </div>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Name</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Dr. Sarah Chen" required />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Email</span>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sarah@university.edu" required />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">Judge code</span>
              <input
                className="input font-mono uppercase tracking-[0.18em]"
                value={judgeCode}
                onChange={(e) => setJudgeCode(e.target.value)}
                placeholder="JUDGE-AI-01"
                required
              />
            </label>

            {error && <Toast tone="error" message={error} />}

            <button type="submit" className="btn-primary w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Open judge dashboard'}
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-4">
        <div className="card p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Roles</div>
          <div className="mt-4 space-y-4">
            {[
              ['Judges', 'Quick mobile-first scoring, drafts, previous submissions, and next-project flow.'],
              ['Organizers', 'Coverage tracking, missing scores, CSV export, finalists, and settings.'],
              ['Public display', 'Auto-refreshing leaderboard designed for projector mode.'],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-3xl border border-slate-200 p-4">
                <div className="font-display text-lg font-semibold text-slate-950">{title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{copy}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Organizer access</div>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Admin dashboard is available at <span className="font-semibold text-slate-900">/admin</span>.
            Default local password is <span className="font-mono text-slate-900">beta2025</span>.
          </p>
        </div>
      </section>
    </div>
  );
}
