const Database = require('better-sqlite3');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { CRITERION_KEYS, getDefaultSettings } = require('./scoring');

function getDbPath() {
  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'hackathon.db');
  }
  return path.join(__dirname, 'hackathon.db');
}

const dbPath = getDbPath();
const bundledDbPath = path.join(__dirname, 'hackathon.db');

if (process.env.VERCEL && !fs.existsSync(dbPath) && fs.existsSync(bundledDbPath)) {
  fs.copyFileSync(bundledDbPath, dbPath);
}

const db = new Database(dbPath);

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function addColumnIfMissing(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'participant',
      status TEXT NOT NULL DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      team_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      school_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS judges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judge_code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT DEFAULT 'standard',
      weight REAL DEFAULT 1.0,
      assigned_track TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      team_name TEXT NOT NULL,
      table_number TEXT NOT NULL,
      track TEXT NOT NULL,
      description TEXT DEFAULT '',
      members_count INTEGER DEFAULT 3,
      demo_url TEXT,
      tie_breaker_score REAL DEFAULT 0,
      is_finalist INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judge_id INTEGER NOT NULL,
      project_id INTEGER NOT NULL,
      innovation INTEGER NOT NULL DEFAULT 0,
      technical_complexity INTEGER NOT NULL DEFAULT 0,
      design_ux INTEGER NOT NULL DEFAULT 0,
      impact_market INTEGER NOT NULL DEFAULT 0,
      presentation_demo INTEGER NOT NULL DEFAULT 0,
      total_score REAL NOT NULL DEFAULT 0,
      weighted_score REAL NOT NULL DEFAULT 0,
      comments TEXT,
      finalist_nomination INTEGER DEFAULT 0,
      tie_breaker_score REAL DEFAULT 0,
      is_draft INTEGER DEFAULT 0,
      submitted_at DATETIME,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(judge_id, project_id)
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      score_scale_min INTEGER DEFAULT 1,
      score_scale_max INTEGER DEFAULT 10,
      use_weighted_criteria INTEGER DEFAULT 1,
      use_judge_weights INTEGER DEFAULT 1,
      outlier_mode TEXT DEFAULT 'average_all',
      comments_enabled INTEGER DEFAULT 1,
      finalist_nomination_enabled INTEGER DEFAULT 1,
      leaderboard_public INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS criteria_weights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      criterion_key TEXT UNIQUE NOT NULL,
      criterion_label TEXT NOT NULL,
      weight REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS judge_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      judge_id INTEGER NOT NULL,
      project_id INTEGER,
      track TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS finalists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER UNIQUE NOT NULL,
      round_name TEXT DEFAULT 'final',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  addColumnIfMissing('judges', 'judge_id', 'TEXT');
  addColumnIfMissing('judges', 'judge_code', 'TEXT');
  addColumnIfMissing('judges', 'role', "TEXT DEFAULT 'standard'");
  addColumnIfMissing('judges', 'weight', 'REAL DEFAULT 1.0');
  addColumnIfMissing('judges', 'assigned_track', 'TEXT');

  addColumnIfMissing('projects', 'team', 'TEXT');
  addColumnIfMissing('projects', 'team_name', 'TEXT');
  addColumnIfMissing('projects', 'category', 'TEXT');
  addColumnIfMissing('projects', 'track', 'TEXT');
  addColumnIfMissing('projects', 'participant_id', 'INTEGER');
  addColumnIfMissing('projects', 'short_description', 'TEXT');
  addColumnIfMissing('projects', 'full_description', 'TEXT');
  addColumnIfMissing('projects', 'github_url', 'TEXT');
  addColumnIfMissing('projects', 'pitch_deck_url', 'TEXT');
  addColumnIfMissing('projects', 'video_url', 'TEXT');
  addColumnIfMissing('projects', 'contact_email', 'TEXT');
  addColumnIfMissing('projects', 'school_name', 'TEXT');
  addColumnIfMissing('projects', 'team_member_names', 'TEXT');
  addColumnIfMissing('projects', 'special_prize_categories', 'TEXT');
  addColumnIfMissing('projects', 'submission_status', "TEXT DEFAULT 'submitted'");
  addColumnIfMissing('projects', 'approval_status', "TEXT DEFAULT 'approved'");
  addColumnIfMissing('projects', 'published', 'INTEGER DEFAULT 1');
  addColumnIfMissing('projects', 'consent_accepted', 'INTEGER DEFAULT 1');
  addColumnIfMissing('projects', 'submission_deadline_locked', 'INTEGER DEFAULT 0');
  addColumnIfMissing('projects', 'updated_at', 'DATETIME');
  addColumnIfMissing('projects', 'members_count', 'INTEGER DEFAULT 3');
  addColumnIfMissing('projects', 'demo_url', 'TEXT');
  addColumnIfMissing('projects', 'tie_breaker_score', 'REAL DEFAULT 0');
  addColumnIfMissing('projects', 'is_finalist', 'INTEGER DEFAULT 0');

  addColumnIfMissing('scores', 'technical', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'design', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'impact', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'presentation', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'technical_complexity', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'design_ux', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'impact_market', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'presentation_demo', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'total', 'REAL DEFAULT 0');
  addColumnIfMissing('scores', 'total_score', 'REAL DEFAULT 0');
  addColumnIfMissing('scores', 'weighted_score', 'REAL DEFAULT 0');
  addColumnIfMissing('scores', 'comments', 'TEXT');
  addColumnIfMissing('scores', 'finalist_nomination', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'tie_breaker_score', 'REAL DEFAULT 0');
  addColumnIfMissing('scores', 'is_draft', 'INTEGER DEFAULT 0');
  addColumnIfMissing('scores', 'submitted_at', 'DATETIME');
  addColumnIfMissing('scores', 'updated_at', 'DATETIME');

  db.exec(`
    UPDATE judges
    SET judge_code = COALESCE(judge_code, judge_id)
    WHERE judge_code IS NULL AND judge_id IS NOT NULL;

    UPDATE projects
    SET team_name = COALESCE(team_name, team)
    WHERE team_name IS NULL;

    UPDATE projects
    SET short_description = COALESCE(short_description, description),
        full_description = COALESCE(full_description, description),
        contact_email = COALESCE(contact_email, 'team@example.com'),
        submission_status = COALESCE(submission_status, 'submitted'),
        approval_status = COALESCE(approval_status, 'approved'),
        published = COALESCE(published, 1),
        consent_accepted = COALESCE(consent_accepted, 1),
        updated_at = COALESCE(updated_at, created_at)
    WHERE 1 = 1;

    UPDATE projects
    SET track = COALESCE(track, category)
    WHERE track IS NULL;

    UPDATE scores
    SET technical_complexity = COALESCE(technical_complexity, technical, 0),
        design_ux = COALESCE(design_ux, design, 0),
        impact_market = COALESCE(impact_market, impact, 0),
        presentation_demo = COALESCE(presentation_demo, presentation, 0),
        total_score = COALESCE(total_score, total, 0),
        submitted_at = COALESCE(submitted_at, updated_at)
    WHERE 1 = 1;
  `);
}

function seedSettings() {
  const defaults = getDefaultSettings();
  db.prepare(`
    INSERT OR IGNORE INTO admin_settings (
      id, score_scale_min, score_scale_max, use_weighted_criteria, use_judge_weights,
      outlier_mode, comments_enabled, finalist_nomination_enabled, leaderboard_public
    ) VALUES (1, @score_scale_min, @score_scale_max, @use_weighted_criteria, @use_judge_weights,
      @outlier_mode, @comments_enabled, @finalist_nomination_enabled, @leaderboard_public)
  `).run(defaults);

  const weights = [
    ['innovation', 'Innovation', 25],
    ['technical_complexity', 'Technical Complexity', 25],
    ['design_ux', 'Design / UX', 15],
    ['impact_market', 'Impact / Market Potential', 25],
    ['presentation_demo', 'Presentation / Demo Quality', 10],
  ];

  const insertWeight = db.prepare(`
    INSERT OR IGNORE INTO criteria_weights (criterion_key, criterion_label, weight)
    VALUES (?, ?, ?)
  `);
  weights.forEach((row) => insertWeight.run(...row));
}

function seedProjects() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM projects').get().count;
  if (count >= 12) return;

  db.prepare('DELETE FROM projects').run();
  const projects = [
    ['AI Legal Copilot', 'LexLoop', 'A01', 'AI', 'Copilot for university legal aid clinics and contract review.', 4, 'https://demo.example.com/ai-legal-copilot', 'https://github.com/lexloop/ai-legal-copilot', 'https://slides.example.com/ai-legal-copilot', 'https://video.example.com/ai-legal-copilot', 8.7, 1, 'approved'],
    ['MediScan', 'PulseStack', 'A02', 'HealthTech', 'Smartphone-based triage assistant for campus clinics.', 5, 'https://demo.example.com/mediscan', 'https://github.com/pulsestack/mediscan', 'https://slides.example.com/mediscan', 'https://video.example.com/mediscan', 8.4, 1, 'approved'],
    ['ChainCred', 'BlockBloom', 'A03', 'Web3', 'Portable credential wallet for hackathon and campus achievements.', 3, 'https://demo.example.com/chaincred', 'https://github.com/blockbloom/chaincred', 'https://slides.example.com/chaincred', 'https://video.example.com/chaincred', 8.1, 0, 'approved'],
    ['CampusBudget AI', 'DormOps', 'A04', 'FinTech', 'Budget planner and aid coach tuned for student spending.', 4, 'https://demo.example.com/campusbudget-ai', 'https://github.com/dormops/campusbudget-ai', 'https://slides.example.com/campusbudget-ai', 'https://video.example.com/campusbudget-ai', 8.0, 1, 'approved'],
    ['NeuroNest', 'Synapse House', 'A05', 'HealthTech', 'Neurodivergent-friendly focus environment with adaptive prompts.', 4, 'https://demo.example.com/neuronest', 'https://github.com/synapse-house/neuronest', 'https://slides.example.com/neuronest', 'https://video.example.com/neuronest', 7.9, 0, 'under_review'],
    ['GreenRoute', 'EcoMotion', 'B01', 'Open Innovation', 'Carbon-aware routing engine for shared campus mobility.', 4, 'https://demo.example.com/greenroute', 'https://github.com/ecomotion/greenroute', 'https://slides.example.com/greenroute', 'https://video.example.com/greenroute', 7.8, 0, 'approved'],
    ['PitchPilot', 'Launchpad Crew', 'B02', 'AI', 'Real-time pitch coach for founders during demo day.', 3, 'https://demo.example.com/pitchpilot', 'https://github.com/launchpad/pitchpilot', 'https://slides.example.com/pitchpilot', 'https://video.example.com/pitchpilot', 7.6, 1, 'approved'],
    ['StudyFlow', 'StudyVerse', 'B03', 'Open Innovation', 'AI planner for project work, office hours, and team sprints.', 5, 'https://demo.example.com/studyflow', 'https://github.com/studyverse/studyflow', 'https://slides.example.com/studyflow', 'https://video.example.com/studyflow', 7.5, 0, 'submitted'],
    ['LedgerLeaf', 'Money Commons', 'B04', 'FinTech', 'Transparent micro-grant disbursement and tracking for student orgs.', 4, 'https://demo.example.com/ledgerleaf', 'https://github.com/moneycommons/ledgerleaf', 'https://slides.example.com/ledgerleaf', 'https://video.example.com/ledgerleaf', 7.4, 0, 'submitted'],
    ['VitalPatch', 'CareLayer', 'B05', 'HealthTech', 'Wearable patch analytics for early stress and fatigue detection.', 4, 'https://demo.example.com/vitalpatch', 'https://github.com/carelayer/vitalpatch', 'https://slides.example.com/vitalpatch', 'https://video.example.com/vitalpatch', 8.2, 1, 'approved'],
    ['OpenTable Ops', 'QueueCraft', 'C01', 'Open Innovation', 'Live event floor ops dashboard for booths, judges, and traffic.', 3, 'https://demo.example.com/opentable-ops', 'https://github.com/queuecraft/opentable-ops', 'https://slides.example.com/opentable-ops', 'https://video.example.com/opentable-ops', 7.7, 0, 'approved'],
    ['ProofMesh', 'Trustless Labs', 'C02', 'Web3', 'Proof-of-attendance and bounty attribution network for hackathons.', 4, 'https://demo.example.com/proofmesh', 'https://github.com/trustless-labs/proofmesh', 'https://slides.example.com/proofmesh', 'https://video.example.com/proofmesh', 7.3, 0, 'rejected'],
  ];

  const insert = db.prepare(`
    INSERT INTO projects (
      name, team, team_name, table_number, category, track, description, short_description, full_description,
      members_count, demo_url, github_url, pitch_deck_url, video_url, contact_email, school_name, team_member_names,
      special_prize_categories, submission_status, approval_status, published, consent_accepted, tie_breaker_score, is_finalist, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, 1, 1, ?, ?, CURRENT_TIMESTAMP)
  `);
  projects.forEach((project, index) => {
    insert.run(
      project[0],
      project[1],
      project[1],
      project[2],
      project[3],
      project[3],
      project[4],
      project[4],
      `${project[4]} Full build details and architecture notes.`,
      project[5],
      project[6],
      project[7],
      project[8],
      project[9],
      `team${index + 1}@example.com`,
      'UC Berkeley',
      JSON.stringify([`${project[1]} Lead`, `${project[1]} Builder`, `${project[1]} Designer`]),
      JSON.stringify(['Best AI Use', 'Community Impact']),
      project[12],
      project[10],
      project[11],
    );
  });
}

function seedParticipants() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM participants').get().count;
  if (count >= 4) return;

  const users = [
    ['Maya Lin', 'maya@lexloop.dev', 'participant', 'active', 'maya2025'],
    ['Jordan Kim', 'jordan@pulsestack.dev', 'participant', 'active', 'jordan2025'],
    ['Aisha Noor', 'aisha@studyverse.dev', 'participant', 'active', 'aisha2025'],
    ['Victor Wong', 'victor@trustless.dev', 'participant', 'active', 'victor2025'],
    ['Hackathon Admin', 'admin@hackscore.app', 'admin', 'active', 'beta2025'],
  ];

  const insertUser = db.prepare(`
    INSERT OR IGNORE INTO users (name, email, role, status, password_hash)
    VALUES (?, ?, ?, ?, ?)
  `);
  users.forEach((user) => insertUser.run(...user));

  const insertParticipant = db.prepare(`
    INSERT OR IGNORE INTO participants (user_id, team_name, contact_email, school_name)
    VALUES (?, ?, ?, ?)
  `);

  const participantUsers = db.prepare(`SELECT id, name, email FROM users WHERE role = 'participant' ORDER BY id LIMIT 4`).all();
  participantUsers.forEach((user, index) => {
    const teamNames = ['LexLoop', 'PulseStack', 'StudyVerse', 'Trustless Labs'];
    insertParticipant.run(user.id, teamNames[index], user.email, 'UC Berkeley');
  });

  const participants = db.prepare('SELECT id FROM participants ORDER BY id').all();
  const linkProject = db.prepare('UPDATE projects SET participant_id = ?, contact_email = ?, school_name = ? WHERE id = ?');
  const projectIds = db.prepare('SELECT id FROM projects ORDER BY id LIMIT 4').all();
  participants.forEach((participant, index) => {
    linkProject.run(participant.id, users[index][1], 'UC Berkeley', projectIds[index].id);
  });
}

function seedJudges() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM judges').get().count;
  if (count >= 6) return;

  db.prepare('DELETE FROM judges').run();
  const judges = [
    ['JUDGE-AI-01', 'Dr. Sarah Chen', 'sarah.chen@university.edu', 'expert', 1.2, 'AI'],
    ['JUDGE-HLTH-02', 'Marcus Patel', 'marcus.patel@hospital.org', 'expert', 1.2, 'HealthTech'],
    ['JUDGE-WEB3-03', 'Avery Brooks', 'avery@web3fund.com', 'sponsor', 0.8, 'Web3'],
    ['JUDGE-FIN-04', 'Naomi Rivera', 'naomi@finlab.io', 'standard', 1.0, 'FinTech'],
    ['JUDGE-OPEN-05', 'Priya Desai', 'priya@startupstudio.com', 'standard', 1.0, 'Open Innovation'],
    ['JUDGE-FLOAT-06', 'Leo Martinez', 'leo@designcollective.co', 'expert', 1.1, null],
  ];

  const insert = db.prepare(`
    INSERT INTO judges (judge_id, judge_code, name, email, role, weight, assigned_track)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  judges.forEach((judge) => insert.run(judge[0], ...judge));
}

function seedAssignments() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM judge_assignments').get().count;
  if (count > 0) return;

  const judges = db.prepare('SELECT id, assigned_track FROM judges').all();
  const projects = db.prepare('SELECT id, track FROM projects').all();
  const insert = db.prepare('INSERT INTO judge_assignments (judge_id, project_id, track) VALUES (?, ?, ?)');

  judges.forEach((judge) => {
    projects
      .filter((project) => !judge.assigned_track || project.track === judge.assigned_track)
      .forEach((project) => insert.run(judge.id, project.id, project.track));
  });
}

function seedScores() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM scores').get().count;
  if (count >= 30) return;

  db.prepare('DELETE FROM scores').run();
  const judges = db.prepare('SELECT id, judge_code, weight, assigned_track FROM judges ORDER BY id').all();
  const projects = db.prepare('SELECT id, track, tie_breaker_score FROM projects ORDER BY id').all();
  const insert = db.prepare(`
    INSERT INTO scores (
      judge_id, project_id, innovation, technical, design, impact, presentation,
      technical_complexity, design_ux, impact_market, presentation_demo,
      total, total_score, weighted_score, comments, finalist_nomination, tie_breaker_score, is_draft, submitted_at, updated_at, timestamp
    ) VALUES (
      @judge_id, @project_id, @innovation, @technical, @design, @impact, @presentation,
      @technical_complexity, @design_ux, @impact_market, @presentation_demo,
      @total, @total_score, @weighted_score, @comments, @finalist_nomination, @tie_breaker_score, @is_draft, @submitted_at, @updated_at, @timestamp
    )
  `);

  judges.forEach((judge, judgeIndex) => {
    const visibleProjects = projects.filter((project, projectIndex) => {
      if (judge.assigned_track && project.track !== judge.assigned_track && judgeIndex !== 5) return false;
      return projectIndex < 7 || (projectIndex + judgeIndex) % 3 === 0;
    });

    visibleProjects.forEach((project, projectIndex) => {
      const innovation = 6 + ((judgeIndex + projectIndex) % 5);
      const technicalComplexity = 5 + ((projectIndex + 2) % 5);
      const designUx = 6 + ((judgeIndex + projectIndex + 1) % 4);
      const impactMarket = 5 + ((judgeIndex + projectIndex + 3) % 5);
      const presentationDemo = 6 + ((judgeIndex + projectIndex + 4) % 4);
      const totalScore = innovation + technicalComplexity + designUx + impactMarket + presentationDemo;
      const weightedScore = totalScore * Number(judge.weight || 1);
      const finalistNomination = totalScore >= 40 ? 1 : 0;
      const submittedAt = new Date(Date.now() - (judgeIndex * 14 + projectIndex) * 60000).toISOString();
      insert.run({
        judge_id: judge.id,
        project_id: project.id,
        innovation,
        technical: technicalComplexity,
        design: designUx,
        impact: impactMarket,
        presentation: presentationDemo,
        technical_complexity: technicalComplexity,
        design_ux: designUx,
        impact_market: impactMarket,
        presentation_demo: presentationDemo,
        total: totalScore,
        total_score: totalScore,
        weighted_score: weightedScore,
        comments: totalScore >= 40 ? 'Strong finals candidate with clear user need and polished demo.' : 'Solid concept with room to improve depth or clarity.',
        finalist_nomination: finalistNomination,
        tie_breaker_score: project.tie_breaker_score,
        is_draft: 0,
        submitted_at: submittedAt,
        updated_at: submittedAt,
        timestamp: submittedAt,
      });
    });
  });
}

function seedFinalists() {
  const count = db.prepare('SELECT COUNT(*) AS count FROM finalists').get().count;
  if (count > 0) return;

  const finalistProjects = db.prepare('SELECT id FROM projects WHERE is_finalist = 1 ORDER BY tie_breaker_score DESC LIMIT 4').all();
  const insert = db.prepare('INSERT OR IGNORE INTO finalists (project_id, round_name) VALUES (?, ?)');
  finalistProjects.forEach((project) => insert.run(project.id, 'final'));
}

function initDb() {
  ensureSchema();
  seedSettings();
  seedProjects();
  seedParticipants();
  seedJudges();
  seedAssignments();
  seedScores();
  seedFinalists();
}

module.exports = {
  CRITERION_KEYS,
  db,
  initDb,
};
