const express = require('express');
const cors = require('cors');
const path = require('path');
const { db, initDb, resetDemoData, seedDemoData } = require('./db');
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
    SELECT id, judge_code, name, email, role, weight, assigned_track, account_active, password, created_at
    FROM judges
    ORDER BY created_at ASC
  `).all().map((judge) => ({
    ...judge,
    id: Number(judge.id),
    weight: Number(judge.weight || 1),
    account_active: Boolean(judge.account_active),
  }));
}

function getTracks() {
  return db.prepare(`
    SELECT id, name, is_active, sort_order, created_at
    FROM tracks
    ORDER BY sort_order ASC, name ASC
  `).all().map((track) => ({
    ...track,
    id: Number(track.id),
    is_active: Boolean(track.is_active),
  }));
}

function ensureTrackExists(name) {
  if (!name || !String(name).trim()) return;
  const normalized = String(name).trim();
  db.prepare(`
    INSERT OR IGNORE INTO tracks (name, is_active, sort_order)
    VALUES (?, 1, COALESCE((SELECT MAX(sort_order) + 1 FROM tracks), 1))
  `).run(normalized);
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

function getAwardSelections() {
  return db.prepare(`
    SELECT
      a.id,
      a.award_type,
      a.award_key,
      a.award_label,
      a.track,
      a.project_id,
      a.created_at,
      p.name AS project_name,
      p.team_name,
      p.table_number,
      p.track AS project_track
    FROM award_selections a
    JOIN projects p ON p.id = a.project_id
    ORDER BY a.award_type ASC, a.award_label ASC
  `).all().map((award) => ({
    ...award,
    id: Number(award.id),
    project_id: Number(award.project_id),
  }));
}

function getLeaderboardPayload(filters = {}) {
  const settings = getSettings();
  const projects = getProjects();
  const scores = getScores();
  const manualAwards = getAwardSelections();
  const criterionWeights = buildCriterionWeights(settings.criteria_weights);
  let leaderboard = computeLeaderboard(projects, scores, settings, criterionWeights);

  const awardsByProject = manualAwards.reduce((map, award) => {
    const current = map.get(award.project_id) || [];
    current.push(award);
    map.set(award.project_id, current);
    return map;
  }, new Map());

  leaderboard = leaderboard.map((entry) => {
    const awards = awardsByProject.get(entry.id) || [];
    const trackWinnerAward = awards.find((award) => award.award_type === 'track_winner');
    return {
      ...entry,
      awards,
      is_reward_project: awards.some((award) => award.award_type === 'reward_project'),
      track_winner_label: trackWinnerAward ? trackWinnerAward.award_label : null,
    };
  });

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
    awards: {
      rewardProjects: manualAwards.filter((award) => award.award_type === 'reward_project'),
      trackWinners: manualAwards.filter((award) => award.award_type === 'track_winner'),
    },
    tracks: getTracks().filter((track) => track.is_active).map((track) => track.name),
  };
}

function getJudgeByCode(judgeCode) {
  return db.prepare(`
    SELECT id, judge_code, name, email, role, weight, assigned_track, account_active, password, created_at
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
  res.json({
    ...getSettings(),
    tracks: getTracks().filter((track) => track.is_active).map((track) => track.name),
  });
});

api.get('/tracks', (_req, res) => {
  res.json(getTracks().filter((track) => track.is_active));
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
    participantName,
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

  if (!participantName || !teamName || !contactEmail || !projectName || !track) {
    return res.status(400).json({ error: 'participantName, teamName, contactEmail, projectName, and track are required' });
  }
  ensureTrackExists(track);
  let participant = getParticipantByEmail(contactEmail);
  if (!participant) {
    const userResult = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, status)
      VALUES (?, ?, '', 'participant', 'active')
    `).run(participantName.trim(), contactEmail.trim());
    db.prepare(`
      INSERT INTO participants (user_id, team_name, contact_email, school_name)
      VALUES (?, ?, ?, ?)
    `).run(Number(userResult.lastInsertRowid), teamName.trim(), contactEmail.trim(), schoolName || 'UC Berkeley');
    participant = getParticipantByEmail(contactEmail);
  } else {
    db.prepare('UPDATE users SET name = ?, email = ? WHERE id = ?').run(participantName.trim(), contactEmail.trim(), participant.user_id);
    db.prepare('UPDATE participants SET team_name = ?, contact_email = ?, school_name = ? WHERE id = ?').run(
      teamName.trim(),
      contactEmail.trim(),
      schoolName || participant.school_name || 'UC Berkeley',
      participant.id,
    );
    participant = getParticipantByEmail(contactEmail);
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
      INSERT INTO judges (judge_id, judge_code, name, email, role, weight, account_active, password)
      VALUES (?, ?, ?, ?, 'standard', 1.0, 1, ?)
    `).run(normalizedCode, normalizedCode, name.trim(), email.trim(), normalizedCode);
    judge = getJudgeByCode(normalizedCode);
  } else {
    if (!judge.account_active) {
      return res.status(403).json({ error: 'Judge account is disabled' });
    }
    db.prepare('UPDATE judges SET name = ?, email = ? WHERE id = ?').run(name.trim(), email.trim(), judge.id);
    judge = getJudgeByCode(normalizedCode);
  }
  res.json(judge);
});

api.get('/admin/judges', adminOnly, (_req, res) => {
  res.json(getJudges());
});

api.get('/admin/tracks', adminOnly, (_req, res) => {
  res.json(getTracks());
});

api.post('/admin/tracks', adminOnly, (req, res) => {
  const { name, is_active } = req.body;
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Track name is required' });
  ensureTrackExists(name);
  if (is_active === false) {
    db.prepare('UPDATE tracks SET is_active = 0 WHERE name = ?').run(String(name).trim());
  }
  res.json(getTracks());
});

api.put('/admin/tracks/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Track not found' });

  const nextName = String(req.body.name || existing.name).trim();
  const nextActive = req.body.is_active === undefined ? existing.is_active : (req.body.is_active ? 1 : 0);
  if (!nextName) return res.status(400).json({ error: 'Track name is required' });

  db.prepare('UPDATE tracks SET name = ?, is_active = ? WHERE id = ?').run(nextName, nextActive, id);

  if (nextName !== existing.name) {
    db.prepare('UPDATE projects SET track = ?, category = ? WHERE track = ?').run(nextName, nextName, existing.name);
    db.prepare('UPDATE judges SET assigned_track = ? WHERE assigned_track = ?').run(nextName, existing.name);
    db.prepare('UPDATE judge_assignments SET track = ? WHERE track = ?').run(nextName, existing.name);
    db.prepare(`
      UPDATE award_selections
      SET track = ?, award_key = CASE WHEN award_type = 'track_winner' THEN ? ELSE award_key END, award_label = CASE WHEN award_type = 'track_winner' THEN ? ELSE award_label END
      WHERE track = ?
    `).run(nextName, nextName, `${nextName} Winner`, existing.name);
  }

  res.json(getTracks());
});

api.delete('/admin/tracks/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Track not found' });

  const projectCount = db.prepare('SELECT COUNT(*) AS count FROM projects WHERE track = ?').get(existing.name).count;
  const judgeCount = db.prepare('SELECT COUNT(*) AS count FROM judges WHERE assigned_track = ?').get(existing.name).count;
  if (projectCount > 0 || judgeCount > 0) {
    return res.status(400).json({ error: 'Track is still assigned to projects or judges' });
  }

  db.prepare('DELETE FROM award_selections WHERE track = ?').run(existing.name);
  db.prepare('DELETE FROM tracks WHERE id = ?').run(id);
  res.json({ ok: true });
});

api.post('/admin/judges', adminOnly, (req, res) => {
  const { name, email, judge_code, role, assigned_track, weight, account_active, password } = req.body;
  if (!name || !email || !judge_code) return res.status(400).json({ error: 'name, email, and judge_code are required' });
  ensureTrackExists(assigned_track);
  db.prepare(`
    INSERT INTO judges (judge_id, judge_code, name, email, role, weight, assigned_track, account_active, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(judge_code, judge_code, name, email, role || 'standard', Number(weight || 1), assigned_track || null, account_active === false ? 0 : 1, password || judge_code);
  res.json(getJudgeByCode(judge_code));
});

api.put('/admin/judges/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const { name, email, judge_code, role, assigned_track, weight, account_active, password } = req.body;
  ensureTrackExists(assigned_track);
  db.prepare(`
    UPDATE judges
    SET name = ?, email = ?, judge_code = ?, judge_id = ?, role = ?, assigned_track = ?, weight = ?, account_active = ?, password = ?
    WHERE id = ?
  `).run(name, email, judge_code, judge_code, role || 'standard', assigned_track || null, Number(weight || 1), account_active ? 1 : 0, password || judge_code, id);
  res.json(getJudges().find((judge) => judge.id === id));
});

api.delete('/admin/judges/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM judge_assignments WHERE judge_id = ?').run(id);
  db.prepare('DELETE FROM judges WHERE id = ?').run(id);
  res.json({ ok: true });
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
      rewardProjectsCount: leaderboardPayload.awards.rewardProjects.length,
      trackWinnersCount: leaderboardPayload.awards.trackWinners.length,
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
    awards: leaderboardPayload.awards,
    missingScores: getMissingScores(),
    tracks: leaderboardPayload.tracks,
    trackDetails: getTracks(),
  });
});

api.get('/admin/scores', adminOnly, (_req, res) => {
  res.json(getScores());
});

api.get('/admin/projects', adminOnly, (_req, res) => {
  res.json(getProjects());
});

api.post('/admin/projects', adminOnly, (req, res) => {
  const {
    projectName, teamName, track, shortDescription, fullDescription, tableNumber, demoUrl, githubUrl, pitchDeckUrl,
    videoUrl, teamMembers, contactEmail, schoolName, submissionStatus, approvalStatus, published, finalist,
  } = req.body;
  if (!projectName || !teamName || !track) {
    return res.status(400).json({ error: 'projectName, teamName, and track are required' });
  }
  ensureTrackExists(track);
  const result = db.prepare(`
    INSERT INTO projects (
      name, team, team_name, table_number, category, track, description, short_description, full_description,
      members_count, demo_url, github_url, pitch_deck_url, video_url, contact_email, school_name, team_member_names,
      special_prize_categories, submission_status, approval_status, published, consent_accepted, tie_breaker_score, is_finalist, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, CURRENT_TIMESTAMP)
  `).run(
    projectName,
    teamName,
    teamName,
    tableNumber || 'TBD',
    track,
    track,
    shortDescription || '',
    shortDescription || '',
    fullDescription || shortDescription || '',
    Array.isArray(teamMembers) ? teamMembers.length : 1,
    demoUrl || '',
    githubUrl || '',
    pitchDeckUrl || '',
    videoUrl || '',
    contactEmail || '',
    schoolName || '',
    JSON.stringify(teamMembers || []),
    JSON.stringify([]),
    submissionStatus || 'submitted',
    approvalStatus || 'under_review',
    published ? 1 : 0,
    finalist ? 1 : 0,
  );
  res.json(getProjects().find((project) => project.id === Number(result.lastInsertRowid)));
});

api.put('/admin/projects/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const {
    projectName, teamName, track, shortDescription, fullDescription, tableNumber, demoUrl, githubUrl, pitchDeckUrl,
    videoUrl, teamMembers, contactEmail, schoolName, submissionStatus, approvalStatus, published, finalist,
  } = req.body;
  ensureTrackExists(track);
  db.prepare(`
    UPDATE projects
    SET name = ?, team = ?, team_name = ?, table_number = ?, category = ?, track = ?, description = ?, short_description = ?,
        full_description = ?, members_count = ?, demo_url = ?, github_url = ?, pitch_deck_url = ?, video_url = ?, contact_email = ?,
        school_name = ?, team_member_names = ?, submission_status = ?, approval_status = ?, published = ?, is_finalist = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    projectName,
    teamName,
    teamName,
    tableNumber || 'TBD',
    track,
    track,
    shortDescription || '',
    shortDescription || '',
    fullDescription || shortDescription || '',
    Array.isArray(teamMembers) ? teamMembers.length : 1,
    demoUrl || '',
    githubUrl || '',
    pitchDeckUrl || '',
    videoUrl || '',
    contactEmail || '',
    schoolName || '',
    JSON.stringify(teamMembers || []),
    submissionStatus || 'submitted',
    approvalStatus || 'under_review',
    published ? 1 : 0,
    finalist ? 1 : 0,
    id,
  );
  res.json(getProjects().find((project) => project.id === id));
});

api.delete('/admin/projects/:id', adminOnly, (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM finalists WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM judge_assignments WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM scores WHERE project_id = ?').run(id);
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  res.json({ ok: true });
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

api.get('/admin/awards', adminOnly, (_req, res) => {
  res.json(getAwardSelections());
});

api.post('/admin/awards', adminOnly, (req, res) => {
  const { rewardProjectIds, trackWinners } = req.body;

  if (rewardProjectIds && !Array.isArray(rewardProjectIds)) {
    return res.status(400).json({ error: 'rewardProjectIds must be an array' });
  }
  if (trackWinners && (typeof trackWinners !== 'object' || Array.isArray(trackWinners))) {
    return res.status(400).json({ error: 'trackWinners must be an object keyed by track' });
  }

  db.prepare(`DELETE FROM award_selections WHERE award_type = 'reward_project'`).run();
  db.prepare(`DELETE FROM award_selections WHERE award_type = 'track_winner'`).run();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO award_selections (award_type, award_key, award_label, track, project_id)
    VALUES (?, ?, ?, ?, ?)
  `);

  (rewardProjectIds || []).forEach((projectId, index) => {
    const project = getProjectById(Number(projectId));
    if (!project) return;
    insert.run('reward_project', `reward-${index + 1}`, `Reward Project ${index + 1}`, null, Number(projectId));
  });

  Object.entries(trackWinners || {}).forEach(([track, projectId]) => {
    const project = getProjectById(Number(projectId));
    if (!project) return;
    insert.run('track_winner', track, `${track} Winner`, track, Number(projectId));
  });

  res.json({
    ok: true,
    awards: {
      rewardProjects: getAwardSelections().filter((award) => award.award_type === 'reward_project'),
      trackWinners: getAwardSelections().filter((award) => award.award_type === 'track_winner'),
    },
  });
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

api.post('/admin/demo-data/reset', adminOnly, (_req, res) => {
  resetDemoData();
  res.json({
    ok: true,
    stats: {
      projects: db.prepare('SELECT COUNT(*) AS count FROM projects').get().count,
      judges: db.prepare('SELECT COUNT(*) AS count FROM judges').get().count,
      scores: db.prepare('SELECT COUNT(*) AS count FROM scores').get().count,
      tracks: db.prepare('SELECT COUNT(*) AS count FROM tracks').get().count,
    },
  });
});

api.post('/admin/demo-data/seed', adminOnly, (_req, res) => {
  seedDemoData();
  const overview = getLeaderboardPayload();
  res.json({
    ok: true,
    stats: {
      projects: db.prepare('SELECT COUNT(*) AS count FROM projects').get().count,
      judges: db.prepare('SELECT COUNT(*) AS count FROM judges').get().count,
      scores: db.prepare('SELECT COUNT(*) AS count FROM scores').get().count,
      tracks: db.prepare('SELECT COUNT(*) AS count FROM tracks').get().count,
      finalists: db.prepare('SELECT COUNT(*) AS count FROM finalists').get().count,
      rewardProjects: overview.awards.rewardProjects.length,
      trackWinners: overview.awards.trackWinners.length,
    },
  });
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
