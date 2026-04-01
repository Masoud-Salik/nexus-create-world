import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { StudyTask, StudyPlan, StudySession, Subject, StudyStats } from '@/core/domain/models/Study';

interface StudyState {
  // Tasks
  tasks: StudyTask[];
  currentTask: StudyTask | null;
  isLoadingTasks: boolean;
  
  // Study Plans
  plans: StudyPlan[];
  currentPlan: StudyPlan | null;
  isLoadingPlans: boolean;
  
  // Sessions
  sessions: StudySession[];
  currentSession: StudySession | null;
  sessionStats: StudyStats | null;
  
  // Subjects
  subjects: Subject[];
  
  // Timer state
  timerState: {
    isRunning: boolean;
    isPaused: boolean;
    duration: number;
    remainingTime: number;
    type: 'pomodoro' | 'break' | 'regular';
  };
  
  // Actions
  setTasks: (tasks: StudyTask[]) => void;
  setCurrentTask: (task: StudyTask | null) => void;
  addTask: (task: StudyTask) => void;
  updateTask: (taskId: string, updates: Partial<StudyTask>) => void;
  deleteTask: (taskId: string) => void;
  
  setPlans: (plans: StudyPlan[]) => void;
  setCurrentPlan: (plan: StudyPlan | null) => void;
  addPlan: (plan: StudyPlan) => void;
  updatePlan: (planId: string, updates: Partial<StudyPlan>) => void;
  deletePlan: (planId: string) => void;
  
  setSessions: (sessions: StudySession[]) => void;
  setCurrentSession: (session: StudySession | null) => void;
  addSession: (session: StudySession) => void;
  updateSession: (sessionId: string, updates: Partial<StudySession>) => void;
  
  setSubjects: (subjects: Subject[]) => void;
  addSubject: (subject: Subject) => void;
  updateSubject: (subjectId: string, updates: Partial<Subject>) => void;
  
  setTimerState: (timerState: Partial<StudyState['timerState']>) => void;
  startTimer: (duration: number, type: StudyState['timerState']['type']) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  resetTimer: () => void;
  
  // Loading states
  setLoadingTasks: (loading: boolean) => void;
  setLoadingPlans: (loading: boolean) => void;
  
  // Utility actions
  clearStudyData: () => void;
}

export const useStudyStore = create<StudyState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        tasks: [],
        currentTask: null,
        isLoadingTasks: false,
        
        plans: [],
        currentPlan: null,
        isLoadingPlans: false,
        
        sessions: [],
        currentSession: null,
        sessionStats: null,
        
        subjects: [],
        
        timerState: {
          isRunning: false,
          isPaused: false,
          duration: 0,
          remainingTime: 0,
          type: 'regular'
        },
        
        // Task actions
        setTasks: (tasks) => set({ tasks }),
        
        setCurrentTask: (task) => set({ currentTask: task }),
        
        addTask: (task) => set((state) => ({
          tasks: [...state.tasks, task]
        })),
        
        updateTask: (taskId, updates) => set((state) => ({
          tasks: state.tasks.map(task => 
            task.id === taskId ? { ...task, ...updates } : task
          ),
          currentTask: state.currentTask?.id === taskId 
            ? { ...state.currentTask, ...updates } 
            : state.currentTask
        })),
        
        deleteTask: (taskId) => set((state) => ({
          tasks: state.tasks.filter(task => task.id !== taskId),
          currentTask: state.currentTask?.id === taskId ? null : state.currentTask
        })),
        
        // Plan actions
        setPlans: (plans) => set({ plans }),
        
        setCurrentPlan: (plan) => set({ currentPlan: plan }),
        
        addPlan: (plan) => set((state) => ({
          plans: [...state.plans, plan]
        })),
        
        updatePlan: (planId, updates) => set((state) => ({
          plans: state.plans.map(plan => 
            plan.id === planId ? { ...plan, ...updates } : plan
          ),
          currentPlan: state.currentPlan?.id === planId 
            ? { ...state.currentPlan, ...updates } 
            : state.currentPlan
        })),
        
        deletePlan: (planId) => set((state) => ({
          plans: state.plans.filter(plan => plan.id !== planId),
          currentPlan: state.currentPlan?.id === planId ? null : state.currentPlan
        })),
        
        // Session actions
        setSessions: (sessions) => set({ sessions }),
        
        setCurrentSession: (session) => set({ currentSession: session }),
        
        addSession: (session) => set((state) => ({
          sessions: [...state.sessions, session]
        })),
        
        updateSession: (sessionId, updates) => set((state) => ({
          sessions: state.sessions.map(session => 
            session.id === sessionId ? { ...session, ...updates } : session
          ),
          currentSession: state.currentSession?.id === sessionId 
            ? { ...state.currentSession, ...updates } 
            : state.currentSession
        })),
        
        // Subject actions
        setSubjects: (subjects) => set({ subjects }),
        
        addSubject: (subject) => set((state) => ({
          subjects: [...state.subjects, subject]
        })),
        
        updateSubject: (subjectId, updates) => set((state) => ({
          subjects: state.subjects.map(subject => 
            subject.id === subjectId ? { ...subject, ...updates } : subject
          )
        })),
        
        // Timer actions
        setTimerState: (timerState) => set((state) => ({
          timerState: { ...state.timerState, ...timerState }
        })),
        
        startTimer: (duration, type) => set({
          timerState: {
            isRunning: true,
            isPaused: false,
            duration,
            remainingTime: duration,
            type
          }
        }),
        
        pauseTimer: () => set((state) => ({
          timerState: { ...state.timerState, isPaused: true }
        })),
        
        resumeTimer: () => set((state) => ({
          timerState: { ...state.timerState, isPaused: false }
        })),
        
        stopTimer: () => set((state) => ({
          timerState: { ...state.timerState, isRunning: false, isPaused: false }
        })),
        
        resetTimer: () => set({
          timerState: {
            isRunning: false,
            isPaused: false,
            duration: 0,
            remainingTime: 0,
            type: 'regular'
          }
        }),
        
        // Loading actions
        setLoadingTasks: (loading) => set({ isLoadingTasks: loading }),
        setLoadingPlans: (loading) => set({ isLoadingPlans: loading }),
        
        // Utility actions
        clearStudyData: () => set({
          tasks: [],
          currentTask: null,
          plans: [],
          currentPlan: null,
          sessions: [],
          currentSession: null,
          subjects: [],
          timerState: {
            isRunning: false,
            isPaused: false,
            duration: 0,
            remainingTime: 0,
            type: 'regular'
          }
        })
      }),
      {
        name: 'study-storage',
        partialize: (state) => ({
          tasks: state.tasks,
          currentTask: state.currentTask,
          plans: state.plans,
          currentPlan: state.currentPlan,
          subjects: state.subjects,
          timerState: state.timerState
        })
      }
    ),
    { name: 'study-store' }
  )
);
