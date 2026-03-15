import type {
  AdminOverview,
  AdminSettings,
  Judge,
  JudgeProgress,
  LeaderboardPayload,
  MissingScore,
  Participant,
  ParticipantProjectForm,
  Project,
  Score,
  ScoreForm,
} from '../types';

const BASE = '/api';

async function req<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

export const getConfig = () => req<AdminSettings>('/config');

export const login = (name: string, email: string, judgeCode: string) =>
  req<Judge>('/judges/login', {
    method: 'POST',
    body: JSON.stringify({ name, email, judgeCode }),
  });

export const getProjects = (judgeCode?: string, track?: string) => {
  const qs = new URLSearchParams();
  if (judgeCode) qs.set('judgeCode', judgeCode);
  if (track) qs.set('track', track);
  return req<Project[]>(`/projects?${qs}`);
};

export const participantRegister = (payload: {
  name: string;
  email: string;
  password: string;
  teamName: string;
  schoolName: string;
}) =>
  req<Participant>('/participants/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const participantLogin = (email: string, password: string) =>
  req<Participant>('/participants/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const getParticipantProjects = (participantId: number) =>
  req<Project[]>(`/participants/projects?participantId=${participantId}`);

export const createParticipantProject = (participantId: number, payload: ParticipantProjectForm) =>
  req<Project>('/participants/projects', {
    method: 'POST',
    body: JSON.stringify({ participantId, ...payload }),
  });

export const updateParticipantProject = (projectId: number, payload: ParticipantProjectForm) =>
  req<Project>(`/participants/projects/${projectId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });

export const getScores = (params: { judgeCode?: string; projectId?: number; includeDrafts?: boolean }) => {
  const qs = new URLSearchParams();
  if (params.judgeCode) qs.set('judgeCode', params.judgeCode);
  if (params.projectId) qs.set('projectId', String(params.projectId));
  if (params.includeDrafts) qs.set('includeDrafts', '1');
  return req<Score[]>(`/scores?${qs}`);
};

export const submitScore = (judgeCode: string, projectId: number, form: ScoreForm, isDraft = false) =>
  req<Score>('/scores', {
    method: 'POST',
    body: JSON.stringify({ judgeCode, projectId, ...form, isDraft }),
  });

export const getLeaderboard = (track?: string, view?: 'overall' | 'finalists') => {
  const qs = new URLSearchParams();
  if (track) qs.set('track', track);
  if (view) qs.set('view', view);
  return req<LeaderboardPayload>(`/leaderboard?${qs}`);
};

export const getAdminOverview = (password: string) =>
  req<AdminOverview>(`/admin/overview?password=${encodeURIComponent(password)}`);

export const getAdminScores = (password: string) =>
  req<Score[]>(`/admin/scores?password=${encodeURIComponent(password)}`);

export const getAdminProjects = (password: string) =>
  req<Project[]>(`/admin/projects?password=${encodeURIComponent(password)}`);

export const getAdminJudges = (password: string) =>
  req<JudgeProgress[]>(`/judges?password=${encodeURIComponent(password)}`);

export const getAdminSettings = (password: string) =>
  req<AdminSettings>(`/admin/settings?password=${encodeURIComponent(password)}`);

export const updateAdminSettings = (password: string, payload: Partial<AdminSettings>) =>
  req<AdminSettings>('/admin/settings', {
    method: 'POST',
    body: JSON.stringify({ ...payload, password }),
  });

export const getMissingScores = (password: string) =>
  req<MissingScore[]>(`/admin/missing-scores?password=${encodeURIComponent(password)}`);

export const updateFinalists = (password: string, projectIds: number[]) =>
  req<{ ok: boolean }>('/admin/finalists', {
    method: 'POST',
    body: JSON.stringify({ password, projectIds }),
  });

export const getCsvExportUrl = (password: string) =>
  `${BASE}/admin/export.csv?password=${encodeURIComponent(password)}`;
