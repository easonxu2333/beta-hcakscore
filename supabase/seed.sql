insert into judges (name, email, judge_code, role, weight, assigned_track) values
  ('Dr. Sarah Chen', 'sarah.chen@university.edu', 'JUDGE-AI-01', 'expert', 1.2, 'AI'),
  ('Marcus Patel', 'marcus.patel@hospital.org', 'JUDGE-HLTH-02', 'expert', 1.2, 'HealthTech'),
  ('Avery Brooks', 'avery@web3fund.com', 'JUDGE-WEB3-03', 'sponsor', 0.8, 'Web3'),
  ('Naomi Rivera', 'naomi@finlab.io', 'JUDGE-FIN-04', 'standard', 1.0, 'FinTech'),
  ('Priya Desai', 'priya@startupstudio.com', 'JUDGE-OPEN-05', 'standard', 1.0, 'Open Innovation'),
  ('Leo Martinez', 'leo@designcollective.co', 'JUDGE-FLOAT-06', 'expert', 1.1, null);

insert into projects (name, team_name, table_number, track, description, members_count, demo_url, tie_breaker_score, is_finalist) values
  ('AI Legal Copilot', 'LexLoop', 'A01', 'AI', 'Copilot for university legal aid clinics and contract review.', 4, 'https://demo.example.com/ai-legal-copilot', 8.7, true),
  ('MediScan', 'PulseStack', 'A02', 'HealthTech', 'Smartphone-based triage assistant for campus clinics.', 5, 'https://demo.example.com/mediscan', 8.4, true),
  ('ChainCred', 'BlockBloom', 'A03', 'Web3', 'Portable credential wallet for hackathon and campus achievements.', 3, 'https://demo.example.com/chaincred', 8.1, false),
  ('CampusBudget AI', 'DormOps', 'A04', 'FinTech', 'Budget planner and aid coach tuned for student spending.', 4, 'https://demo.example.com/campusbudget-ai', 8.0, true),
  ('NeuroNest', 'Synapse House', 'A05', 'HealthTech', 'Neurodivergent-friendly focus environment with adaptive prompts.', 4, 'https://demo.example.com/neuronest', 7.9, false),
  ('GreenRoute', 'EcoMotion', 'B01', 'Open Innovation', 'Carbon-aware routing engine for shared campus mobility.', 4, 'https://demo.example.com/greenroute', 7.8, false),
  ('PitchPilot', 'Launchpad Crew', 'B02', 'AI', 'Real-time pitch coach for founders during demo day.', 3, 'https://demo.example.com/pitchpilot', 7.6, true),
  ('StudyFlow', 'StudyVerse', 'B03', 'Open Innovation', 'AI planner for project work, office hours, and team sprints.', 5, 'https://demo.example.com/studyflow', 7.5, false),
  ('LedgerLeaf', 'Money Commons', 'B04', 'FinTech', 'Transparent micro-grant disbursement and tracking for student orgs.', 4, 'https://demo.example.com/ledgerleaf', 7.4, false),
  ('VitalPatch', 'CareLayer', 'B05', 'HealthTech', 'Wearable patch analytics for early stress and fatigue detection.', 4, 'https://demo.example.com/vitalpatch', 8.2, true),
  ('OpenTable Ops', 'QueueCraft', 'C01', 'Open Innovation', 'Live event floor ops dashboard for booths, judges, and traffic.', 3, 'https://demo.example.com/opentable-ops', 7.7, false),
  ('ProofMesh', 'Trustless Labs', 'C02', 'Web3', 'Proof-of-attendance and bounty attribution network for hackathons.', 4, 'https://demo.example.com/proofmesh', 7.3, false);
