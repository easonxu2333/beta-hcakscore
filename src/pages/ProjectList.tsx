import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getProjects } from '../lib/api';
import type { Judge, Project } from '../types';

interface Props {
  judge: Judge;
}

export default function ProjectList({ judge }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState('');
  const [track, setTrack] = useState('all');
  const [status, setStatus] = useState<'all' | 'scored' | 'draft' | 'unscored'>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getProjects(judge.judge_code)
      .then(setProjects)
      .finally(() => setLoading(false));
  }, [judge.judge_code]);

  const tracks = useMemo(() => ['all', ...Array.from(new Set(projects.map((project) => project.track)))], [projects]);

  const filtered = useMemo(() => {
    return projects.filter((project) => {
      if (track !== 'all' && project.track !== track) return false;
      if (status !== 'all' && project.status !== status) return false;
      if (search) {
        const haystack = `${project.name} ${project.team_name} ${project.table_number}`.toLowerCase();
        if (!haystack.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [projects, search, status, track]);

  const stats = {
    total: projects.length,
    scored: projects.filter((project) => project.status === 'scored').length,
    draft: projects.filter((project) => project.status === 'draft').length,
    unscored: projects.filter((project) => project.status === 'unscored').length,
  };
  const completionRate = stats.total ? Math.round((stats.scored / stats.total) * 100) : 0;

  return (
    <div className="animate-fade-in space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="card p-6 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Judge dashboard</div>
              <h1 className="mt-2 font-display text-4xl font-bold text-slate-950">Assigned projects</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Filter by track, jump directly to a booth, and keep your progress visible at all times.
                {judge.assigned_track ? ` Your primary assignment is ${judge.assigned_track}.` : ' You currently see all tracks.'}
              </p>
            </div>
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Progress</div>
              <div className="mt-2 flex items-end gap-3">
                <div className="font-display text-4xl font-bold text-slate-950">{completionRate}%</div>
                <div className="pb-1 text-sm text-slate-500">{stats.scored} of {stats.total} submitted</div>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full rounded-full bg-slate-950 transition-all" style={{ width: `${completionRate}%` }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {[
            ['Scored', stats.scored, 'pill-success'],
            ['Drafts', stats.draft, 'pill-warn'],
            ['Open', stats.unscored, 'pill-muted'],
          ].map(([label, value, tone]) => (
            <div key={label} className="card p-5">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
              <div className="mt-3 flex items-center justify-between">
                <div className="font-display text-3xl font-bold text-slate-950">{value}</div>
                <span className={`badge ${tone}`}>{label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
          <input
            className="input"
            placeholder="Search project name, team, or table"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select className="input" value={track} onChange={(e) => setTrack(e.target.value)}>
            {tracks.map((option) => (
              <option key={option} value={option}>
                {option === 'all' ? 'All tracks' : option}
              </option>
            ))}
          </select>

          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="all">All statuses</option>
            <option value="scored">Scored</option>
            <option value="draft">Drafts</option>
            <option value="unscored">Unscored</option>
          </select>
        </div>
      </section>

      {loading ? (
        <div className="card p-12 text-center text-slate-500">Loading projects...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500">No projects match the current filters.</div>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((project) => {
            const statusTone = project.status === 'scored'
              ? 'pill-success'
              : project.status === 'draft'
                ? 'pill-warn'
                : 'pill-muted';
            const statusLabel = project.status === 'unscored' ? 'Not scored' : project.status === 'draft' ? 'Draft saved' : 'Scored';

            return (
              <article key={project.id} className="card flex h-full flex-col p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="badge bg-slate-100 text-slate-700">{project.track}</span>
                      <span className={`badge ${statusTone}`}>{statusLabel}</span>
                      {project.is_finalist && <span className="badge bg-orange-50 text-orange-700">Finalist</span>}
                    </div>
                    <h2 className="mt-4 font-display text-2xl font-bold text-slate-950">{project.name}</h2>
                    <p className="mt-1 text-sm font-medium text-slate-600">{project.team_name}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 px-3 py-2 text-center text-white">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Table</div>
                    <div className="font-display text-lg font-bold">{project.table_number}</div>
                  </div>
                </div>

                <p className="mt-4 min-h-[72px] text-sm leading-6 text-slate-600">{project.description}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 rounded-[24px] bg-slate-50 p-4 text-sm">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Team size</div>
                    <div className="mt-1 font-semibold text-slate-900">{project.members_count} members</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Your score</div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {project.my_score ? `${project.my_score.total_score.toFixed(0)} pts` : 'Pending'}
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3">
                  <Link to={`/score/${project.id}`} className="btn-primary text-center">
                    {project.status === 'scored' ? 'Edit score' : project.status === 'draft' ? 'Resume draft' : 'Score project'}
                  </Link>
                  {project.demo_url && (
                    <a href={project.demo_url} target="_blank" rel="noreferrer" className="btn-secondary text-center">
                      Open demo link
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
