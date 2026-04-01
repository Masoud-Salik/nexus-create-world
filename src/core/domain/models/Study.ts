export interface StudyTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  subject: string;
  difficulty: 'easy' | 'medium' | 'hard';
  estimated_duration: number; // minutes
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  tags: string[];
  due_date?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface StudyPlan {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  tasks: StudyTask[];
  status: 'active' | 'completed' | 'paused';
  progress: number; // 0-100
  created_at: string;
  updated_at: string;
}

export interface StudySession {
  id: string;
  user_id: string;
  task_id?: string;
  plan_id?: string;
  type: 'pomodoro' | 'regular' | 'break';
  duration: number; // seconds
  actual_duration: number; // seconds
  start_time: string;
  end_time?: string;
  interruptions: number;
  quality_rating?: 1 | 2 | 3 | 4 | 5;
  notes?: string;
  created_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon?: string;
  total_study_time: number; // seconds
  task_count: number;
  created_at: string;
  updated_at: string;
}

export interface StudyStats {
  total_study_time: number; // seconds
  sessions_completed: number;
  average_session_duration: number; // seconds
  streak_days: number;
  weekly_goal: number; // hours
  weekly_progress: number; // hours
  subject_breakdown: SubjectStats[];
  productivity_score: number; // 0-100
}

export interface SubjectStats {
  subject: string;
  time_spent: number; // seconds
  sessions_count: number;
  completion_rate: number; // 0-100
}
