import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Toast from '../components/Toast';
import { getConfig, getProjects, getScores, submitScore } from '../lib/api';
import type { AdminSettings, Judge, Project, ScoreForm } from '../types';

interface Props {
  judge: Judge;
}

const defaultForm = (): ScoreForm => ({
  innovation: 0,
  technical_complexity: 0,
  design_ux: 0,
  impact_market: 0,
  presentation_demo: 0,
  comments: '',
  finalist_nomination: false,
  tie_breaker_score: 0,
});

const STORAGE_KEY = (judgeCode: string, projectId: string) => `hackscore:draft:${judgeCode}:${projectId}`;

export default function ScoringPage({ judge }: Props) {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [form, setForm] = useState<ScoreForm>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    const timer = toast ? window.setTimeout(() => setToast(null), 2200) : null;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    Promise.all([
      getProjects(judge.judge_code),
      getConfig(),
      getScores({ judgeCode: judge.judge_code, projectId: Number(projectId), includeDrafts: true }),
    ]).then(([projectList, config, scores]) => {
      setProjects(projectList);
      setSettings(config);
      const currentProject = projectList.find((entry) => entry.id === Number(projectId)) || null;
      setProject(currentProject);

      if (scores[0]) {
        const score = scores[0];
        setForm({
          innovation: score.innovation,
          technical_complexity: score.technical_complexity,
          design_ux: score.design_ux,
          impact_market: score.impact_market,
          presentation_demo: score.presentation_demo,
          comments: score.comments || '',
          finalist_nomination: Boolean(score.finalist_nomination),
          tie_breaker_score: score.tie_breaker_score || currentProject?.tie_breaker_score || 0,
        });
      } else {
        const raw = localStorage.getItem(STORAGE_KEY(judge.judge_code, projectId));
        if (raw) {
          try {
            setForm(JSON.parse(raw));
            return;
          } catch {
            localStorage.removeItem(STORAGE_KEY(judge.judge_code, projectId));
          }
        }
        setForm((prev) => ({ ...prev, tie_breaker_score: currentProject?.tie_breaker_score || 0 }));
      }
    });
  }, [judge.judge_code, projectId]);

  const criteria = useMemo(() => settings?.criteria_weights || [], [settings]);
  const scoreRange = useMemo(() => {
    const min = settings?.score_scale_min ?? 1;
    const max = settings?.score_scale_max ?? 10;
    return Array.from({ length: max - min + 1 }, (_, index) => min + index);
  }, [settings]);

  const total = form.innovation + form.technical_complexity + form.design_ux + form.impact_market + form.presentation_demo;
  const allSet = [form.innovation, form.technical_complexity, form.design_ux, form.impact_market, form.presentation_demo].every((value) => value > 0);

  const currentIndex = projects.findIndex((entry) => entry.id === Number(projectId));
  const previousProject = currentIndex > 0 ? projects[currentIndex - 1] : null;
  const nextProject = currentIndex >= 0 && currentIndex < projects.length - 1 ? projects[currentIndex + 1] : null;

  const handleCriterionChange = (key: keyof ScoreForm, value: number | boolean | string) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY(judge.judge_code, projectId), JSON.stringify(next));
      return next;
    });
  };

  async function handleSaveDraft() {
    if (!project) return;
    setSaving(true);
    try {
      await submitScore(judge.judge_code, project.id, form, true);
      localStorage.setItem(STORAGE_KEY(judge.judge_code, projectId), JSON.stringify(form));
      setToast({ tone: 'info', message: 'Draft saved locally and on server.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Draft save failed.' });
    } finally {
      setSaving(false);
    }
  }

  async function handleSubmit(redirectTarget?: string) {
    if (!project || !allSet) return;
    setSaving(true);
    try {
      await submitScore(judge.judge_code, project.id, form, false);
      localStorage.removeItem(STORAGE_KEY(judge.judge_code, projectId));
      setToast({ tone: 'success', message: 'Score submitted successfully.' });
      if (redirectTarget) navigate(redirectTarget);
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Score submission failed.' });
    } finally {
      setSaving(false);
    }
  }

  if (!project || !settings) {
    return <div className="card p-12 text-center text-slate-500">Loading scoring sheet...</div>;
  }

  return (
    <div className="animate-fade-in space-y-6 pb-28">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link to="/projects" className="font-medium text-slate-700 hover:text-slate-950">Projects</Link>
        <span>/</span>
        <span>{project.name}</span>
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="badge bg-teal-50 text-teal-700">{project.track}</span>
                <span className="badge bg-slate-100 text-slate-700">Table {project.table_number}</span>
                {project.is_finalist && <span className="badge bg-orange-50 text-orange-700">Finalist</span>}
              </div>
              <h1 className="mt-4 font-display text-4xl font-bold text-slate-950">{project.name}</h1>
              <p className="mt-2 text-lg font-semibold text-slate-600">{project.team_name}</p>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">{project.description}</p>
            </div>

            <div className="rounded-[28px] bg-slate-950 px-5 py-4 text-white">
              <div className="text-xs uppercase tracking-[0.2em] text-slate-300">Live total</div>
              <div className="mt-2 font-display text-5xl font-bold">{total}</div>
              <div className="text-sm text-slate-300">out of {settings.score_scale_max * criteria.length}</div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Navigation</div>
          <div className="mt-4 grid gap-3">
            <button
              type="button"
              className="btn-secondary w-full disabled:opacity-40"
              disabled={!previousProject}
              onClick={() => previousProject && navigate(`/score/${previousProject.id}`)}
            >
              Previous project
            </button>
            <button
              type="button"
              className="btn-secondary w-full disabled:opacity-40"
              disabled={!nextProject}
              onClick={() => nextProject && navigate(`/score/${nextProject.id}`)}
            >
              Next project
            </button>
            {project.demo_url && (
              <a href={project.demo_url} target="_blank" rel="noreferrer" className="btn-secondary w-full text-center">
                Open demo URL
              </a>
            )}
            <div className="rounded-[24px] bg-slate-50 p-4 text-sm text-slate-600">
              Drafts are also kept in local storage so the form survives brief connectivity issues.
            </div>
          </div>
        </div>
      </section>

      <section className="card space-y-6 p-6 sm:p-8">
        {criteria.map((criterion) => (
          <div key={criterion.criterion_key} className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold text-slate-950">{criterion.criterion_label}</h2>
                <p className="text-sm text-slate-500">Weight {criterion.weight}%</p>
              </div>
              <div className="font-display text-3xl font-bold text-slate-950">
                {form[criterion.criterion_key as keyof ScoreForm] as number || '—'}
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
              {scoreRange.map((value) => {
                const active = form[criterion.criterion_key as keyof ScoreForm] === value;
                return (
                  <button
                    key={value}
                    type="button"
                    className={`score-chip ${active ? 'active' : ''}`}
                    onClick={() => handleCriterionChange(criterion.criterion_key as keyof ScoreForm, value)}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {settings.comments_enabled && (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-700">Judge comments</span>
            <textarea
              className="input min-h-[132px] resize-y"
              placeholder="Optional notes for organizers or finalists review."
              value={form.comments}
              onChange={(e) => handleCriterionChange('comments', e.target.value)}
            />
          </label>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          {settings.finalist_nomination_enabled && (
            <button
              type="button"
              onClick={() => handleCriterionChange('finalist_nomination', !form.finalist_nomination)}
              className={`rounded-[24px] border px-4 py-4 text-left transition ${
                form.finalist_nomination ? 'border-orange-300 bg-orange-50 text-orange-800' : 'border-slate-200 bg-white text-slate-700'
              }`}
            >
              <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Finals nomination</div>
              <div className="mt-2 font-display text-xl font-bold">
                {form.finalist_nomination ? 'Yes, nominate for finals' : 'No finals nomination'}
              </div>
            </button>
          )}

          <label className="block rounded-[24px] border border-slate-200 bg-white px-4 py-4">
            <span className="text-xs uppercase tracking-[0.2em] text-slate-400">Tie-breaker score</span>
            <input
              className="mt-3 w-full bg-transparent text-2xl font-bold text-slate-950 outline-none"
              type="number"
              step="0.1"
              value={form.tie_breaker_score}
              onChange={(e) => handleCriterionChange('tie_breaker_score', Number(e.target.value))}
            />
          </label>
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-24 right-4 z-50 sm:right-6">
          <Toast tone={toast.tone} message={toast.message} />
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row">
          <button type="button" className="btn-secondary flex-1" onClick={handleSaveDraft} disabled={saving}>
            Save draft
          </button>
          <button
            type="button"
            className="btn-primary flex-[1.35]"
            onClick={() => handleSubmit(nextProject ? `/score/${nextProject.id}` : '/projects')}
            disabled={!allSet || saving}
          >
            {saving ? 'Saving...' : nextProject ? 'Submit and open next project' : 'Submit score'}
          </button>
        </div>
      </div>
    </div>
  );
}
