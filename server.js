const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initDb } = require('./db');
const {
  buildCriterionWeights,
  computeLeaderboard,
  computeWinners,
  getDefaultSettings,
  getDerivedScore,
} = require('./scoring');

const app = express();
const api = express.Router();
const PORT = process.env.PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'beta2025';

app.use(cors());
app.use(express.json());

initDb();

function adminOnly(req, res, next) {
  const password = req.query.password || (req.body && req.body.password);
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

function getSettings() {
  const settings = db.prepare('SELECT * FROM admin_settings WHERE id = 1').get() || getDefaultSettings();
  const criteriaWeights = db.prepare('SELECT * FROM criteria_weights ORDER BY id').all();
  return {
    ...settings,
    criteria_weights: criteriaWeights,
  };
}

function getProjects() {
  const finalists = new Set(db.prepare('SELECT project_id FROM finalists').all().map((row) => row.project_id));
  return db.prepare(`
    SELECT
      id,
      participant_id,
      name,
      team_name,
      table_number,
      track,
      description,
      short_description,
      full_description,
      members_count,
      demo_url,
      github_url,
      pitch_deck_url,
      video_url,
      contact_email,
      school_name,
      team_member_names,
      special_prize_categories,
      submission_status,
      approval_status,
      published,
      consent_accepted,
      tie_breaker_score,
      is_finalist,
      updated_at,
      created_at
    FROM projects
    ORDER BY table_number
  `).all().map((project) => ({
    ...project,
    id: Number(project.id),
    participant_id: project.participant_id ? Number(project.participant_id) : null,
    members_count: Number(project.members_count || 0),
    tie_breaker_score: Number(project.tie_breaker_score || 0),
    published: Boolean(project.published),
    consent_accepted: Boolean(project.consent_accepted),
    team_member_names: project.team_member_names ? JSON.parse(project.team_member_names) : [],
    special_prize_categories: project.special_prize_categories ? JSON.parse(project.special_prize_categories) : [],
    is_finalist: Boolean(project.is_finalist || finalists.has(project.id)),
  }));
}

function getParticipants() {
  return db.prepare(`
    SELECT
      p.id,
      p.user_id,
      p.team_name,
      p.contact_email,
      p.school_name,
      p.created_at,
      u.name,
      u.email,
      u.status
    FROM participants p
    JOIN users u ON u.id = p.user_id
    ORDER BY p.created_at DESC
  `).all().map((participant) => ({
    ...participant,
    id: Number(participant.id),
    user_id: Number(participant.user_id),
  }));
}

function getParticipantByEmail(email) {
  return db.prepare(`
    SELECT
      p.id,
      p.user_id,
      p.team_name,
      p.contact_email,
      p.school_name,
      p.created_at,
      u.name,
      u.email,
      u.status,
      u.password_hash
    FROM participants p
    JOIN users u ON u.id = p.user_id
    WHERE lower(u.email) = lower(?)
  `).get(email);
}

function getParticipantById(participantId) {
  return db.prepare(`
    SELECT
      p.id,
      p.user_id,
      p.team_name,
      p.contact_email,
      p.school_name,
      p.created_at,
      u.name,
      u.email,
      u.status
    FROM participants p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(participantId);
}

function getJudges() {
  return db.prepare(`
    SELECT id, judge_code, name, email, role, weight, assigned_track, created_at
    FROM judges
    ORDER BY created_at ASC
  `).all();
}

function getScores() {
  return db.prepare(`
    SELECT
      s.*,
      j.judge_code,
      j.name AS judge_name,
      j.role AS judge_role,
      j.weight AS judge_weight,
      p.name AS project_name,
      p.team_name,
      p.track
    FROM scores s
    JOIN judges j ON j.id = s.judge_id
    JOIN projects p ON p.id = s.project_id
    ORDER BY COALESCE(s.submitted_at, s.updated_at) DESC
  `).all().map((score) => ({
    ...score,
    id: Number(score.id),
    judge_id: Number(score.judge_id),
    project_id: Number(score.project_id),
    innovation: Number(score.innovation),
    technical_complexity: Number(score.technical_complexity),
    design_ux: Number(score.design_ux),
    impact_market: Number(score.impact_market),
    presentation_demo: Number(score.presentation_demo),
    total_score: Number(score.total_score),
    weighted_score: Number(score.weighted_score),
    tie_breaker_score: Number(score.tie_breaker_score || 0),
    finalist_nomination: Boolean(score.finalist_nomination),
    is_draft: Boolean(score.is_draft),
  }));
}

function getLeaderboardPayload(filters = {}) {
  const settings = getSettings();
  const projects = getProjects();
  const scores = getScores();
  const criterionWeights = buildCriterionWeights(settings.criteria_weights);
  let leaderboard = computeLeaderboard(projects, scores, settings, criterionWeights);

  if (filters.track && filters.track !== 'all') {
    leaderboard = leaderboard.filter((entry) => entry.track === filters.track);
  }
  if (filters.finalistsOnly) {
    leaderboard = leaderboard.filter((entry) => entry.finalist);
  }

  const winners = computeWinners(leaderboard);
  return {
    settings,
    leaderboard,
    winners,
    tracks: Array.from(new Set(projects.map((project) => project.track))),
  };
}

function getJudgeByCode(judgeCode) {
  return db.prepare(`
    SELECT id, judge_code, name, email, role, weight, assigned_track, created_at
    FROM judges
    WHERE judge_code = ?
  `).get(judgeCode);
}

function getProjectById(projectId) {
  return db.prepare(`
    SELECT id, name, team_name, table_number, track, description, members_count, demo_url, tie_breaker_score, is_finalist, created_at
    FROM projects
    WHERE id = ?
  `).get(projectId);
}

function getMissingScores() {
  const judges = getJudges();
  const projects = getProjects();
  const submitted = db.prepare('SELECT judge_id, project_id FROM scores WHERE is_draft = 0').all();
  const submittedSet = new Set(submitted.map((row) => `${row.judge_id}:${row.project_id}`));

  const rows = [];
  judges.forEach((judge) => {
    projects
      .filter((project) => !judge.assigned_track || judge.assigned_track === project.track)
      .forEach((project) => {
        if (!submittedSet.has(`${judge.id}:${project.id}`)) {
          rows.push({
            judge_code: judge.judge_code,
            judge_name: judge.name,
            project_id: project.id,
            project_name: project.name,
            track: project.track,
            table_number: project.table_number,
          });
        }
      });
  });
  return rows;
}

function getJudgeProgress() {
  const projects = getProjects();
  const relevantCountByTrack = Object.fromEntries(
    Array.from(new Set(projects.map((project) => project.track))).map((track) => [
      track,
      projects.filter((project) => project.track === track).length,
    ]),
  );

  return getJudges().map((judge) => {
    const scoredCount = db.prepare('SELECT COUNT(*) AS count FROM scores WHERE judge_id = ? AND is_draft = 0').get(judge.id).count;
    const assignedTotal = judge.assigned_track ? relevantCountByTrack[judge.assigned_track] : projects.length;
    return {
      ...judge,
      assigned_total: assignedTotal,
      scores_submitted: scoredCount,
      completion_rate: assignedTotal ? Math.round((scoredCount / assignedTotal) * 100) : 0,
    };
  });
}

function toCsv(rows) {
  const escapeCell = (value) => {
    const stringValue = value == null ? '' : String(value);
    if (/[",\n]/.test(stringValue)) return `"${stringValue.replace(/"/g, '""')}"`;
    return stringValue;
  };

  return rows.map((row) => row.map(escapeCell).join(',')).join('\n');
}

api.get('/config', (_req, res) => {
  res.json(getSettings());
});

api.post('/participants/register', (req, res) => {
  const { name, email, password, teamName, schoolName } = req.body;
  if (!name || !email || !password || !teamName) {
    return res.status(400).json({ error: 'Name, email, password, and team name are required' });
  }

  const existing = getParticipantByEmail(email);
  if (existing) {
    return res.status(400).json({ error: 'An account already exists for this email' });
  }

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password_hash, role, status)
    VALUES (?, ?, ?, 'participant', 'active')
  `);
  const userResult = insertUser.run(name.trim(), email.trim(), password);
  db.prepare(`
    INSERT INTO participants (user_id, team_name, contact_email, school_name)
    VALUES (?, ?, ?, ?)
  `).run(Number(userResult.lastInsertRowid), teamName.trim(), email.trim(), schoolName || 'UC Berkeley');

  res.json(getParticipantByEmail(email));
});

api.post('/participants/login', (req, res) => {
  const { email, password } = req.body;
  const participant = getParticipantByEmail(email);
  if (!participant || participant.password_hash !== password || participant.status !== 'active') {
    return res.status(401).json({ error: 'Invalid participant credentials' });
  }
  res.json(participant);
});

api.get('/participants/projects', (req, res) => {
  const { participantId } = req.query;
  let projects = getProjects();
  if (participantId) {
    projects = projects.filter((project) => project.participant_id === Number(participantId));
  }
  res.json(projects);
});

api.post('/participants/projects', (req, res) => {
  const {
    participantId,
    projectName,
    teamName,
    teamMembers,
    schoolName,
    contactEmail,
    track,
    shortDescription,
    fullDescription,
    githubUrl,
    demoUrl,
    pitchDeckUrl,
    videoUrl,
    tableNumber,
    specialPrizeCategories,
    consentAccepted,
    submissionStatus,
  } = req.body;

  const participant = getParticipantById(Number(participantId));
  if (!participant) {
    return res.status(400).json({ error: 'Valid participant is required' });
  }

  const result = db.prepare(`
    INSERT INTO projects (
      participant_id, name, team, team_name, table_number, category, track, description, short_description, full_description,
      members_count, demo_url, github_url, pitch_deck_url, video_url, contact_email, school_name, team_member_names,
      special_prize_categories, submission_status, approval_status, published, consent_accepted, tie_breaker_score, is_finalist, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'under_review', 0, ?, 0, 0, CURRENT_TIMESTAMP)
  `).run(
    participant.id,
    projectName,
    teamName,
    teamName,
    tableNumber || 'TBD',
    track,
    track,
    shortDescription,
    shortDescription,
    fullDescription,
    Array.isArray(teamMembers) ? teamMembers.length : 1,
    demoUrl || '',
    githubUrl || '',
    pitchDeckUrl || '',
    videoUrl || '',
    contactEmail || participant.contact_email,
    schoolName || participant.school_name || 'UC Berkeley',
    JSON.stringify(teamMembers || []),
    JSON.stringify(specialPrizeCategories || []),
    submissionStatus || 'draft',
    consentAccepted ? 1 : 0,
  );

  const project = getProjects().find((entry) => entry.id === Number(result.lastInsertRowid));
  res.json(project);
});

api.put('/participants/projects/:id', (req, res) => {
  const projectId = Number(req.params.id);
  const project = getProjects().find((entry) => entry.id === projectId);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.submission_deadline_locked) return res.status(403).json({ error: 'Submission editing is locked' });

  const payload = req.body;
  db.prepare(`
    UPDATE projects SET
      name = ?,
      team = ?,
      team_name = ?,
      track = ?,
      category = ?,
      short_description = ?,
      full_description = ?,
      description = ?,
      github_url = ?,
      demo_url = ?,
      pitch_deck_url = ?,
      video_url = ?,
      contact_email = ?,
      school_name = ?,
      team_member_names = ?,
      special_prize_categories = ?,
      submission_status = ?,
      consent_accepted = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    payload.projectName,
    payload.teamName,
    payload.teamName,
    payload.track,
    payload.track,
    payload.shortDescription,
    payload.fullDescription,
    payload.shortDescription,
    payload.githubUrl || '',
    payload.demoUrl || '',
    payload.pitchDeckUrl || '',
    payload.videoUrl || '',
    payload.contactEmail || '',
    payload.schoolName || '',
    JSON.stringify(payload.teamMembers || []),
    JSON.stringify(payload.specialPrizeCategories || []),
    payload.submissionStatus || project.submission_status,
    payload.consentAccepted ? 1 : 0,
    projectId,
  );

  res.json(getProjects().find((entry) => entry.id === projectId));
});

api.post('/judges/login', (req, res) => {
  const { name, email, judgeCode, judgeId } = req.body;
  const normalizedCode = String(judgeCode || judgeId || '').trim().toUpperCase();
  if (!name || !email || !normalizedCode) {
    return res.status(400).json({ error: 'Name, email, and judge code are required' });
  }

  let judge = getJudgeByCode(normalizedCode);
  if (!judge) {
    db.prepare(`
      INSERT INTO judges (judge_id, judge_code, name, email, role, weight)
      VALUES (?, ?, ?, ?, 'standard', 1.0)
    `).run(normalizedCode, normalizedCode, name.trim(), email.trim());
    judge = getJudgeByCode(normalizedCode);
  } else {
    db.prepare('UPDATE judges SET name = ?, email = ? WHERE id = ?').run(name.trim(), email.trim(), judge.id);
    judge = getJudgeByCode(normalizedCode);
  }
  res.json(judge);
});

api.get('/projects', (req, res) => {
  const { judgeCode, track } = req.query;
  const projects = getProjects();
  const scores = getScores();
  const judge = judgeCode ? getJudgeByCode(String(judgeCode)) : null;

  const filtered = projects
    .filter((project) => !track || track === 'all' || project.track === track)
    .filter((project) => !judge?.assigned_track || project.track === judge.assigned_track)
    .map((project) => {
      const judgeScore = judge ? scores.find((score) => score.judge_id === judge.id && score.project_id === project.id) : null;
      return {
        ...project,
        status: judgeScore ? (judgeScore.is_draft ? 'draft' : 'scored') : 'unscored',
        my_score: judgeScore || null,
      };
    });

  res.json(filtered);
});

api.get('/judges', adminOnly, (_req, res) => {
  res.json(getJudgeProgress());
});

api.get('/scores', (req, res) => {
  const { judgeCode, projectId, includeDrafts } = req.query;
  let scores = getScores();

  if (judgeCode) {
    const judge = getJudgeByCode(String(judgeCode));
    scores = judge ? scores.filter((score) => score.judge_id === judge.id) : [];
  }
  if (projectId) {
    scores = scores.filter((score) => score.project_id === Number(projectId));
  }
  if (!includeDrafts) {
    scores = scores.filter((score) => !score.is_draft);
  }

  res.json(scores);
});

api.post('/scores', (req, res) => {
  const {
    judgeCode,
    judgeId,
    projectId,
    innovation,
    technical_complexity,
    design_ux,
    impact_market,
    presentation_demo,
    comments,
    finalist_nomination,
    tie_breaker_score,
    isDraft,
  } = req.body;

  const normalizedCode = String(judgeCode || judgeId || '').trim().toUpperCase();
  const judge = getJudgeByCode(normalizedCode);
  const project = getProjectById(Number(projectId));

  if (!judge || !project) {
    return res.status(400).json({ error: 'Valid judge and project are required' });
  }

  const settings = getSettings();
  const criterionWeights = buildCriterionWeights(settings.criteria_weights);
  const scoreInput = {
    innovation: Number(innovation || 0),
    technical_complexity: Number(technical_complexity || 0),
    design_ux: Number(design_ux || 0),
    impact_market: Number(impact_market || 0),
    presentation_demo: Number(presentation_demo || 0),
  };
  const derived = getDerivedScore(scoreInput, settings, criterionWeights, judge.weight);

  db.prepare(`
    INSERT INTO scores (
      judge_id, project_id, innovation, technical, design, impact, presentation,
      technical_complexity, design_ux, impact_market, presentation_demo,
      total, total_score, weighted_score, comments, finalist_nomination, tie_breaker_score, is_draft, submitted_at, updated_at, timestamp
    ) VALUES (
      @judge_id, @project_id, @innovation, @technical, @design, @impact, @presentation,
      @technical_complexity, @design_ux, @impact_market, @presentation_demo,
      @total, @total_score, @weighted_score, @comments, @finalist_nomination, @tie_breaker_score, @is_draft,
      CASE WHEN @is_draft = 1 THEN NULL ELSE CURRENT_TIMESTAMP END,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
    ON CONFLICT(judge_id, project_id) DO UPDATE SET
      innovation = excluded.innovation,
      technical = excluded.technical,
      design = excluded.design,
      impact = excluded.impact,
      presentation = excluded.presentation,
      technical_complexity = excluded.technical_complexity,
      design_ux = excluded.design_ux,
      impact_market = excluded.impact_market,
      presentation_demo = excluded.presentation_demo,
      total = excluded.total,
      total_score = excluded.total_score,
      weighted_score = excluded.weighted_score,
      comments = excluded.comments,
      finalist_nomination = excluded.finalist_nomination,
      tie_breaker_score = excluded.tie_breaker_score,
      is_draft = excluded.is_draft,
      submitted_at = CASE WHEN excluded.is_draft = 1 THEN scores.submitted_at ELSE CURRENT_TIMESTAMP END,
      updated_at = CURRENT_TIMESTAMP
  `).run({
    judge_id: judge.id,
    project_id: project.id,
    innovation: scoreInput.innovation,
    technical: scoreInput.technical_complexity,
    design: scoreInput.design_ux,
    impact: scoreInput.impact_market,
    presentation: scoreInput.presentation_demo,
    technical_complexity: scoreInput.technical_complexity,
    design_ux: scoreInput.design_ux,
    impact_market: scoreInput.impact_market,
    presentation_demo: scoreInput.presentation_demo,
    total: derived.totalScore,
    total_score: derived.totalScore,
    weighted_score: derived.weightedScore,
    comments: comments || '',
    finalist_nomination: finalist_nomination ? 1 : 0,
    tie_breaker_score: Number(tie_breaker_score || project.tie_breaker_score || 0),
    is_draft: isDraft ? 1 : 0,
  });

  const saved = getScores().find((score) => score.judge_id === judge.id && score.project_id === project.id);
  res.json(saved);
});

api.get('/leaderboard', (req, res) => {
  const payload = getLeaderboardPayload({
    track: req.query.track,
    finalistsOnly: req.query.view === 'finalists',
  });
  res.json(payload);
});

api.get('/admin/overview', adminOnly, (_req, res) => {
  const judges = getJudgeProgress();
  const projects = getProjects();
  const participants = getParticipants();
  const scores = getScores();
  const submittedScores = scores.filter((score) => !score.is_draft);
  const settings = getSettings();
  const leaderboardPayload = getLeaderboardPayload();
  const maxPossible = judges.reduce((sum, judge) => sum + (judge.assigned_total || projects.length), 0);

  res.json({
    stats: {
      totalProjects: projects.length,
      totalJudges: judges.length,
      totalScores: submittedScores.length,
      draftScores: scores.filter((score) => score.is_draft).length,
      completionRate: maxPossible ? Math.round((submittedScores.length / maxPossible) * 100) : 0,
      missingScores: getMissingScores().length,
      finalistsCount: leaderboardPayload.leaderboard.filter((entry) => entry.finalist).length,
      pendingSubmissions: projects.filter((project) => project.approval_status === 'under_review').length,
      approvedSubmissions: projects.filter((project) => project.approval_status === 'approved').length,
    },
    judges,
    participants,
    projects,
    scores,
    settings,
    leaderboard: leaderboardPayload.leaderboard,
    winners: leaderboardPayload.winners,
    missingScores: getMissingScores(),
    tracks: leaderboardPayload.tracks,
  });
});

api.get('/admin/scores', adminOnly, (_req, res) => {
  res.json(getScores());
});

api.get('/admin/projects', adminOnly, (_req, res) => {
  res.json(getProjects());
});

api.get('/admin/settings', adminOnly, (_req, res) => {
  res.json(getSettings());
});

api.post('/admin/settings', adminOnly, (req, res) => {
  const current = getSettings();
  const next = {
    ...current,
    ...req.body,
    id: 1,
  };

  db.prepare(`
    UPDATE admin_settings SET
      score_scale_min = @score_scale_min,
      score_scale_max = @score_scale_max,
      use_weighted_criteria = @use_weighted_criteria,
      use_judge_weights = @use_judge_weights,
      outlier_mode = @outlier_mode,
      comments_enabled = @comments_enabled,
      finalist_nomination_enabled = @finalist_nomination_enabled,
      leaderboard_public = @leaderboard_public,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run({
    score_scale_min: Number(next.score_scale_min),
    score_scale_max: Number(next.score_scale_max),
    use_weighted_criteria: next.use_weighted_criteria ? 1 : 0,
    use_judge_weights: next.use_judge_weights ? 1 : 0,
    outlier_mode: next.outlier_mode,
    comments_enabled: next.comments_enabled ? 1 : 0,
    finalist_nomination_enabled: next.finalist_nomination_enabled ? 1 : 0,
    leaderboard_public: next.leaderboard_public ? 1 : 0,
  });

  if (Array.isArray(req.body.criteria_weights)) {
    const updateWeight = db.prepare(`
      UPDATE criteria_weights
      SET criterion_label = ?, weight = ?
      WHERE criterion_key = ?
    `);
    req.body.criteria_weights.forEach((row) => {
      updateWeight.run(row.criterion_label, Number(row.weight), row.criterion_key);
    });
  }

  res.json(getSettings());
});

api.get('/admin/missing-scores', adminOnly, (_req, res) => {
  res.json(getMissingScores());
});

api.post('/admin/finalists', adminOnly, (req, res) => {
  const { projectIds } = req.body;
  if (!Array.isArray(projectIds)) {
    return res.status(400).json({ error: 'projectIds must be an array' });
  }

  db.prepare('DELETE FROM finalists').run();
  db.prepare('UPDATE projects SET is_finalist = 0').run();

  const markFinalist = db.prepare('INSERT OR IGNORE INTO finalists (project_id, round_name) VALUES (?, ?)');
  const updateProject = db.prepare('UPDATE projects SET is_finalist = 1 WHERE id = ?');
  projectIds.forEach((projectId) => {
    markFinalist.run(Number(projectId), 'final');
    updateProject.run(Number(projectId));
  });

  res.json({ ok: true, finalists: getProjects().filter((project) => project.is_finalist) });
});

api.get('/admin/export.csv', adminOnly, (_req, res) => {
  const leaderboardPayload = getLeaderboardPayload();
  const rows = [
    [
      'rank',
      'project_name',
      'team_name',
      'track',
      'table_number',
      'average_score',
      'submission_count',
      'finalist_nomination_count',
      'innovation_avg',
      'technical_avg',
      'design_avg',
      'impact_avg',
      'presentation_avg',
    ],
    ...leaderboardPayload.leaderboard.map((entry) => ([
      entry.rank,
      entry.name,
      entry.team_name,
      entry.track,
      entry.table_number,
      entry.average_score?.toFixed(2) || '',
      entry.submission_count,
      entry.finalist_nomination_count,
      entry.criterion_averages.innovation?.toFixed(2) || '',
      entry.criterion_averages.technical_complexity?.toFixed(2) || '',
      entry.criterion_averages.design_ux?.toFixed(2) || '',
      entry.criterion_averages.impact_market?.toFixed(2) || '',
      entry.criterion_averages.presentation_demo?.toFixed(2) || '',
    ])),
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="hackscore-export.csv"');
  res.send(toCsv(rows));
});

app.use('/api', api);
app.use(api);

const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\nHackScore running at http://localhost:${PORT}`);
    console.log(`Admin password: ${ADMIN_PASSWORD}\n`);
  });
}

module.exports = app;
