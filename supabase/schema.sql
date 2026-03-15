create table if not exists projects (
  id bigint generated always as identity primary key,
  name text not null,
  team_name text not null,
  table_number text not null,
  track text not null,
  description text not null default '',
  members_count integer not null default 3,
  demo_url text,
  tie_breaker_score numeric(6,2) not null default 0,
  is_finalist boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists judges (
  id bigint generated always as identity primary key,
  name text not null,
  email text not null,
  judge_code text not null unique,
  role text not null default 'standard',
  weight numeric(5,2) not null default 1.0,
  assigned_track text,
  created_at timestamptz not null default now()
);

create table if not exists scores (
  id bigint generated always as identity primary key,
  judge_id bigint not null references judges(id) on delete cascade,
  project_id bigint not null references projects(id) on delete cascade,
  innovation integer not null,
  technical_complexity integer not null,
  design_ux integer not null,
  impact_market integer not null,
  presentation_demo integer not null,
  total_score numeric(6,2) not null,
  weighted_score numeric(6,2) not null,
  comments text,
  finalist_nomination boolean not null default false,
  tie_breaker_score numeric(6,2) not null default 0,
  is_draft boolean not null default false,
  submitted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (judge_id, project_id)
);

create table if not exists admin_settings (
  id bigint primary key default 1,
  score_scale_min integer not null default 1,
  score_scale_max integer not null default 10,
  use_weighted_criteria boolean not null default true,
  use_judge_weights boolean not null default true,
  outlier_mode text not null default 'average_all',
  comments_enabled boolean not null default true,
  finalist_nomination_enabled boolean not null default true,
  leaderboard_public boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists criteria_weights (
  id bigint generated always as identity primary key,
  criterion_key text not null unique,
  criterion_label text not null,
  weight numeric(6,2) not null
);

create table if not exists judge_assignments (
  id bigint generated always as identity primary key,
  judge_id bigint not null references judges(id) on delete cascade,
  project_id bigint references projects(id) on delete cascade,
  track text,
  created_at timestamptz not null default now()
);

create table if not exists finalists (
  id bigint generated always as identity primary key,
  project_id bigint not null unique references projects(id) on delete cascade,
  round_name text not null default 'final',
  created_at timestamptz not null default now()
);

create index if not exists idx_scores_project_id on scores(project_id);
create index if not exists idx_scores_judge_id on scores(judge_id);
create index if not exists idx_projects_track on projects(track);

insert into admin_settings (id) values (1)
on conflict (id) do nothing;

insert into criteria_weights (criterion_key, criterion_label, weight) values
  ('innovation', 'Innovation', 25),
  ('technical_complexity', 'Technical Complexity', 25),
  ('design_ux', 'Design / UX', 15),
  ('impact_market', 'Impact / Market Potential', 25),
  ('presentation_demo', 'Presentation / Demo Quality', 10)
on conflict (criterion_key) do nothing;
