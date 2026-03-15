import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react';
import Toast from '../components/Toast';
import {
  createAdminTrack,
  createAdminProject,
  createJudge,
  deleteAdminTrack,
  deleteAdminProject,
  deleteJudge,
  getAdminOverview,
  getCsvExportUrl,
  updateAdminAwards,
  updateAdminTrack,
  updateAdminProject,
  updateJudge,
  updateAdminSettings,
  updateFinalists,
} from '../lib/api';
import type { AdminOverview, Judge, Project, Track } from '../types';
import useDeviceMode from '../hooks/useDeviceMode';

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
  const { isMobile, deviceLabel } = useDeviceMode();
  const [password, setPassword] = useState(() => localStorage.getItem(STORAGE_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>('overview');
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);
  const [selectedFinalists, setSelectedFinalists] = useState<number[]>([]);
  const [selectedRewardProjects, setSelectedRewardProjects] = useState<number[]>([]);
  const [trackWinnerSelections, setTrackWinnerSelections] = useState<Record<string, number>>({});
  const [judgeForm, setJudgeForm] = useState<Partial<Judge>>({ role: 'standard', weight: 1, account_active: true });
  const [editingJudgeId, setEditingJudgeId] = useState<number | null>(null);
  const [projectForm, setProjectForm] = useState<Record<string, unknown>>({ track: 'AI', published: true, approvalStatus: 'under_review', submissionStatus: 'submitted', finalist: false, teamMembers: [] });
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);
  const [trackForm, setTrackForm] = useState<Partial<Track>>({ name: '', is_active: true });
  const [editingTrackId, setEditingTrackId] = useState<number | null>(null);

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
    setSelectedRewardProjects(data.awards.rewardProjects.map((award) => award.project_id));
    setTrackWinnerSelections(Object.fromEntries(data.awards.trackWinners.map((award) => [award.track || award.award_key, award.project_id])));
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

  async function handleAwardsSave() {
    if (!overview) return;
    try {
      await updateAdminAwards(password, {
        rewardProjectIds: selectedRewardProjects,
        trackWinners: trackWinnerSelections,
      });
      await loadAll();
      setToast({ tone: 'success', message: 'Reward projects and track winners updated.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Awards update failed.' });
    }
  }

  async function handleJudgeSave(event: FormEvent) {
    event.preventDefault();
    try {
      if (editingJudgeId) await updateJudge(password, editingJudgeId, judgeForm);
      else await createJudge(password, judgeForm);
      setJudgeForm({ role: 'standard', weight: 1, account_active: true });
      setEditingJudgeId(null);
      await loadAll();
      setToast({ tone: 'success', message: 'Judge updated.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Judge save failed.' });
    }
  }

  async function handleTrackSave(event?: FormEvent) {
    event?.preventDefault();
    try {
      if (editingTrackId) await updateAdminTrack(password, editingTrackId, trackForm);
      else await createAdminTrack(password, trackForm);
      setTrackForm({ name: '', is_active: true });
      setEditingTrackId(null);
      await loadAll();
      setToast({ tone: 'success', message: 'Track updated.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Track save failed.' });
    }
  }

  async function handleProjectSave(event: FormEvent) {
    event.preventDefault();
    try {
      const payload = {
        ...projectForm,
        teamMembers: String(projectForm.teamMembers || '').split('\n').map((entry) => entry.trim()).filter(Boolean),
      };
      if (editingProjectId) await updateAdminProject(password, editingProjectId, payload);
      else await createAdminProject(password, payload);
      setProjectForm({ track: 'AI', published: true, approvalStatus: 'under_review', submissionStatus: 'submitted', finalist: false, teamMembers: [] });
      setEditingProjectId(null);
      await loadAll();
      setToast({ tone: 'success', message: 'Project updated.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Project save failed.' });
    }
  }

  async function handleJudgeToggle(judge: Judge) {
    try {
      await updateJudge(password, judge.id, {
        ...judge,
        account_active: !judge.account_active,
      });
      await loadAll();
      setToast({ tone: 'success', message: `Judge ${!judge.account_active ? 'activated' : 'disabled'}.` });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Judge update failed.' });
    }
  }

  async function handleJudgeDelete(judge: Judge) {
    if (!window.confirm(`Delete judge ${judge.name}? This cannot be undone.`)) return;
    try {
      await deleteJudge(password, judge.id);
      if (editingJudgeId === judge.id) {
        setEditingJudgeId(null);
        setJudgeForm({ role: 'standard', weight: 1, account_active: true });
      }
      await loadAll();
      setToast({ tone: 'success', message: 'Judge deleted.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Judge delete failed.' });
    }
  }

  async function handleProjectDelete(project: Project) {
    if (!window.confirm(`Delete project ${project.name}? This removes related scores too.`)) return;
    try {
      await deleteAdminProject(password, project.id);
      if (editingProjectId === project.id) {
        setEditingProjectId(null);
        setProjectForm({ track: 'AI', published: true, approvalStatus: 'under_review', submissionStatus: 'submitted', finalist: false, teamMembers: [] });
      }
      await loadAll();
      setToast({ tone: 'success', message: 'Project deleted.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Project delete failed.' });
    }
  }

  async function handleTrackDelete(track: string, id: number) {
    if (!window.confirm(`Delete track ${track}?`)) return;
    try {
      await deleteAdminTrack(password, id);
      if (editingTrackId === id) {
        setEditingTrackId(null);
        setTrackForm({ name: '', is_active: true });
      }
      await loadAll();
      setToast({ tone: 'success', message: 'Track deleted.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Track delete failed.' });
    }
  }

  async function handleProjectQuickUpdate(project: Project, patch: Record<string, unknown>, message: string) {
    try {
      await updateAdminProject(password, project.id, {
        projectName: project.name,
        teamName: project.team_name,
        track: project.track,
        shortDescription: project.short_description || project.description,
        fullDescription: project.full_description || project.description,
        tableNumber: project.table_number,
        demoUrl: project.demo_url || '',
        githubUrl: project.github_url || '',
        pitchDeckUrl: project.pitch_deck_url || '',
        videoUrl: project.video_url || '',
        teamMembers: project.team_member_names || [],
        contactEmail: project.contact_email || '',
        schoolName: project.school_name || '',
        submissionStatus: project.submission_status || 'submitted',
        approvalStatus: project.approval_status || 'under_review',
        published: project.published,
        finalist: project.is_finalist,
        ...patch,
      });
      await loadAll();
      setToast({ tone: 'success', message });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Project update failed.' });
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

  const availableTracks = overview?.tracks || [];
  const trackDetails = overview?.trackDetails || [];
  const selectableTracks = Array.from(new Set(trackDetails.map((track) => track.name).concat(availableTracks)));

  function openProjectEditor(project: Project) {
    setExpandedProjectId((prev) => (prev === project.id ? null : project.id));
    setEditingProjectId(project.id);
    setProjectForm({
      projectName: project.name,
      teamName: project.team_name,
      track: project.track,
      tableNumber: project.table_number,
      contactEmail: project.contact_email || '',
      schoolName: project.school_name || '',
      approvalStatus: project.approval_status || 'under_review',
      published: project.published,
      finalist: project.is_finalist,
      shortDescription: project.short_description || '',
      fullDescription: project.full_description || '',
      teamMembers: project.team_member_names || [],
    });
  }

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
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-orange-700">
            <span>Organizer cockpit</span>
            <span className="badge pill-muted normal-case tracking-normal text-[11px]">{deviceLabel}</span>
          </div>
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

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects" value={overview.stats.totalProjects} />
        <StatCard label="Judges" value={overview.stats.totalJudges} />
        <StatCard label="Scores" value={overview.stats.totalScores} sub={`${overview.stats.draftScores} drafts`} />
        <StatCard label="Completion" value={`${overview.stats.completionRate}%`} />
        <StatCard label="Pending" value={overview.stats.pendingSubmissions} />
        <StatCard label="Approved" value={overview.stats.approvedSubmissions} />
        <StatCard label="Reward Picks" value={overview.stats.rewardProjectsCount} />
        <StatCard label="Track Winners" value={overview.stats.trackWinnersCount} />
      </section>

      <section className={`rounded-[28px] border border-slate-200 bg-white p-2 ${isMobile ? 'overflow-x-auto' : 'flex gap-2'}`}>
        <div className={`${isMobile ? 'flex min-w-max gap-2' : 'contents'}`}>
        {(['overview', 'judges', 'projects', 'submissions', 'scores', 'settings'] as Tab[]).map((item) => (
          <button
            key={item}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold capitalize ${isMobile ? 'min-w-[120px]' : 'flex-1'} ${
              tab === item ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
        </div>
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
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-display text-2xl font-bold text-slate-950">Manual awards</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Organizer picks override the generic leaderboard summary for reward projects and track winners.
                  </p>
                </div>
                <button className="btn-secondary" type="button" onClick={handleAwardsSave}>Save awards</button>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Reward projects</div>
                  <div className="mt-3 space-y-3">
                    {overview.leaderboard.map((entry) => (
                      <label key={`reward-${entry.id}`} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3">
                        <input
                          type="checkbox"
                          className="mt-1 h-5 w-5 rounded border-slate-300 text-slate-950"
                          checked={selectedRewardProjects.includes(entry.id)}
                          onChange={(e) => {
                            setSelectedRewardProjects((prev) => (
                              e.target.checked ? Array.from(new Set([...prev, entry.id])) : prev.filter((id) => id !== entry.id)
                            ));
                          }}
                        />
                        <div>
                          <div className="font-semibold text-slate-900">{entry.name}</div>
                          <div className="text-sm text-slate-500">{entry.track} • {entry.average_score?.toFixed(1) || '—'}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Track winners</div>
                  <div className="mt-3 space-y-3">
                    {overview.tracks.map((trackName) => (
                      <label key={trackName} className="block rounded-2xl bg-white px-4 py-3">
                        <div className="mb-2 text-sm font-semibold text-slate-900">{trackName}</div>
                        <select
                          className="input"
                          value={String(trackWinnerSelections[trackName] || '')}
                          onChange={(e) => setTrackWinnerSelections((prev) => ({
                            ...prev,
                            [trackName]: Number(e.target.value),
                          }))}
                        >
                          <option value="">Select winner</option>
                          {overview.projects
                            .filter((project) => project.track === trackName)
                            .map((project) => (
                              <option key={project.id} value={project.id}>
                                {project.name} ({project.team_name})
                              </option>
                            ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>

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
        <section className="space-y-4">
          <form className="card grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleJudgeSave}>
            <input className="input" placeholder="Judge name" value={String(judgeForm.name || '')} onChange={(e) => setJudgeForm((prev) => ({ ...prev, name: e.target.value }))} />
            <input className="input" placeholder="Email" value={String(judgeForm.email || '')} onChange={(e) => setJudgeForm((prev) => ({ ...prev, email: e.target.value }))} />
            <input className="input" placeholder="Judge code" value={String(judgeForm.judge_code || '')} onChange={(e) => setJudgeForm((prev) => ({ ...prev, judge_code: e.target.value.toUpperCase() }))} />
            <input className="input" placeholder="Password / code" value={String(judgeForm.password || '')} onChange={(e) => setJudgeForm((prev) => ({ ...prev, password: e.target.value }))} />
            <select className="input" value={String(judgeForm.role || 'standard')} onChange={(e) => setJudgeForm((prev) => ({ ...prev, role: e.target.value }))}>
              {['standard', 'expert', 'sponsor'].map((role) => <option key={role} value={role}>{role}</option>)}
            </select>
            <select className="input" value={String(judgeForm.assigned_track || '')} onChange={(e) => setJudgeForm((prev) => ({ ...prev, assigned_track: e.target.value || null }))}>
              <option value="">All tracks</option>
              {selectableTracks.map((track) => (
                <option key={track} value={track}>{track}</option>
              ))}
            </select>
            <input className="input" type="number" step="0.1" placeholder="Weight" value={Number(judgeForm.weight || 1)} onChange={(e) => setJudgeForm((prev) => ({ ...prev, weight: Number(e.target.value) }))} />
            <div className="flex gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4">
                <input type="checkbox" checked={Boolean(judgeForm.account_active)} onChange={(e) => setJudgeForm((prev) => ({ ...prev, account_active: e.target.checked }))} />
                <span className="text-sm">Active</span>
              </label>
              <button className="btn-primary flex-1" type="submit">{editingJudgeId ? 'Update judge' : 'Add judge'}</button>
            </div>
          </form>
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
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
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
                    <td className="px-6 py-4">
                      <span className={`badge ${judge.account_active ? 'pill-success' : 'pill-warn'}`}>
                        {judge.account_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={() => { setEditingJudgeId(judge.id); setJudgeForm(judge); }}>Edit</button>
                        <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={() => handleJudgeToggle(judge)}>
                          {judge.account_active ? 'Disable' : 'Enable'}
                        </button>
                        <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={() => handleJudgeDelete(judge)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>
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
        <section className="space-y-4">
          <div className="flex justify-end">
            <button className="btn-secondary" type="button" onClick={handleAwardsSave}>Save reward + track winners</button>
          </div>
          <form className="card grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleProjectSave}>
            <input className="input" placeholder="Project name" value={String(projectForm.projectName || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, projectName: e.target.value }))} />
            <input className="input" placeholder="Team name" value={String(projectForm.teamName || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, teamName: e.target.value }))} />
            <select className="input" value={String(projectForm.track || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, track: e.target.value }))}>
              {selectableTracks.map((track) => (
                <option key={track} value={track}>{track}</option>
              ))}
            </select>
            <input className="input" placeholder="Table number" value={String(projectForm.tableNumber || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, tableNumber: e.target.value }))} />
            <input className="input" placeholder="Contact email" value={String(projectForm.contactEmail || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, contactEmail: e.target.value }))} />
            <input className="input" placeholder="School" value={String(projectForm.schoolName || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, schoolName: e.target.value }))} />
            <select className="input" value={String(projectForm.approvalStatus || 'under_review')} onChange={(e) => setProjectForm((prev) => ({ ...prev, approvalStatus: e.target.value }))}>
              {['draft', 'submitted', 'under_review', 'approved', 'rejected'].map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" checked={Boolean(projectForm.published)} onChange={(e) => setProjectForm((prev) => ({ ...prev, published: e.target.checked }))} />
                <span className="text-sm">Published</span>
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3">
                <input type="checkbox" checked={Boolean(projectForm.finalist)} onChange={(e) => setProjectForm((prev) => ({ ...prev, finalist: e.target.checked }))} />
                <span className="text-sm">Finalist</span>
              </label>
            </div>
            <textarea className="input min-h-[100px] md:col-span-2" placeholder="Short description" value={String(projectForm.shortDescription || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, shortDescription: e.target.value }))} />
            <textarea className="input min-h-[120px] md:col-span-2" placeholder="Full description" value={String(projectForm.fullDescription || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, fullDescription: e.target.value }))} />
            <textarea className="input min-h-[100px] md:col-span-2" placeholder="Team members, one per line" value={Array.isArray(projectForm.teamMembers) ? projectForm.teamMembers.join('\n') : String(projectForm.teamMembers || '')} onChange={(e) => setProjectForm((prev) => ({ ...prev, teamMembers: e.target.value }))} />
            <div className="md:col-span-2 flex justify-end">
              <button className="btn-primary" type="submit">{editingProjectId ? 'Update project' : 'Add project'}</button>
            </div>
          </form>
          <section className="card overflow-hidden">
            <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-6 py-4 font-semibold">Project</th>
                  <th className="px-6 py-4 font-semibold">Team</th>
                  <th className="px-6 py-4 font-semibold">Track</th>
                  <th className="px-6 py-4 font-semibold">Table</th>
                  <th className="px-6 py-4 font-semibold">Approval</th>
                  <th className="px-6 py-4 font-semibold">Published</th>
                  <th className="px-6 py-4 font-semibold">Finalist</th>
                  <th className="px-6 py-4 font-semibold">Awards</th>
                  <th className="px-6 py-4 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {overview.projects.map((project) => (
                  <Fragment key={project.id}>
                    <tr key={project.id}>
                      <td className="px-6 py-4 font-semibold text-slate-900">{project.name}</td>
                      <td className="px-6 py-4 text-slate-600">{project.team_name}</td>
                      <td className="px-6 py-4 text-slate-600">{project.track}</td>
                      <td className="px-6 py-4 text-slate-600">{project.table_number}</td>
                      <td className="px-6 py-4">
                        <span className={`badge ${
                          project.approval_status === 'approved'
                            ? 'pill-success'
                            : project.approval_status === 'rejected'
                              ? 'pill-warn'
                              : 'pill-muted'
                        }`}>
                          {project.approval_status}
                        </span>
                      </td>
                      <td className="px-6 py-4"><span className={`badge ${project.published ? 'pill-success' : 'pill-muted'}`}>{project.published ? 'Visible' : 'Hidden'}</span></td>
                      <td className="px-6 py-4"><span className={`badge ${project.is_finalist ? 'pill-success' : 'pill-muted'}`}>{project.is_finalist ? 'Finalist' : 'No'}</span></td>
                      <td className="px-6 py-4">
                        <div className="flex flex-wrap gap-2">
                          {selectedRewardProjects.includes(project.id) && <span className="badge bg-amber-100 text-amber-800">Reward</span>}
                          {trackWinnerSelections[project.track] === project.id && <span className="badge bg-blue-100 text-blue-800">Track winner</span>}
                          {!selectedRewardProjects.includes(project.id) && trackWinnerSelections[project.track] !== project.id && (
                            <span className="badge pill-muted">None</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button className="btn-secondary px-4 py-2 text-xs" type="button" onClick={() => openProjectEditor(project)}>
                          {expandedProjectId === project.id ? 'Close edit' : 'Edit'}
                        </button>
                      </td>
                    </tr>
                    {expandedProjectId === project.id && (
                      <tr key={`${project.id}-actions`}>
                        <td className="bg-slate-50 px-6 py-5" colSpan={9}>
                          <div className="flex flex-wrap gap-2">
                            <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={() => handleProjectQuickUpdate(project, {
                              approvalStatus: 'approved',
                              published: true,
                            }, 'Project approved.')}>Approve</button>
                            <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={() => handleProjectQuickUpdate(project, {
                              approvalStatus: 'rejected',
                              published: false,
                            }, 'Project rejected.')}>Reject</button>
                            <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={() => handleProjectQuickUpdate(project, {
                              published: !project.published,
                            }, project.published ? 'Project hidden.' : 'Project published.')}>
                              {project.published ? 'Hide' : 'Publish'}
                            </button>
                            <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={() => handleProjectQuickUpdate(project, {
                              finalist: !project.is_finalist,
                            }, project.is_finalist ? 'Finalist removed.' : 'Marked as finalist.')}>
                              {project.is_finalist ? 'Unfinalist' : 'Finalist'}
                            </button>
                            <button
                              className="btn-secondary px-3 py-2 text-xs"
                              type="button"
                              onClick={() => setSelectedRewardProjects((prev) => (
                                prev.includes(project.id) ? prev.filter((id) => id !== project.id) : Array.from(new Set([...prev, project.id]))
                              ))}
                            >
                              {selectedRewardProjects.includes(project.id) ? 'Unreward' : 'Reward'}
                            </button>
                            <button
                              className="btn-secondary px-3 py-2 text-xs"
                              type="button"
                              onClick={() => setTrackWinnerSelections((prev) => ({
                                ...prev,
                                [project.track]: prev[project.track] === project.id ? 0 : project.id,
                              }))}
                            >
                              {trackWinnerSelections[project.track] === project.id ? 'Clear winner' : 'Track winner'}
                            </button>
                            <button className="btn-secondary px-3 py-2 text-xs" type="button" onClick={() => handleProjectDelete(project)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
            </div>
          </section>
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

          <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
            <div className="card p-6">
              <h2 className="font-display text-2xl font-bold text-slate-950">Track management</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Add, rename, or deactivate tracks. Renaming a track updates linked projects, judge assignments, and track winner labels.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <input
                  className="input"
                  placeholder="Track name"
                  value={String(trackForm.name || '')}
                  onChange={(e) => setTrackForm((prev) => ({ ...prev, name: e.target.value }))}
                />
                <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4">
                  <input
                    type="checkbox"
                    checked={Boolean(trackForm.is_active)}
                    onChange={(e) => setTrackForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  />
                  <span className="text-sm">Active</span>
                </label>
                <button className="btn-primary" type="button" onClick={() => handleTrackSave()}>{editingTrackId ? 'Update track' : 'Add track'}</button>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-500">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Track</th>
                      <th className="px-6 py-4 font-semibold">Status</th>
                      <th className="px-6 py-4 font-semibold">Projects</th>
                      <th className="px-6 py-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {trackDetails.map((track) => {
                      return (
                        <tr key={track.id}>
                          <td className="px-6 py-4 font-semibold text-slate-900">{track.name}</td>
                          <td className="px-6 py-4">
                            <span className={`badge ${track.is_active ? 'pill-success' : 'pill-warn'}`}>{track.is_active ? 'Active' : 'Inactive'}</span>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{overview.projects.filter((project) => project.track === track.name).length}</td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                className="btn-secondary px-3 py-2 text-xs"
                                type="button"
                                onClick={() => {
                                  setEditingTrackId(track.id);
                                  setTrackForm(track);
                                }}
                              >
                                Edit
                              </button>
                              <button
                                className="btn-secondary px-3 py-2 text-xs"
                                type="button"
                                onClick={() => handleTrackDelete(track.name, track.id)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
