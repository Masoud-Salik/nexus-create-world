import { User } from '../models/User';

export interface IUserRepository {
  // Core user operations
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User>;
  delete(id: string): Promise<void>;

  // Preferences
  updatePreferences(id: string, preferences: Partial<User['preferences']>): Promise<User>;
  
  // Subscription management
  updateSubscriptionTier(id: string, tier: User['subscription_tier']): Promise<User>;
  
  // Profile management
  updateProfile(id: string, data: { name?: string; avatar_url?: string }): Promise<User>;
}
