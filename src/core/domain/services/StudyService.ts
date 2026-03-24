import { StudyTask, StudyPlan, StudySession } from '../models/Study';
import { IStudyRepository } from '../repositories/StudyRepository';

export class StudyService {
  constructor(private studyRepository: IStudyRepository) {}

  // Task management
  async createTask(taskData: Omit<StudyTask, 'id' | 'created_at' | 'updated_at'>): Promise<StudyTask> {
    // Validate business rules
    if (taskData.estimated_duration <= 0) {
      throw new Error('Task duration must be positive');
    }

    if (taskData.due_date && new Date(taskData.due_date) < new Date()) {
      throw new Error('Due date cannot be in the past');
    }

    return this.studyRepository.createTask(taskData);
  }

  async updateTaskStatus(taskId: string, status: StudyTask['status']): Promise<StudyTask> {
    const task = await this.studyRepository.getTaskById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Business logic for status transitions
    if (task.status === 'completed' && status !== 'completed') {
      throw new Error('Cannot reopen completed task');
    }

    const updateData: Partial<StudyTask> = { status };
    
    if (status === 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    return this.studyRepository.updateTask(taskId, updateData);
  }

  async getTodaysTasks(userId: string): Promise<StudyTask[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.studyRepository.getTasksByUserId(userId, {
      due_date: {
        from: today.toISOString(),
        to: tomorrow.toISOString()
      }
    });
  }

  // Study plan management
  async generateStudyPlan(userId: string, preferences: StudyPlanPreferences): Promise<StudyPlan> {
    // Business logic for generating optimal study plans
    const tasks = await this.generateOptimalTasks(preferences);
    
    const planData: Omit<StudyPlan, 'id' | 'created_at' | 'updated_at'> = {
      user_id: userId,
      title: preferences.title,
      description: preferences.description,
      duration_days: preferences.duration_days,
      start_date: preferences.start_date,
      end_date: preferences.end_date,
      tasks,
      status: 'active',
      progress: 0
    };

    return this.studyRepository.createPlan(planData);
  }

  async updatePlanProgress(planId: string): Promise<StudyPlan> {
    const plan = await this.studyRepository.getPlanById(planId);
    if (!plan) {
      throw new Error('Study plan not found');
    }

    const completedTasks = plan.tasks.filter(task => task.status === 'completed').length;
    const progress = Math.round((completedTasks / plan.tasks.length) * 100);

    const updatedPlan = await this.studyRepository.updatePlan(planId, { progress });

    // Auto-complete plan if all tasks are done
    if (progress === 100 && plan.status === 'active') {
      return this.studyRepository.updatePlan(planId, { status: 'completed' });
    }

    return updatedPlan;
  }

  // Study session management
  async startStudySession(sessionData: Omit<StudySession, 'id' | 'created_at'>): Promise<StudySession> {
    // Validate session start
    if (sessionData.duration <= 0) {
      throw new Error('Session duration must be positive');
    }

    return this.studyRepository.createSession(sessionData);
  }

  async completeStudySession(sessionId: string, actualDuration: number, qualityRating?: 1 | 2 | 3 | 4 | 5): Promise<StudySession> {
    const session = await this.studyRepository.getSessionById ? 
      this.studyRepository.getSessionsByUserId('', {}).then(sessions => 
        sessions.find(s => s.id === sessionId)
      ) : null;

    if (!session) {
      throw new Error('Study session not found');
    }

    return this.studyRepository.updateSession(sessionId, {
      actual_duration: actualDuration,
      end_time: new Date().toISOString(),
      quality_rating: qualityRating
    });
  }

  // Analytics and insights
  async getStudyInsights(userId: string): Promise<StudyInsights> {
    const stats = await this.studyRepository.getSessionStats(userId);
    const tasks = await this.studyRepository.getTasksByUserId(userId);
    
    return {
      productivity_score: stats.productivity_score,
      streak_days: stats.streak_days,
      completion_rate: this.calculateCompletionRate(tasks),
      average_session_duration: stats.average_session_duration,
      most_productive_time: await this.findMostProductiveTime(userId),
      improvement_suggestions: this.generateImprovementSuggestions(stats, tasks)
    };
  }

  private async generateOptimalTasks(preferences: StudyPlanPreferences): Promise<StudyTask[]> {
    // Complex algorithm for generating optimal study tasks
    // This would consider user's past performance, difficulty progression, etc.
    const tasks: StudyTask[] = [];
    
    for (const subject of preferences.subjects) {
      for (let i = 0; i < subject.tasks_per_week; i++) {
        tasks.push({
          id: '', // Will be generated by repository
          user_id: preferences.user_id,
          title: `${subject.name} Study Session ${i + 1}`,
          subject: subject.name,
          difficulty: this.calculateOptimalDifficulty(subject.name, preferences.user_id),
          estimated_duration: subject.session_duration,
          priority: subject.priority,
          status: 'pending',
          tags: [subject.name],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
    }

    return tasks;
  }

  private calculateOptimalDifficulty(subject: string, userId: string): StudyTask['difficulty'] {
    // Logic to determine optimal difficulty based on user's past performance
    return 'medium'; // Placeholder
  }

  private calculateCompletionRate(tasks: StudyTask[]): number {
    if (tasks.length === 0) return 0;
    const completed = tasks.filter(task => task.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  }

  private async findMostProductiveTime(userId: string): Promise<string> {
    // Analyze past sessions to find most productive time
    return '09:00-11:00'; // Placeholder
  }

  private generateImprovementSuggestions(stats: any, tasks: any[]): string[] {
    const suggestions: string[] = [];
    
    if (stats.productivity_score < 70) {
      suggestions.push('Consider shorter, more frequent study sessions');
    }
    
    if (stats.streak_days < 3) {
      suggestions.push('Try to maintain a consistent daily study routine');
    }
    
    return suggestions;
  }
}

export interface StudyPlanPreferences {
  user_id: string;
  title: string;
  description?: string;
  duration_days: number;
  start_date: string;
  end_date: string;
  subjects: StudySubject[];
  daily_hours: number;
  difficulty_preference: 'easy' | 'medium' | 'hard';
}

export interface StudySubject {
  name: string;
  priority: 'low' | 'medium' | 'high';
  sessions_per_week: number;
  session_duration: number; // minutes
  tasks_per_week?: number;
}

export interface StudyInsights {
  productivity_score: number;
  streak_days: number;
  completion_rate: number;
  average_session_duration: number;
  most_productive_time: string;
  improvement_suggestions: string[];
}
