import type {
  AwardSelection,
  AdminOverview,
  AdminSettings,
  Judge,
  LeaderboardPayload,
  ParticipantProjectForm,
  Project,
  Score,
  ScoreForm,
  Track,
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
export const getTracks = () => req<Track[]>('/tracks');

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

export const getParticipantProjects = (participantId: number) =>
  req<Project[]>(`/participants/projects?participantId=${participantId}`);

export const createParticipantProject = (payload: ParticipantProjectForm) =>
  req<Project>('/participants/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
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
  req<Judge[]>(`/admin/judges?password=${encodeURIComponent(password)}`);

export const getAdminSettings = (password: string) =>
  req<AdminSettings>(`/admin/settings?password=${encodeURIComponent(password)}`);

export const updateAdminSettings = (password: string, payload: Partial<AdminSettings>) =>
  req<AdminSettings>('/admin/settings', {
    method: 'POST',
    body: JSON.stringify({ ...payload, password }),
  });

export const updateFinalists = (password: string, projectIds: number[]) =>
  req<{ ok: boolean }>('/admin/finalists', {
    method: 'POST',
    body: JSON.stringify({ password, projectIds }),
  });

export const getCsvExportUrl = (password: string) =>
  `${BASE}/admin/export.csv?password=${encodeURIComponent(password)}`;

export const getAdminAwards = (password: string) =>
  req<AwardSelection[]>(`/admin/awards?password=${encodeURIComponent(password)}`);

export const getAdminTracks = (password: string) =>
  req<Track[]>(`/admin/tracks?password=${encodeURIComponent(password)}`);

export const createAdminTrack = (password: string, payload: Partial<Track>) =>
  req<Track[]>('/admin/tracks', {
    method: 'POST',
    body: JSON.stringify({ ...payload, password }),
  });

export const updateAdminTrack = (password: string, id: number, payload: Partial<Track>) =>
  req<Track[]>(`/admin/tracks/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...payload, password }),
  });

export const deleteAdminTrack = (password: string, id: number) =>
  req<{ ok: boolean }>(`/admin/tracks/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });

export const updateAdminAwards = (
  password: string,
  payload: { rewardProjectIds: number[]; trackWinners: Record<string, number> },
) =>
  req<{ ok: boolean; awards: AdminOverview['awards'] }>('/admin/awards', {
    method: 'POST',
    body: JSON.stringify({ ...payload, password }),
  });

export const createJudge = (password: string, payload: Partial<Judge>) =>
  req<Judge>('/admin/judges', {
    method: 'POST',
    body: JSON.stringify({ ...payload, password }),
  });

export const updateJudge = (password: string, id: number, payload: Partial<Judge>) =>
  req<Judge>(`/admin/judges/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...payload, password }),
  });

export const deleteJudge = (password: string, id: number) =>
  req<{ ok: boolean }>(`/admin/judges/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });

export const createAdminProject = (password: string, payload: Record<string, unknown>) =>
  req<Project>('/admin/projects', {
    method: 'POST',
    body: JSON.stringify({ ...payload, password }),
  });

export const updateAdminProject = (password: string, id: number, payload: Record<string, unknown>) =>
  req<Project>(`/admin/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...payload, password }),
  });

export const deleteAdminProject = (password: string, id: number) =>
  req<{ ok: boolean }>(`/admin/projects/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ password }),
  });
