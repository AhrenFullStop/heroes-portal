// Shared types between server and web

export type Role = 'admin' | 'alumnus';

export interface User {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  impersonating?: boolean;
}

export interface PersonaState {
  persona: string;
  is_custom: boolean;
  updated_at: string | null;
  default: string;
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: string;
  saved_amount: string;
  done: boolean;
  created_at: string;
}

export interface DirectMessage {
  id: number;
  from_user: number;
  to_user: number;
  content: string;
  read_at: string | null;
  created_at: string;
}

export interface DmConversation {
  user_id: number;
  display_name: string;
  username: string;
  last_message: string | null;
  last_at: string | null;
  unread: number;
}

// ---- Chat action protocol ----

export type ChatAction =
  | { type: 'log_checkin'; mood: string; note?: string }
  | { type: 'create_goal'; title: string; steps?: string[] }
  | { type: 'complete_step'; step_id: number }
  | { type: 'add_step'; goal_id: number; label: string }
  | { type: 'add_commitment'; text: string; due_date?: string }
  | { type: 'money_checkin'; income: number; expenses: Record<string, number> }
  | { type: 'log_workout'; workout_id?: number; note?: string }
  | { type: 'create_savings_goal'; name: string; target_amount: number }
  | { type: 'escalate_coach'; reason: string }
  | { type: 'celebrate_streak'; days: number }
  | { type: 'challenge_user'; challenge: string }
  | { type: 'community_pulse'; note: string };

export interface ChatTurn {
  reply: string;
  actions: ChatAction[];
}

// ---- API payload shapes ----

export interface ChatMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  action_labels?: string[];
}

export interface GoalStep {
  id: number;
  goal_id: number;
  label: string;
  done: boolean;
  position: number;
}

export interface Goal {
  id: number;
  title: string;
  status: 'active' | 'done' | 'archived';
  created_at: string;
  done_at: string | null;
  steps: GoalStep[];
}

export interface Commitment {
  id: number;
  text: string;
  due_date: string | null;
  status: 'open' | 'kept' | 'missed';
  created_at: string;
}

export interface Checkin {
  checkin_date: string;
  mood: string | null;
  note: string | null;
  source: string;
}

export interface StreakInfo {
  streak: number;
  today_done: boolean;
  history: Checkin[];
}

export interface MoneySnapshot {
  id: number;
  month_year: string;
  income: string;
  expenses: Record<string, number>;
  ai_summary: string | null;
  created_at: string;
}

export interface CirclePost {
  id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
  comments: CircleComment[];
}

export interface CircleComment {
  id: number;
  post_id: number;
  user_id: number;
  author_name: string;
  content: string;
  created_at: string;
}

export interface CoachMessage {
  id: number;
  direction: 'to_coach' | 'from_coach';
  content: string;
  created_at: string;
  resolved: boolean;
}

export interface CoachThread {
  user_id: number;
  display_name: string;
  username: string;
  unresolved: number;
  messages: CoachMessage[];
}

export interface Workout {
  id: number;
  title: string;
  description: string;
  level: 'home' | 'gym';
  duration_min: number;
}

export interface WorkoutLog {
  id: number;
  workout_id: number | null;
  note: string | null;
  done_on: string;
}

export interface Opportunity {
  id: number;
  title: string;
  org: string;
  kind: 'job' | 'learnership' | 'bursary' | 'training';
  location: string | null;
  apply_url: string | null;
  description: string | null;
  closes_on: string | null;
  active: boolean;
  image_url: string | null;
}

export interface AdminUser {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  created_at: string;
}

// Voice
export interface VoiceTranscribeResponse {
  transcript: string;
}

// Admin overview
export interface MemberOverview {
  user_id: number;
  username: string;
  display_name: string;
  streak: number;
  last_checkin_date: string | null;
  mood_trend: { date: string; mood: string | null }[];
  risk_flag: 'none' | 'low_engagement' | 'mood_decline' | 'coach_open';
  active_goals: number;
  steps_done_7d: number;
  open_coach_messages: number;
  last_active_date: string | null;
}

export interface AdminOverviewResponse {
  members: MemberOverview[];
  generated_at: string;
}
