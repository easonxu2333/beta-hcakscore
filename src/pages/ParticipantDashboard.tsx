import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getParticipantProjects } from '../lib/api';
import type { Participant, Project } from '../types';

interface Props {
  participant: Participant;
}

export default function ParticipantDashboard({ participant }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    getParticipantProjects(participant.id).then(setProjects);
  }, [participant.id]);

  return (
    <div className="animate-fade-in space-y-6">
      <section className="card p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm font-semibold uppercase tracking-[0.24em] text-teal-700">Participant dashboard</div>
            <h1 className="mt-2 font-display text-4xl font-bold text-slate-950">{participant.team_name}</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Manage your submissions, track review status, and update project links before the deadline locks.
            </p>
          </div>
          <Link to="/participant/projects/new" className="btn-primary">Submit a new project</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {projects.map((project) => (
          <article key={project.id} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-display text-2xl font-bold text-slate-950">{project.name}</div>
                <div className="text-sm text-slate-500">{project.track}</div>
              </div>
              <span className="badge bg-slate-100 text-slate-700">{project.approval_status}</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{project.short_description || project.description}</p>
            <div className="mt-5 flex gap-3">
              <Link to={`/participant/projects/${project.id}/edit`} className="btn-secondary">Edit</Link>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Status: {project.submission_status}
              </div>
            </div>
          </article>
        ))}

        {projects.length === 0 && (
          <div className="card p-10 text-center text-slate-500">
            No submissions yet. Start with your first project.
          </div>
        )}
      </section>
    </div>
  );
}
