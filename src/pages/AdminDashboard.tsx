import { FormEvent, useEffect, useMemo, useState } from 'react';
import Toast from '../components/Toast';
import {
  getAdminOverview,
  getCsvExportUrl,
  updateAdminSettings,
  updateFinalists,
} from '../lib/api';
import type { AdminOverview } from '../types';

const STORAGE_KEY = 'hackscore_admin_password';

type Tab = 'overview' | 'judges' | 'projects' | 'submissions' | 'scores' | 'settings';

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="card p-5">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-3 font-display text-4xl font-bold text-slate-950">{value}</div>
      {sub && <div className="mt-2 text-sm text-slate-500">{sub}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [password, setPassword] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [selectedFinalists, setSelectedFinalists] = useState<number[]>([]);

  useEffect(() => {
    const timer = toast ? window.setTimeout(() => setToast(null), 2200) : null;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [toast]);

  async function loadAll() {
    const data = await getAdminOverview(password);
    setOverview(data);
    setSelectedFinalists(data.leaderboard.filter((entry) => entry.finalist).map((entry) => entry.id));
  }

  async function handleAuth(event: FormEvent) {
    event.preventDefault();
    try {
      await loadAll();
      setAuthed(true);
      localStorage.setItem(STORAGE_KEY, password);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Login failed' });
    }
  }

  async function handleSettingsSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!overview) return;
    const formData = new FormData(event.currentTarget);

    const criteria_weights = overview.settings.criteria_weights.map((criterion) => ({
      ...criterion,
      criterion_label: String(formData.get(`label:${criterion.criterion_key}`) || criterion.criterion_label),
      weight: Number(formData.get(`weight:${criterion.criterion_key}`) || criterion.weight),
    }));

    try {
      await updateAdminSettings(password, {
        score_scale_min: Number(formData.get('score_scale_min')),
        score_scale_max: Number(formData.get('score_scale_max')),
        use_weighted_criteria: formData.get('use_weighted_criteria') === 'on',
        use_judge_weights: formData.get('use_judge_weights') === 'on',
        outlier_mode: String(formData.get('outlier_mode')) as AdminOverview['settings']['outlier_mode'],
        comments_enabled: formData.get('comments_enabled') === 'on',
        finalist_nomination_enabled: formData.get('finalist_nomination_enabled') === 'on',
        leaderboard_public: formData.get('leaderboard_public') === 'on',
        criteria_weights,
      });
      await loadAll();
      setToast({ tone: 'success', message: 'Scoring settings updated.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Settings save failed.' });
    }
  }

  async function handleFinalistsSave() {
    if (!overview) return;
    try {
      await updateFinalists(password, selectedFinalists);
      await loadAll();
      setToast({ tone: 'success', message: 'Finalists updated.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Finalists update failed.' });
    }
  }

  const scoreDistribution = useMemo(() => {
    if (!overview) return [];
    return [0, 10, 20, 30, 40, 50].map((bucket) => ({
      label: `${bucket}-${bucket + 9}`,
      count: overview.leaderboard.filter((entry) => {
        if (entry.average_score == null) return false;
        return entry.average_score >= bucket && entry.average_score < bucket + 10;
      }).length,
    }));
  }, [overview]);

  if (!authed) {
    return (
      <div className="mx-auto max-w-md">
        <form onSubmit={handleAuth} className="card animate-fade-in space-y-5 p-8">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Organizer access</div>
            <h1 className="mt-2 font-display text-3xl font-bold text-slate-950">Admin dashboard</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Enter the organizer password to manage judging operations.</p>
          </div>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            required
          />
          <button className="btn-primary w-full" type="submit">Access organizer tools</button>
          {toast && <Toast tone={toast.tone} message={toast.message} />}
        </form>
      </div>
    );
  }

  if (!overview) {
    return <div className="card p-12 text-center text-slate-500">Loading organizer overview...</div>;
  }

  return (
    <div className="animate-fade-in space-y-6 pb-10">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-orange-700">Organizer cockpit</div>
          <h1 className="mt-2 font-display text-4xl font-bold text-slate-950">Hackathon operations dashboard</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
            Monitor completion, control leaderboard visibility, export the floor data, and promote finalists in real time.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <a href={getCsvExportUrl(password)} className="btn-secondary">Export CSV</a>
          <button className="btn-secondary" onClick={loadAll}>Refresh</button>
          <button
            className="btn-secondary"
            onClick={() => {
              localStorage.removeItem(STORAGE_KEY);
              setAuthed(false);
              setOverview(null);
            }}
          >
            Log out
          </button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Projects" value={overview.stats.totalProjects} />
        <StatCard label="Judges" value={overview.stats.totalJudges} />
        <StatCard label="Scores" value={overview.stats.totalScores} sub={`${overview.stats.draftScores} drafts`} />
        <StatCard label="Completion" value={`${overview.stats.completionRate}%`} />
        <StatCard label="Pending" value={overview.stats.pendingSubmissions} />
        <StatCard label="Approved" value={overview.stats.approvedSubmissions} />
      </section>

      <section className="flex gap-2 rounded-[28px] border border-slate-200 bg-white p-2">
        {(['overview', 'judges', 'projects', 'submissions', 'scores', 'settings'] as Tab[]).map((item) => (
          <button
            key={item}
            className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold capitalize ${
              tab === item ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </section>

      {tab === 'overview' && (
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-4">
            <div className="card overflow-hidden">
              <div className="border-b border-slate-200 px-6 py-4">
                <h2 className="font-display text-2xl font-bold text-slate-950">Live ranking</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {overview.leaderboard.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <span className="font-display text-2xl font-bold text-slate-400">#{entry.rank}</span>
                        <div>
                          <div className="font-semibold text-slate-900">{entry.name}</div>
                          <div className="text-sm text-slate-500">{entry.team_name} • {entry.track}</div>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-bold text-slate-950">{entry.average_score?.toFixed(1) || '—'}</div>
                      <div className="text-xs text-slate-400">{entry.submission_count} submissions</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-display text-2xl font-bold text-slate-950">Missing scores</h2>
              <div className="mt-4 space-y-3">
                {overview.missingScores.slice(0, 8).map((item) => (
                  <div key={`${item.judge_code}-${item.project_id}`} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                    <div>
                      <div className="font-semibold text-slate-900">{item.judge_name}</div>
                      <div className="text-slate-500">{item.project_name} • {item.track} • Table {item.table_number}</div>
                    </div>
                    <span className="badge pill-warn">Missing</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="font-display text-2xl font-bold text-slate-950">Judge completion</h2>
              <div className="mt-4 space-y-4">
                {overview.judges.map((judge) => (
                  <div key={judge.id}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-semibold text-slate-900">{judge.name}</span>
                      <span className="text-slate-500">{judge.scores_submitted}/{judge.assigned_total}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-slate-950" style={{ width: `${judge.completion_rate}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-display text-2xl font-bold text-slate-950">Score distribution</h2>
              <div className="mt-4 space-y-3">
                {scoreDistribution.map((bucket) => (
                  <div key={bucket.label}>
                    <div className="mb-1 flex items-center justify-between text-sm text-slate-600">
                      <span>{bucket.label}</span>
                      <span>{bucket.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-orange-500" style={{ width: `${(bucket.count / Math.max(1, overview.leaderboard.length)) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'judges' && (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Judge</th>
                  <th className="px-6 py-4 font-semibold">Role</th>
                  <th className="px-6 py-4 font-semibold">Track</th>
                  <th className="px-6 py-4 font-semibold">Weight</th>
                  <th className="px-6 py-4 font-semibold">Completion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {overview.judges.map((judge) => (
                  <tr key={judge.id}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{judge.name}</div>
                      <div className="text-slate-500">{judge.email}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{judge.role}</td>
                    <td className="px-6 py-4 text-slate-600">{judge.assigned_track || 'All tracks'}</td>
                    <td className="px-6 py-4 text-slate-600">{judge.weight.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-600">{judge.completion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'scores' && (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Judge</th>
                  <th className="px-6 py-4 font-semibold">Project</th>
                  <th className="px-6 py-4 font-semibold">Total</th>
                  <th className="px-6 py-4 font-semibold">Weighted</th>
                  <th className="px-6 py-4 font-semibold">Nomination</th>
                  <th className="px-6 py-4 font-semibold">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {overview.scores.map((score) => (
                  <tr key={score.id}>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{score.judge_name}</div>
                      <div className="text-slate-500">{score.judge_code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900">{score.project_name}</div>
                      <div className="text-slate-500">{score.track}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{score.total_score.toFixed(1)}</td>
                    <td className="px-6 py-4 text-slate-600">{score.weighted_score.toFixed(1)}</td>
                    <td className="px-6 py-4">
                      <span className={`badge ${score.finalist_nomination ? 'pill-success' : 'pill-muted'}`}>
                        {score.finalist_nomination ? 'Nominated' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">{score.updated_at ? new Date(score.updated_at).toLocaleString() : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {overview.scores.length === 0 && <div className="px-6 py-10 text-center text-slate-500">No scores yet.</div>}
          </div>
        </section>
      )}

      {tab === 'projects' && (
        <section className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Project</th>
                  <th className="px-6 py-4 font-semibold">Team</th>
                  <th className="px-6 py-4 font-semibold">Track</th>
                  <th className="px-6 py-4 font-semibold">Table</th>
                  <th className="px-6 py-4 font-semibold">Published</th>
                  <th className="px-6 py-4 font-semibold">Finalist</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {overview.projects.map((project) => (
                  <tr key={project.id}>
                    <td className="px-6 py-4 font-semibold text-slate-900">{project.name}</td>
                    <td className="px-6 py-4 text-slate-600">{project.team_name}</td>
                    <td className="px-6 py-4 text-slate-600">{project.track}</td>
                    <td className="px-6 py-4 text-slate-600">{project.table_number}</td>
                    <td className="px-6 py-4"><span className={`badge ${project.published ? 'pill-success' : 'pill-muted'}`}>{project.published ? 'Visible' : 'Hidden'}</span></td>
                    <td className="px-6 py-4"><span className={`badge ${project.is_finalist ? 'pill-success' : 'pill-muted'}`}>{project.is_finalist ? 'Finalist' : 'No'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'submissions' && (
        <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 px-6 py-4">
              <h2 className="font-display text-2xl font-bold text-slate-950">Participant submissions</h2>
            </div>
            <div className="divide-y divide-slate-200">
              {overview.projects.map((project) => (
                <div key={project.id} className="px-6 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-900">{project.name}</div>
                      <div className="text-sm text-slate-500">{project.team_name} • {project.contact_email || 'No contact email'}</div>
                    </div>
                    <div className="flex gap-2">
                      <span className="badge bg-slate-100 text-slate-700">{project.submission_status}</span>
                      <span className={`badge ${project.approval_status === 'approved' ? 'pill-success' : project.approval_status === 'rejected' ? 'pill-warn' : 'pill-muted'}`}>
                        {project.approval_status}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{project.short_description || project.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card p-6">
              <h2 className="font-display text-2xl font-bold text-slate-950">Participant accounts</h2>
              <div className="mt-4 space-y-3">
                {overview.participants.map((participant) => (
                  <div key={participant.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <div className="font-semibold text-slate-900">{participant.team_name}</div>
                    <div className="text-sm text-slate-500">{participant.name} • {participant.email}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <h2 className="font-display text-2xl font-bold text-slate-950">Review queue</h2>
              <div className="mt-4 text-sm leading-7 text-slate-600">
                Pending submissions: <span className="font-semibold text-slate-900">{overview.stats.pendingSubmissions}</span><br />
                Approved submissions: <span className="font-semibold text-slate-900">{overview.stats.approvedSubmissions}</span><br />
                Rejected submissions: <span className="font-semibold text-slate-900">{overview.projects.filter((project) => project.approval_status === 'rejected').length}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'settings' && (
        <form className="space-y-4" onSubmit={handleSettingsSave}>
          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="card p-6">
              <h2 className="font-display text-2xl font-bold text-slate-950">Scoring settings</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Scale min</span>
                  <input className="input" name="score_scale_min" type="number" defaultValue={overview.settings.score_scale_min} />
                </label>
                <label className="space-y-2">
                  <span className="text-sm font-medium text-slate-700">Scale max</span>
                  <input className="input" name="score_scale_max" type="number" defaultValue={overview.settings.score_scale_max} />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-slate-700">Outlier mode</span>
                  <select className="input" name="outlier_mode" defaultValue={overview.settings.outlier_mode}>
                    <option value="average_all">Average all scores</option>
                    <option value="drop_high_low">Drop highest and lowest</option>
                    <option value="median">Median</option>
                    <option value="weighted_average">Weighted average</option>
                  </select>
                </label>
              </div>

              <div className="mt-5 grid gap-3">
                {[
                  ['use_weighted_criteria', 'Use weighted criteria'],
                  ['use_judge_weights', 'Use judge weights'],
                  ['comments_enabled', 'Enable comments'],
                  ['finalist_nomination_enabled', 'Enable finalist nomination'],
                  ['leaderboard_public', 'Public leaderboard visible'],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <span className="font-medium text-slate-700">{label}</span>
                    <input
                      type="checkbox"
                      name={key}
                      defaultChecked={Boolean(overview.settings[key as keyof typeof overview.settings])}
                      className="h-5 w-5 rounded border-slate-300 text-slate-950"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl font-bold text-slate-950">Criteria weights</h2>
                <button type="button" className="btn-secondary" onClick={handleFinalistsSave}>
                  Save finalists
                </button>
              </div>
              <div className="mt-5 space-y-4">
                {overview.settings.criteria_weights.map((criterion) => (
                  <div key={criterion.criterion_key} className="grid gap-3 sm:grid-cols-[1fr_120px]">
                    <input className="input" name={`label:${criterion.criterion_key}`} defaultValue={criterion.criterion_label} />
                    <input className="input" name={`weight:${criterion.criterion_key}`} type="number" defaultValue={criterion.weight} />
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-display text-2xl font-bold text-slate-950">Final round selection</h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {overview.leaderboard.map((entry) => (
                <label key={entry.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 rounded border-slate-300 text-slate-950"
                    checked={selectedFinalists.includes(entry.id)}
                    onChange={(e) => {
                      setSelectedFinalists((prev) => e.target.checked ? [...prev, entry.id] : prev.filter((id) => id !== entry.id));
                    }}
                  />
                  <div>
                    <div className="font-semibold text-slate-900">{entry.name}</div>
                    <div className="text-sm text-slate-500">{entry.track} • {entry.average_score?.toFixed(1) || '—'}</div>
                  </div>
                </label>
              ))}
            </div>
          </section>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Save scoring configuration</button>
          </div>
        </form>
      )}

      {toast && (
        <div className="fixed bottom-6 right-4 z-50 sm:right-6">
          <Toast tone={toast.tone} message={toast.message} />
        </div>
      )}
    </div>
  );
}
