import { useEffect, useMemo, useState } from 'react';
import { getLeaderboard } from '../lib/api';
import type { LeaderboardPayload } from '../types';
import useDeviceMode from '../hooks/useDeviceMode';

const REFRESH_MS = 5000;

export default function Leaderboard() {
  const { isMobile, deviceLabel } = useDeviceMode();
  const [payload, setPayload] = useState<LeaderboardPayload | null>(null);
  const [track, setTrack] = useState('all');
  const [view, setView] = useState<'overall' | 'finalists'>('overall');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getLeaderboard(track, view);
        if (active) setPayload(data);
      } finally {
        if (active) setLoading(false);
      }
    };

    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [track, view]);

  const topEntries = useMemo(() => payload?.leaderboard.slice(0, isMobile ? 5 : 10) || [], [payload, isMobile]);

  if (loading || !payload) {
    return <div className="card p-12 text-center text-slate-500">Loading live leaderboard...</div>;
  }

  return (
    <div className="animate-fade-in space-y-6">
      <section className="card overflow-hidden">
        <div className="grid gap-6 px-6 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700">
              {deviceLabel} display mode
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold text-slate-950 sm:text-5xl">Hackathon leaderboard</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              Auto-refreshes every 5 seconds for projector or monitor display. Switch between overall and finalists,
              then filter by track when organizers want a focused view.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['Projects ranked', payload.leaderboard.length],
              ['Tracks live', payload.tracks.length],
              ['Calculation mode', payload.settings.outlier_mode.replaceAll('_', ' ')],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
                <div className="mt-3 font-display text-3xl font-bold text-slate-950">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[0.8fr_0.8fr_1fr]">
          <select className="input" value={track} onChange={(e) => setTrack(e.target.value)}>
            <option value="all">All tracks</option>
            {payload.tracks.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>

          <select className="input" value={view} onChange={(e) => setView(e.target.value as typeof view)}>
            <option value="overall">Overall leaderboard</option>
            <option value="finalists">Finalists view</option>
          </select>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span>Public visibility</span>
            <span className={`badge ${payload.settings.leaderboard_public ? 'pill-success' : 'pill-muted'}`}>
              {payload.settings.leaderboard_public ? 'Live' : 'Hidden'}
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-4">
          {topEntries.map((entry, index) => (
            <article
              key={entry.id}
              className={`card gap-5 p-5 sm:p-6 ${isMobile ? 'flex flex-col items-start' : 'flex items-center'} ${index < 3 ? 'ring-1 ring-orange-200' : ''}`}
            >
              <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[22px] font-display text-2xl font-bold ${
                index === 0 ? 'bg-slate-950 text-white' :
                index === 1 ? 'bg-slate-200 text-slate-900' :
                index === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-slate-100 text-slate-500'
              }`}>
                {index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-2xl font-bold text-slate-950">{entry.name}</h2>
                  <span className="badge bg-slate-100 text-slate-700">{entry.track}</span>
                  {entry.finalist && <span className="badge bg-orange-50 text-orange-700">Finalist</span>}
                  {entry.is_reward_project && <span className="badge bg-amber-100 text-amber-800">Reward Project</span>}
                  {entry.track_winner_label && <span className="badge bg-blue-100 text-blue-800">{entry.track_winner_label}</span>}
                </div>
                <div className="mt-2 text-sm text-slate-500">{entry.team_name} • Table {entry.table_number}</div>
                <div className="mt-4 grid gap-2 sm:grid-cols-5">
                  {[
                    ['Innovation', entry.criterion_averages.innovation],
                    ['Technical', entry.criterion_averages.technical_complexity],
                    ['Design', entry.criterion_averages.design_ux],
                    ['Impact', entry.criterion_averages.impact_market],
                    ['Demo', entry.criterion_averages.presentation_demo],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl bg-slate-50 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">{label}</div>
                      <div className="mt-1 text-sm font-semibold text-slate-800">{value?.toFixed(1) || '—'}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={`${isMobile ? 'w-full text-left' : 'text-right'}`}>
                <div className="font-display text-4xl font-bold text-slate-950">
                  {entry.average_score?.toFixed(1) || '—'}
                </div>
                <div className="text-sm text-slate-500">aggregate score</div>
                <div className="mt-2 text-xs text-slate-400">{entry.submission_count} submitted scores</div>
              </div>
            </article>
          ))}
        </div>

        <aside className="space-y-4">
          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Auto awards</div>
            <div className="mt-4 space-y-4">
              {[
                ['Overall winner', payload.winners.overall?.name],
                ['Best design', payload.winners.bestDesign?.name],
                ['Best technical', payload.winners.bestTechnical?.name],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[24px] bg-slate-50 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
                  <div className="mt-2 font-display text-xl font-bold text-slate-950">{value || 'Pending'}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Manual winners</div>
            <div className="mt-4 space-y-3">
              {payload.awards.rewardProjects.map((award) => (
                <div key={award.id} className="flex items-center justify-between rounded-2xl bg-amber-50 px-4 py-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-amber-700">{award.award_label}</div>
                    <div className="font-semibold text-slate-900">{award.project_name}</div>
                  </div>
                  <div className="text-sm text-slate-500">{award.team_name}</div>
                </div>
              ))}
              {payload.awards.rewardProjects.length === 0 && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No reward projects selected.</div>
              )}
            </div>
          </div>

          <div className="card p-6">
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Track winners</div>
            <div className="mt-4 space-y-3">
              {payload.awards.trackWinners.map((award) => (
                <div key={award.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{award.track}</div>
                    <div className="font-semibold text-slate-900">{award.project_name}</div>
                  </div>
                  <div className="text-sm font-semibold text-slate-500">{award.team_name}</div>
                </div>
              ))}
              {payload.awards.trackWinners.length === 0 && (
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">No track winners selected.</div>
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}
