import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Toast from '../components/Toast';
import { createParticipantProject, getTracks } from '../lib/api';
import type { ParticipantProjectForm } from '../types';

const defaultForm: ParticipantProjectForm = {
  participantName: '',
  projectName: '',
  teamName: '',
  teamMembers: [''],
  schoolName: 'UC Berkeley',
  contactEmail: '',
  track: 'AI',
  shortDescription: '',
  fullDescription: '',
  githubUrl: '',
  demoUrl: '',
  pitchDeckUrl: '',
  videoUrl: '',
  tableNumber: '',
  specialPrizeCategories: [],
  consentAccepted: false,
  submissionStatus: 'draft',
};

export default function ParticipantSubmissionForm() {
  const [form, setForm] = useState<ParticipantProjectForm>(defaultForm);
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);
  const [tracks, setTracks] = useState<string[]>(['AI', 'Web3', 'HealthTech', 'FinTech', 'Consumer', 'Open Innovation']);
  const [saving, setSaving] = useState(false);
  const [successModal, setSuccessModal] = useState<{ projectName: string; teamName: string; track: string } | null>(null);

  useEffect(() => {
    const timer = toast ? window.setTimeout(() => setToast(null), 2500) : null;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    getTracks()
      .then((rows) => setTracks(rows.map((track) => track.name)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!tracks.length) return;
    if (!tracks.includes(form.track)) {
      setForm((prev) => ({ ...prev, track: tracks[0] }));
    }
  }, [tracks, form.track]);

  async function handleSubmit(event: FormEvent, submissionStatus: 'draft' | 'submitted') {
    event.preventDefault();
    setSaving(true);
    try {
      await createParticipantProject({
        ...form,
        submissionStatus,
        teamMembers: form.teamMembers.join('\n').split('\n').map((entry) => entry.trim()).filter(Boolean),
      });
      if (submissionStatus === 'draft') {
        setToast({ tone: 'success', message: 'Draft saved.' });
      } else {
        setSuccessModal({
          projectName: form.projectName,
          teamName: form.teamName,
          track: form.track,
        });
      }
      if (submissionStatus === 'submitted') {
        setForm({
          ...defaultForm,
          track: tracks[0] || defaultForm.track,
        });
      }
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Submission failed.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="animate-fade-in space-y-6" onSubmit={(e) => handleSubmit(e, 'submitted')}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Participant submission</div>
          <h1 className="mt-2 font-display text-4xl font-bold text-slate-950">Submit your project</h1>
          <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
            No account needed. Fill in your name, team name, and email, then save a draft or submit for organizer review.
          </p>
        </div>
        <Link className="btn-secondary" to="/leaderboard">View leaderboard</Link>
      </div>

      <section className="card grid gap-4 p-6 sm:grid-cols-2">
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Your name</span>
          <input className="input" required value={form.participantName} onChange={(e) => setForm((prev) => ({ ...prev, participantName: e.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Team name</span>
          <input className="input" required value={form.teamName} onChange={(e) => setForm((prev) => ({ ...prev, teamName: e.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Contact email</span>
          <input className="input" required type="email" value={form.contactEmail} onChange={(e) => setForm((prev) => ({ ...prev, contactEmail: e.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Project name</span>
          <input className="input" required value={form.projectName} onChange={(e) => setForm((prev) => ({ ...prev, projectName: e.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Track</span>
          <select className="input" required value={form.track} onChange={(e) => setForm((prev) => ({ ...prev, track: e.target.value }))}>
            {tracks.map((track) => (
              <option key={track} value={track}>{track}</option>
            ))}
          </select>
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">School / organization</span>
          <input className="input" value={form.schoolName} onChange={(e) => setForm((prev) => ({ ...prev, schoolName: e.target.value }))} />
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Team members</span>
          <textarea className="input min-h-[100px]" value={form.teamMembers.join('\n')} onChange={(e) => setForm((prev) => ({ ...prev, teamMembers: e.target.value.split('\n') }))} />
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Short description</span>
          <textarea className="input min-h-[110px]" value={form.shortDescription} onChange={(e) => setForm((prev) => ({ ...prev, shortDescription: e.target.value }))} />
        </label>
        <label className="space-y-2 sm:col-span-2">
          <span className="text-sm font-medium text-slate-700">Full description</span>
          <textarea className="input min-h-[150px]" value={form.fullDescription} onChange={(e) => setForm((prev) => ({ ...prev, fullDescription: e.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">GitHub URL</span>
          <input className="input" value={form.githubUrl} onChange={(e) => setForm((prev) => ({ ...prev, githubUrl: e.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Demo URL</span>
          <input className="input" value={form.demoUrl} onChange={(e) => setForm((prev) => ({ ...prev, demoUrl: e.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Pitch deck URL</span>
          <input className="input" value={form.pitchDeckUrl} onChange={(e) => setForm((prev) => ({ ...prev, pitchDeckUrl: e.target.value }))} />
        </label>
        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Video URL</span>
          <input className="input" value={form.videoUrl} onChange={(e) => setForm((prev) => ({ ...prev, videoUrl: e.target.value }))} />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2">
          <input required type="checkbox" checked={form.consentAccepted} onChange={(e) => setForm((prev) => ({ ...prev, consentAccepted: e.target.checked }))} />
          <span className="text-sm text-slate-700">I agree to the event rules and submission policy.</span>
        </label>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn-secondary" disabled={saving} onClick={(e) => handleSubmit(e, 'draft')}>
          {saving ? 'Saving...' : 'Save draft'}
        </button>
        <button type="submit" className="btn-primary" disabled={saving || !form.consentAccepted}>
          {saving ? 'Submitting...' : 'Submit project'}
        </button>
      </div>

      {toast && <Toast tone={toast.tone} message={toast.message} />}

      {successModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="card w-full max-w-lg p-6 sm:p-8">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-[20px] bg-emerald-50 text-3xl text-emerald-600">
              ✓
            </div>
            <div className="mt-5">
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">Submission received</div>
              <h2 className="mt-2 font-display text-3xl font-bold text-slate-950">Project submitted successfully</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                <span className="font-semibold text-slate-900">{successModal.projectName}</span> from{' '}
                <span className="font-semibold text-slate-900">{successModal.teamName}</span> is now in organizer review.
              </p>
            </div>

            <div className="mt-5 grid gap-3 rounded-[24px] bg-slate-50 p-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Track</div>
                <div className="mt-1 font-semibold text-slate-900">{successModal.track}</div>
              </div>
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Status</div>
                <div className="mt-1 font-semibold text-slate-900">Under review</div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" className="btn-secondary flex-1" onClick={() => setSuccessModal(null)}>
                Submit another project
              </button>
              <Link to="/leaderboard" className="btn-primary flex-1 text-center" onClick={() => setSuccessModal(null)}>
                View leaderboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </form>
  );
}
