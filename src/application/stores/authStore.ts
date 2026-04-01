import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { User } from '@/core/domain/models/User';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  
  // Actions
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateUserPreferences: (preferences: Partial<User['preferences']>) => void;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: null,

        setUser: (user) => {
          set({ 
            user, 
            isAuthenticated: !!user, 
            error: null 
          });
        },

        setLoading: (isLoading) => {
          set({ isLoading });
        },

        setError: (error) => {
          set({ error, isLoading: false });
        },

        updateUserPreferences: (preferences) => {
          const { user } = get();
          if (!user) return;

          const updatedUser = {
            ...user,
            preferences: {
              ...user.preferences,
              ...preferences
            }
          };

          set({ user: updatedUser });
        },

        logout: () => {
          set({ 
            user: null, 
            isAuthenticated: false, 
            error: null 
          });
        },

        clearError: () => {
          set({ error: null });
        }
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          isAuthenticated: state.isAuthenticated
        })
      }
    ),
    { name: 'auth-store' }
  )
);
