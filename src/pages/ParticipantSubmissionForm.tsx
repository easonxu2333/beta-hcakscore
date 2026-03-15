import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Toast from '../components/Toast';
import { createParticipantProject, getParticipantProjects, updateParticipantProject } from '../lib/api';
import type { Participant, ParticipantProjectForm, Project } from '../types';

interface Props {
  participant: Participant;
}

const defaultForm: ParticipantProjectForm = {
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

export default function ParticipantSubmissionForm({ participant }: Props) {
  const navigate = useNavigate();
  const { projectId } = useParams();
  const [form, setForm] = useState<ParticipantProjectForm>({
    ...defaultForm,
    teamName: participant.team_name,
    contactEmail: participant.contact_email,
  });
  const [toast, setToast] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (!projectId) return;
    getParticipantProjects(participant.id).then((projects) => {
      const project = projects.find((entry) => entry.id === Number(projectId));
      if (!project) return;
      setForm({
        projectName: project.name,
        teamName: project.team_name,
        teamMembers: project.team_member_names || [''],
        schoolName: project.school_name || 'UC Berkeley',
        contactEmail: project.contact_email || participant.contact_email,
        track: project.track,
        shortDescription: project.short_description || project.description,
        fullDescription: project.full_description || project.description,
        githubUrl: project.github_url || '',
        demoUrl: project.demo_url || '',
        pitchDeckUrl: project.pitch_deck_url || '',
        videoUrl: project.video_url || '',
        tableNumber: project.table_number === 'TBD' ? '' : project.table_number,
        specialPrizeCategories: project.special_prize_categories || [],
        consentAccepted: Boolean(project.consent_accepted),
        submissionStatus: (project.submission_status as ParticipantProjectForm['submissionStatus']) || 'draft',
      });
    });
  }, [participant.contact_email, participant.id, projectId]);

  useEffect(() => {
    const timer = toast ? window.setTimeout(() => setToast(null), 2200) : null;
    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [toast]);

  const teamMembersString = useMemo(() => form.teamMembers.join('\n'), [form.teamMembers]);

  async function handleSubmit(event: FormEvent, submissionStatus: 'draft' | 'submitted') {
    event.preventDefault();
    const payload = {
      ...form,
      submissionStatus,
      teamMembers: teamMembersString.split('\n').map((entry) => entry.trim()).filter(Boolean),
      specialPrizeCategories: form.specialPrizeCategories,
    };
    try {
      if (projectId) {
        await updateParticipantProject(Number(projectId), payload);
      } else {
        await createParticipantProject(participant.id, payload);
      }
      setToast({ tone: 'success', message: submissionStatus === 'draft' ? 'Draft saved.' : 'Submission sent for review.' });
      navigate('/participant/dashboard');
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Save failed.' });
    }
  }

  return (
    <form className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Submission portal</div>
          <h1 className="mt-2 font-display text-4xl font-bold text-slate-950">{projectId ? 'Edit project submission' : 'New project submission'}</h1>
        </div>
        <Link className="btn-secondary" to="/participant/dashboard">Back</Link>
      </div>

      <section className="card grid gap-4 p-6">
        {[
          ['Project name', 'projectName'],
          ['Team name', 'teamName'],
          ['School / organization', 'schoolName'],
          ['Contact email', 'contactEmail'],
          ['Track', 'track'],
          ['GitHub URL', 'githubUrl'],
          ['Demo URL', 'demoUrl'],
          ['Pitch deck URL', 'pitchDeckUrl'],
          ['Video URL', 'videoUrl'],
        ].map(([label, key]) => (
          <label key={key} className="space-y-2">
            <span className="text-sm font-medium text-slate-700">{label}</span>
            <input
              className="input"
              value={String(form[key as keyof ParticipantProjectForm] || '')}
              onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
            />
          </label>
        ))}

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Team members</span>
          <textarea
            className="input min-h-[100px]"
            value={teamMembersString}
            onChange={(e) => setForm((prev) => ({ ...prev, teamMembers: e.target.value.split('\n') }))}
          />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Short description</span>
          <textarea className="input min-h-[120px]" value={form.shortDescription} onChange={(e) => setForm((prev) => ({ ...prev, shortDescription: e.target.value }))} />
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-slate-700">Full description</span>
          <textarea className="input min-h-[160px]" value={form.fullDescription} onChange={(e) => setForm((prev) => ({ ...prev, fullDescription: e.target.value }))} />
        </label>

        <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input type="checkbox" checked={form.consentAccepted} onChange={(e) => setForm((prev) => ({ ...prev, consentAccepted: e.target.checked }))} />
          <span className="text-sm text-slate-700">I agree to the hackathon rules and submission policy.</span>
        </label>
      </section>

      <div className="flex flex-wrap gap-3">
        <button className="btn-secondary" onClick={(e) => handleSubmit(e, 'draft')}>Save draft</button>
        <button className="btn-primary" onClick={(e) => handleSubmit(e, 'submitted')}>Submit for review</button>
      </div>

      {toast && <Toast tone={toast.tone} message={toast.message} />}
    </form>
  );
}
