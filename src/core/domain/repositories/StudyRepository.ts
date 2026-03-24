import { StudyTask, StudyPlan, StudySession, Subject, StudyStats } from '../models/Study';

export interface IStudyRepository {
  // Tasks
  createTask(task: Omit<StudyTask, 'id' | 'created_at' | 'updated_at'>): Promise<StudyTask>;
  updateTask(id: string, data: Partial<StudyTask>): Promise<StudyTask>;
  deleteTask(id: string): Promise<void>;
  getTasksByUserId(userId: string, filters?: TaskFilters): Promise<StudyTask[]>;
  getTaskById(id: string): Promise<StudyTask | null>;

  // Study Plans
  createPlan(plan: Omit<StudyPlan, 'id' | 'created_at' | 'updated_at'>): Promise<StudyPlan>;
  updatePlan(id: string, data: Partial<StudyPlan>): Promise<StudyPlan>;
  deletePlan(id: string): Promise<void>;
  getPlansByUserId(userId: string): Promise<StudyPlan[]>;
  getPlanById(id: string): Promise<StudyPlan | null>;

  // Study Sessions
  createSession(session: Omit<StudySession, 'id' | 'created_at'>): Promise<StudySession>;
  updateSession(id: string, data: Partial<StudySession>): Promise<StudySession>;
  getSessionsByUserId(userId: string, filters?: SessionFilters): Promise<StudySession[]>;
  getSessionById(id: string): Promise<StudySession | null>;
  getSessionStats(userId: string, period?: StatsPeriod): Promise<StudyStats>;

  // Subjects
  createSubject(subject: Omit<Subject, 'id' | 'created_at' | 'updated_at'>): Promise<Subject>;
  updateSubject(id: string, data: Partial<Subject>): Promise<Subject>;
  deleteSubject(id: string): Promise<void>;
  getSubjectsByUserId(userId: string): Promise<Subject[]>;
  updateSubjectStudyTime(id: string, additionalTime: number): Promise<Subject>;
}

export interface TaskFilters {
  status?: StudyTask['status'];
  subject?: string;
  priority?: StudyTask['priority'];
  due_date?: {
    from?: string;
    to?: string;
  };
  tags?: string[];
}

export interface SessionFilters {
  type?: StudySession['type'];
  date_range?: {
    from: string;
    to: string;
  };
  task_id?: string;
  plan_id?: string;
}

export interface StatsPeriod {
  from: string;
  to: string;
}
