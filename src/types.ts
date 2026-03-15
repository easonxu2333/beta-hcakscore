export interface Judge {
  id: number;
  judge_code: string;
  name: string;
  email: string;
  role: 'standard' | 'sponsor' | 'expert' | string;
  weight: number;
  assigned_track: string | null;
  created_at?: string;
}

export interface Project {
  id: number;
  participant_id?: number | null;
  name: string;
  team_name: string;
  table_number: string;
  track: string;
  description: string;
  short_description?: string;
  full_description?: string;
  members_count: number;
  demo_url?: string | null;
  github_url?: string | null;
  pitch_deck_url?: string | null;
  video_url?: string | null;
  contact_email?: string | null;
  school_name?: string | null;
  team_member_names?: string[];
  special_prize_categories?: string[];
  submission_status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  approval_status?: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  published?: boolean;
  consent_accepted?: boolean;
  submission_deadline_locked?: boolean;
  updated_at?: string;
  tie_breaker_score: number;
  is_finalist: boolean;
  created_at?: string;
  status?: 'unscored' | 'draft' | 'scored';
  my_score?: Score | null;
}

export interface Score {
  id: number;
  judge_id: number;
  project_id: number;
  judge_code?: string;
  judge_name?: string;
  judge_role?: string;
  judge_weight?: number;
  project_name?: string;
  team_name?: string;
  track?: string;
  innovation: number;
  technical_complexity: number;
  design_ux: number;
  impact_market: number;
  presentation_demo: number;
  total_score: number;
  weighted_score: number;
  comments: string;
  finalist_nomination: boolean;
  tie_breaker_score: number;
  is_draft: boolean;
  submitted_at?: string | null;
  updated_at?: string;
}

export interface CriterionWeight {
  id?: number;
  criterion_key: string;
  criterion_label: string;
  weight: number;
}

export interface AdminSettings {
  score_scale_min: number;
  score_scale_max: number;
  use_weighted_criteria: boolean;
  use_judge_weights: boolean;
  outlier_mode: 'average_all' | 'drop_high_low' | 'median' | 'weighted_average';
  comments_enabled: boolean;
  finalist_nomination_enabled: boolean;
  leaderboard_public: boolean;
  updated_at?: string;
  criteria_weights: CriterionWeight[];
}

export interface LeaderboardEntry {
  id: number;
  rank: number;
  name: string;
  team_name: string;
  table_number: string;
  track: string;
  description: string;
  average_score: number | null;
  average_total_score: number | null;
  average_weighted_score: number | null;
  submission_count: number;
  finalist_nomination_count: number;
  finalist: boolean;
  criterion_averages: Record<string, number | null>;
  tie_breaker_score: number;
}

export interface LeaderboardPayload {
  settings: AdminSettings;
  leaderboard: LeaderboardEntry[];
  winners: {
    overall: LeaderboardEntry | null;
    byTrack: Record<string, LeaderboardEntry>;
    bestDesign: LeaderboardEntry | null;
    bestTechnical: LeaderboardEntry | null;
    audienceFavorite: LeaderboardEntry | null;
  };
  tracks: string[];
}

export interface JudgeProgress extends Judge {
  assigned_total: number;
  scores_submitted: number;
  completion_rate: number;
}

export interface MissingScore {
  judge_code: string;
  judge_name: string;
  project_id: number;
  project_name: string;
  track: string;
  table_number: string;
}

export interface AdminOverview {
  stats: {
    totalProjects: number;
    totalJudges: number;
    totalScores: number;
    draftScores: number;
    completionRate: number;
    missingScores: number;
    finalistsCount: number;
    pendingSubmissions: number;
    approvedSubmissions: number;
  };
  judges: JudgeProgress[];
  participants: Participant[];
  projects: Project[];
  scores: Score[];
  settings: AdminSettings;
  leaderboard: LeaderboardEntry[];
  winners: LeaderboardPayload['winners'];
  missingScores: MissingScore[];
  tracks: string[];
}

export interface ScoreForm {
  innovation: number;
  technical_complexity: number;
  design_ux: number;
  impact_market: number;
  presentation_demo: number;
  comments: string;
  finalist_nomination: boolean;
  tie_breaker_score: number;
}

export interface Participant {
  id: number;
  user_id: number;
  team_name: string;
  contact_email: string;
  school_name?: string | null;
  created_at?: string;
  name: string;
  email: string;
  status: string;
  password_hash?: string;
}

export interface ParticipantProjectForm {
  projectName: string;
  teamName: string;
  teamMembers: string[];
  schoolName: string;
  contactEmail: string;
  track: string;
  shortDescription: string;
  fullDescription: string;
  githubUrl: string;
  demoUrl: string;
  pitchDeckUrl: string;
  videoUrl: string;
  tableNumber: string;
  specialPrizeCategories: string[];
  consentAccepted: boolean;
  submissionStatus: 'draft' | 'submitted';
}
