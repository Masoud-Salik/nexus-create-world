import { Conversation, Message, AIMemory, ChatAnalytics } from '../models/Chat';

export interface IChatRepository {
  // Conversations
  createConversation(conversation: Omit<Conversation, 'id' | 'created_at' | 'updated_at' | 'message_count'>): Promise<Conversation>;
  updateConversation(id: string, data: Partial<Conversation>): Promise<Conversation>;
  deleteConversation(id: string): Promise<void>;
  getConversationsByUserId(userId: string, limit?: number): Promise<Conversation[]>;
  getConversationById(id: string): Promise<Conversation | null>;
  archiveConversation(id: string): Promise<Conversation>;

  // Messages
  createMessage(message: Omit<Message, 'id' | 'created_at' | 'updated_at'>): Promise<Message>;
  updateMessage(id: string, data: Partial<Message>): Promise<Message>;
  deleteMessage(id: string): Promise<void>;
  getMessagesByConversationId(conversationId: string, limit?: number): Promise<Message[]>;
  getMessageById(id: string): Promise<Message | null>;

  // AI Memory
  setMemory(userId: string, key: string, value: any, category: AIMemory['category'], expiresAt?: string): Promise<AIMemory>;
  getMemory(userId: string, key: string): Promise<AIMemory | null>;
  getAllMemories(userId: string, category?: AIMemory['category']): Promise<AIMemory[]>;
  deleteMemory(userId: string, key: string): Promise<void>;
  clearExpiredMemories(): Promise<void>;

  // Analytics
  getChatAnalytics(userId: string, period?: AnalyticsPeriod): Promise<ChatAnalytics>;
}

export interface AnalyticsPeriod {
  from: string;
  to: string;
}
