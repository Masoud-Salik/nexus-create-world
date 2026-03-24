export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  is_archived: boolean;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: MessageMetadata;
  created_at: string;
  updated_at: string;
}

export interface MessageMetadata {
  model?: string;
  tokens_used?: number;
  response_time?: number; // milliseconds
  user_rating?: 1 | 2 | 3 | 4 | 5;
  feedback?: string;
  context?: {
    study_plan_id?: string;
    current_task_id?: string;
    user_preferences?: any;
  };
}

export interface ChatSession {
  id: string;
  conversation_id: string;
  started_at: string;
  ended_at?: string;
  message_count: number;
  total_tokens: number;
  user_satisfaction?: number;
}

export interface AIMemory {
  id: string;
  user_id: string;
  key: string;
  value: any;
  category: 'preference' | 'context' | 'history' | 'goal';
  expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatAnalytics {
  total_conversations: number;
  total_messages: number;
  average_messages_per_conversation: number;
  most_discussed_topics: TopicAnalysis[];
  user_satisfaction_average: number;
  response_time_average: number; // milliseconds
}

export interface TopicAnalysis {
  topic: string;
  frequency: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}
