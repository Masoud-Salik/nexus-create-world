export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  preferences: UserPreferences;
  subscription_tier: 'free' | 'premium';
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: NotificationPreferences;
  study_settings: StudySettings;
  privacy: PrivacySettings;
}

export interface NotificationPreferences {
  study_reminders: boolean;
  achievement_alerts: boolean;
  chat_responses: boolean;
  daily_summary: boolean;
}

export interface StudySettings {
  default_pomodoro_duration: number; // minutes
  default_break_duration: number; // minutes
  auto_start_breaks: boolean;
  sound_enabled: boolean;
  vibration_enabled: boolean;
}

export interface PrivacySettings {
  data_analytics: boolean;
  crash_reporting: boolean;
  usage_tracking: boolean;
}
