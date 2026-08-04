export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      abilities_skills: {
        Row: {
          created_at: string | null
          id: string
          languages: string[] | null
          soft_skills: string[] | null
          strengths: string[] | null
          technical_skills: string[] | null
          updated_at: string | null
          user_id: string
          weaknesses: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          languages?: string[] | null
          soft_skills?: string[] | null
          strengths?: string[] | null
          technical_skills?: string[] | null
          updated_at?: string | null
          user_id: string
          weaknesses?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          languages?: string[] | null
          soft_skills?: string[] | null
          strengths?: string[] | null
          technical_skills?: string[] | null
          updated_at?: string | null
          user_id?: string
          weaknesses?: string[] | null
        }
        Relationships: []
      }
      account_exports: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          file_path: string | null
          id: string
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          file_path?: string | null
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_access_log: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          subject_id: string | null
          subject_type: string
          trace_id: string | null
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          subject_id?: string | null
          subject_type: string
          trace_id?: string | null
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          subject_id?: string | null
          subject_type?: string
          trace_id?: string | null
        }
        Relationships: []
      }
      ai_calls: {
        Row: {
          cache_hit: boolean
          cost_usd: number
          created_at: string
          id: string
          latency_ms: number
          model: string
          owner_id: string | null
          prompt_version: string | null
          provider: string
          schema_retries: number
          status: string
          task: string
          tokens_input: number
          tokens_output: number
          trace_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          cost_usd?: number
          created_at?: string
          id?: string
          latency_ms?: number
          model: string
          owner_id?: string | null
          prompt_version?: string | null
          provider?: string
          schema_retries?: number
          status?: string
          task: string
          tokens_input?: number
          tokens_output?: number
          trace_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          cost_usd?: number
          created_at?: string
          id?: string
          latency_ms?: number
          model?: string
          owner_id?: string | null
          prompt_version?: string | null
          provider?: string
          schema_retries?: number
          status?: string
          task?: string
          tokens_input?: number
          tokens_output?: number
          trace_id?: string | null
        }
        Relationships: []
      }
      ai_knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          doc_id: string
          embedding: string | null
          id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          doc_id: string
          embedding?: string | null
          id?: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          doc_id?: string
          embedding?: string | null
          id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_chunks_doc_id_fkey"
            columns: ["doc_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_docs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_docs: {
        Row: {
          chunk_count: number
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          source_type: string
          source_url: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          chunk_count?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          source_type?: string
          source_url?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          chunk_count?: number
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_memory: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          sentiment: string | null
          source_message_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          sentiment?: string | null
          source_message_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          sentiment?: string | null
          source_message_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_message_feedback: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          message_id: string | null
          note: string | null
          rating: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          note?: string | null
          rating: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          note?: string | null
          rating?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_message_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_message_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_prompt_versions: {
        Row: {
          created_at: string
          created_by: string | null
          few_shots: Json
          id: string
          is_active: boolean
          max_tokens: number
          name: string
          persona: string | null
          system_prompt: string
          task: string | null
          temperature: number
          tool_aggressiveness: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          few_shots?: Json
          id?: string
          is_active?: boolean
          max_tokens?: number
          name: string
          persona?: string | null
          system_prompt: string
          task?: string | null
          temperature?: number
          tool_aggressiveness?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          few_shots?: Json
          id?: string
          is_active?: boolean
          max_tokens?: number
          name?: string
          persona?: string | null
          system_prompt?: string
          task?: string | null
          temperature?: number
          tool_aggressiveness?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_training_examples: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          ideal_response: string
          source_message_id: string | null
          tags: string[]
          user_input: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          ideal_response: string
          source_message_id?: string | null
          tags?: string[]
          user_input: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          ideal_response?: string
          source_message_id?: string | null
          tags?: string[]
          user_input?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_training_examples_source_message_id_fkey"
            columns: ["source_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      anon_sessions: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          created_ip: string | null
          expires_at: string
          id: string
          token_hash: string
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_ip?: string | null
          expires_at?: string
          id?: string
          token_hash: string
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          created_ip?: string | null
          expires_at?: string
          id?: string
          token_hash?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          is_pinned: boolean
          local_time: string | null
          summary: string | null
          time_of_day: string | null
          title: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_pinned?: boolean
          local_time?: string | null
          summary?: string | null
          time_of_day?: string | null
          title?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_pinned?: boolean
          local_time?: string | null
          summary?: string | null
          time_of_day?: string | null
          title?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_activities: {
        Row: {
          activities: Json
          activity_date: string
          created_at: string | null
          id: string
          local_time: string | null
          mood: string | null
          notes: string | null
          time_of_day: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          activities?: Json
          activity_date?: string
          created_at?: string | null
          id?: string
          local_time?: string | null
          mood?: string | null
          notes?: string | null
          time_of_day?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          activities?: Json
          activity_date?: string
          created_at?: string | null
          id?: string
          local_time?: string | null
          mood?: string | null
          notes?: string | null
          time_of_day?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          creativity_minutes: number | null
          energy_score: number | null
          focused_sessions: number | null
          id: string
          money_spent: number | null
          mood_score: number | null
          notes: string | null
          screen_time_minutes: number | null
          sleep_hours: number | null
          sleep_time: string | null
          social_activity: boolean | null
          social_minutes: number | null
          social_mood_change: number | null
          social_type: string | null
          spending_category: string | null
          spending_planned: boolean | null
          steps: number | null
          stress_score: number | null
          study_minutes: number | null
          updated_at: string
          user_id: string
          wake_time: string | null
          workout_minutes: number | null
        }
        Insert: {
          checkin_date?: string
          created_at?: string
          creativity_minutes?: number | null
          energy_score?: number | null
          focused_sessions?: number | null
          id?: string
          money_spent?: number | null
          mood_score?: number | null
          notes?: string | null
          screen_time_minutes?: number | null
          sleep_hours?: number | null
          sleep_time?: string | null
          social_activity?: boolean | null
          social_minutes?: number | null
          social_mood_change?: number | null
          social_type?: string | null
          spending_category?: string | null
          spending_planned?: boolean | null
          steps?: number | null
          stress_score?: number | null
          study_minutes?: number | null
          updated_at?: string
          user_id: string
          wake_time?: string | null
          workout_minutes?: number | null
        }
        Update: {
          checkin_date?: string
          created_at?: string
          creativity_minutes?: number | null
          energy_score?: number | null
          focused_sessions?: number | null
          id?: string
          money_spent?: number | null
          mood_score?: number | null
          notes?: string | null
          screen_time_minutes?: number | null
          sleep_hours?: number | null
          sleep_time?: string | null
          social_activity?: boolean | null
          social_minutes?: number | null
          social_mood_change?: number | null
          social_type?: string | null
          spending_category?: string | null
          spending_planned?: boolean | null
          steps?: number | null
          stress_score?: number | null
          study_minutes?: number | null
          updated_at?: string
          user_id?: string
          wake_time?: string | null
          workout_minutes?: number | null
        }
        Relationships: []
      }
      daily_coach_messages: {
        Row: {
          created_at: string
          id: string
          message_date: string
          motivation_level: string | null
          priority_focus: string
          user_id: string
          warning_message: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_date?: string
          motivation_level?: string | null
          priority_focus: string
          user_id: string
          warning_message?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_date?: string
          motivation_level?: string | null
          priority_focus?: string
          user_id?: string
          warning_message?: string | null
        }
        Relationships: []
      }
      document_chunks: {
        Row: {
          char_end: number
          char_start: number
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string | null
          id: string
          model_version: string | null
          page_no: number | null
          token_count: number
          user_id: string
        }
        Insert: {
          char_end?: number
          char_start?: number
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding?: string | null
          id?: string
          model_version?: string | null
          page_no?: number | null
          token_count?: number
          user_id: string
        }
        Update: {
          char_end?: number
          char_start?: number
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string | null
          id?: string
          model_version?: string | null
          page_no?: number | null
          token_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_pages: {
        Row: {
          created_at: string
          document_id: string
          has_text_layer: boolean
          id: string
          needs_ocr: boolean
          ocr_confidence: number | null
          page_no: number
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          has_text_layer?: boolean
          id?: string
          needs_ocr?: boolean
          ocr_confidence?: number | null
          page_no: number
          text?: string
          user_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          has_text_layer?: boolean
          id?: string
          needs_ocr?: boolean
          ocr_confidence?: number | null
          page_no?: number
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          bytes: number
          chunk_count: number
          created_at: string
          error: string | null
          id: string
          mime: string
          page_count: number
          pages_extracted: number
          retry_count: number
          sha256: string
          source: string
          status: string
          storage_path: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bytes?: number
          chunk_count?: number
          created_at?: string
          error?: string | null
          id?: string
          mime: string
          page_count?: number
          pages_extracted?: number
          retry_count?: number
          sha256: string
          source?: string
          status?: string
          storage_path: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bytes?: number
          chunk_count?: number
          created_at?: string
          error?: string | null
          id?: string
          mime?: string
          page_count?: number
          pages_extracted?: number
          retry_count?: number
          sha256?: string
          source?: string
          status?: string
          storage_path?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          category: string
          created_at: string
          email: string | null
          id: string
          message: string
          rating: number | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          message: string
          rating?: number | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          email?: string | null
          id?: string
          message?: string
          rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      friends_identities: {
        Row: {
          created_at: string | null
          friend_name: string
          id: string
          influence_level: number | null
          personality_notes: string | null
          relationship: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          friend_name: string
          id?: string
          influence_level?: number | null
          personality_notes?: string | null
          relationship?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          friend_name?: string
          id?: string
          influence_level?: number | null
          personality_notes?: string | null
          relationship?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      future_scenarios: {
        Row: {
          created_at: string
          description: string
          generated_at: string
          id: string
          opportunities: string[] | null
          probability_score: number | null
          recommendations: string[] | null
          risks: string[] | null
          scenario_type: string
          skills_gained: string[] | null
          timeframe: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description: string
          generated_at?: string
          id?: string
          opportunities?: string[] | null
          probability_score?: number | null
          recommendations?: string[] | null
          risks?: string[] | null
          scenario_type: string
          skills_gained?: string[] | null
          timeframe: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          generated_at?: string
          id?: string
          opportunities?: string[] | null
          probability_score?: number | null
          recommendations?: string[] | null
          risks?: string[] | null
          scenario_type?: string
          skills_gained?: string[] | null
          timeframe?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      goals: {
        Row: {
          created_at: string | null
          goal_description: string | null
          goal_duration_days: number
          goal_title: string
          id: string
          local_time: string | null
          reminder_enabled: boolean | null
          time_of_day: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          goal_description?: string | null
          goal_duration_days: number
          goal_title: string
          id?: string
          local_time?: string | null
          reminder_enabled?: boolean | null
          time_of_day?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          goal_description?: string | null
          goal_duration_days?: number
          goal_title?: string
          id?: string
          local_time?: string | null
          reminder_enabled?: boolean | null
          time_of_day?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          created_at: string
          current_streak: number | null
          habit_type: string
          id: string
          last_completed_date: string | null
          longest_streak: number | null
          total_completions: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_streak?: number | null
          habit_type: string
          id?: string
          last_completed_date?: string | null
          longest_streak?: number | null
          total_completions?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_streak?: number | null
          habit_type?: string
          id?: string
          last_completed_date?: string | null
          longest_streak?: number | null
          total_completions?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      idea_vault: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          id: string
          status: string | null
          tags: Json | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string | null
          tags?: Json | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      interests: {
        Row: {
          clothing_style: string[] | null
          created_at: string | null
          environment_preferences: string | null
          favorite_foods: string[] | null
          hobbies: string[] | null
          id: string
          movies_books: string[] | null
          music: string[] | null
          sleep_habits: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          clothing_style?: string[] | null
          created_at?: string | null
          environment_preferences?: string | null
          favorite_foods?: string[] | null
          hobbies?: string[] | null
          id?: string
          movies_books?: string[] | null
          music?: string[] | null
          sleep_habits?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          clothing_style?: string[] | null
          created_at?: string | null
          environment_preferences?: string | null
          favorite_foods?: string[] | null
          hobbies?: string[] | null
          id?: string
          movies_books?: string[] | null
          music?: string[] | null
          sleep_habits?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          key: string
          kind: string
          last_error: string | null
          lease_until: string | null
          max_attempts: number
          next_run_at: string
          payload: Json
          status: Database["public"]["Enums"]["job_status"]
          trace_id: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          key: string
          kind: string
          last_error?: string | null
          lease_until?: string | null
          max_attempts?: number
          next_run_at?: string
          payload?: Json
          status?: Database["public"]["Enums"]["job_status"]
          trace_id?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          key?: string
          kind?: string
          last_error?: string | null
          lease_until?: string | null
          max_attempts?: number
          next_run_at?: string
          payload?: Json
          status?: Database["public"]["Enums"]["job_status"]
          trace_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      leaderboard_opt_ins: {
        Row: {
          country: string | null
          display_name: string
          id: string
          is_active: boolean
          is_studying: boolean
          opted_in_at: string
          show_avatar: boolean
          user_id: string
        }
        Insert: {
          country?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_studying?: boolean
          opted_in_at?: string
          show_avatar?: boolean
          user_id: string
        }
        Update: {
          country?: string | null
          display_name?: string
          id?: string
          is_active?: boolean
          is_studying?: boolean
          opted_in_at?: string
          show_avatar?: boolean
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string | null
          id: string
          local_time: string | null
          role: string
          time_of_day: string | null
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string | null
          id?: string
          local_time?: string | null
          role: string
          time_of_day?: string | null
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string | null
          id?: string
          local_time?: string | null
          role?: string
          time_of_day?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      nexus_perf_logs: {
        Row: {
          cache_hit: boolean
          created_at: string
          id: string
          intent: string | null
          model: string | null
          prompt_chars: number
          route: string
          tool_calls: number
          total_ms: number
          user_id: string
        }
        Insert: {
          cache_hit?: boolean
          created_at?: string
          id?: string
          intent?: string | null
          model?: string | null
          prompt_chars?: number
          route: string
          tool_calls?: number
          total_ms?: number
          user_id: string
        }
        Update: {
          cache_hit?: boolean
          created_at?: string
          id?: string
          intent?: string | null
          model?: string | null
          prompt_chars?: number
          route?: string
          tool_calls?: number
          total_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      predictions: {
        Row: {
          burnout_risk: number | null
          created_at: string
          creativity_growth_trend: number | null
          creativity_score: number | null
          current_scenario: string | null
          explanation: string | null
          id: string
          life_score: number | null
          mood_forecast: Json | null
          optimized_scenario: string | null
          overspend_risk: number | null
          predicted_challenges: Json | null
          prediction_date: string
          productivity_score: number | null
          recommended_actions: Json | null
          study_progress_prediction: number | null
          updated_at: string
          user_id: string
          weekly_risks: Json | null
          weekly_wins: Json | null
        }
        Insert: {
          burnout_risk?: number | null
          created_at?: string
          creativity_growth_trend?: number | null
          creativity_score?: number | null
          current_scenario?: string | null
          explanation?: string | null
          id?: string
          life_score?: number | null
          mood_forecast?: Json | null
          optimized_scenario?: string | null
          overspend_risk?: number | null
          predicted_challenges?: Json | null
          prediction_date?: string
          productivity_score?: number | null
          recommended_actions?: Json | null
          study_progress_prediction?: number | null
          updated_at?: string
          user_id: string
          weekly_risks?: Json | null
          weekly_wins?: Json | null
        }
        Update: {
          burnout_risk?: number | null
          created_at?: string
          creativity_growth_trend?: number | null
          creativity_score?: number | null
          current_scenario?: string | null
          explanation?: string | null
          id?: string
          life_score?: number | null
          mood_forecast?: Json | null
          optimized_scenario?: string | null
          overspend_risk?: number | null
          predicted_challenges?: Json | null
          prediction_date?: string
          productivity_score?: number | null
          recommended_actions?: Json | null
          study_progress_prediction?: number | null
          updated_at?: string
          user_id?: string
          weekly_risks?: Json | null
          weekly_wins?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          ai_learning_enabled: boolean | null
          avatar_url: string | null
          country: string | null
          created_at: string | null
          daily_study_hours: number | null
          education_level: string | null
          email: string | null
          email_updates_enabled: boolean | null
          field_of_interest: string | null
          financial_constraints: boolean | null
          id: string
          invite_code: string | null
          name: string | null
          occupation_or_status: string | null
          onboarding_completed: boolean | null
          personal_motto: string | null
          push_notifications_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          age?: number | null
          ai_learning_enabled?: boolean | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          daily_study_hours?: number | null
          education_level?: string | null
          email?: string | null
          email_updates_enabled?: boolean | null
          field_of_interest?: string | null
          financial_constraints?: boolean | null
          id: string
          invite_code?: string | null
          name?: string | null
          occupation_or_status?: string | null
          onboarding_completed?: boolean | null
          personal_motto?: string | null
          push_notifications_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          age?: number | null
          ai_learning_enabled?: boolean | null
          avatar_url?: string | null
          country?: string | null
          created_at?: string | null
          daily_study_hours?: number | null
          education_level?: string | null
          email?: string | null
          email_updates_enabled?: boolean | null
          field_of_interest?: string | null
          financial_constraints?: boolean | null
          id?: string
          invite_code?: string | null
          name?: string | null
          occupation_or_status?: string | null
          onboarding_completed?: boolean | null
          personal_motto?: string | null
          push_notifications_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      situation_photos: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          photo_type: string
          photo_url: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          photo_type: string
          photo_url: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          photo_type?: string
          photo_url?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      skill_scores: {
        Row: {
          ai_analysis: string | null
          consistency_score: number | null
          created_at: string
          discipline_score: number | null
          focus_score: number | null
          id: string
          learning_efficiency_score: number | null
          overall_score: number | null
          score_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_analysis?: string | null
          consistency_score?: number | null
          created_at?: string
          discipline_score?: number | null
          focus_score?: number | null
          id?: string
          learning_efficiency_score?: number | null
          overall_score?: number | null
          score_date?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_analysis?: string | null
          consistency_score?: number | null
          created_at?: string
          discipline_score?: number | null
          focus_score?: number | null
          id?: string
          learning_efficiency_score?: number | null
          overall_score?: number | null
          score_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_selfies: {
        Row: {
          caption: string | null
          created_at: string
          duration_minutes: number | null
          id: string
          photo_path: string
          subject_name: string | null
          task_id: string | null
          topic: string | null
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          photo_path: string
          subject_name?: string | null
          task_id?: string | null
          topic?: string | null
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          duration_minutes?: number | null
          id?: string
          photo_path?: string
          subject_name?: string | null
          task_id?: string | null
          topic?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_selfies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "study_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          accuracy_score: number | null
          created_at: string
          id: string
          is_bonus: boolean
          notes: string | null
          session_date: string
          subject_id: string | null
          task_id: string | null
          time_spent_minutes: number
          topic: string
          user_id: string
        }
        Insert: {
          accuracy_score?: number | null
          created_at?: string
          id?: string
          is_bonus?: boolean
          notes?: string | null
          session_date?: string
          subject_id?: string | null
          task_id?: string | null
          time_spent_minutes?: number
          topic: string
          user_id: string
        }
        Update: {
          accuracy_score?: number | null
          created_at?: string
          id?: string
          is_bonus?: boolean
          notes?: string | null
          session_date?: string
          subject_id?: string | null
          task_id?: string | null
          time_spent_minutes?: number
          topic?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "study_subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "study_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      study_subjects: {
        Row: {
          color: string | null
          created_at: string
          icon_name: string | null
          id: string
          priority_order: number | null
          subject_name: string
          updated_at: string
          user_id: string
          weekly_target_minutes: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          icon_name?: string | null
          id?: string
          priority_order?: number | null
          subject_name: string
          updated_at?: string
          user_id: string
          weekly_target_minutes?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string
          icon_name?: string | null
          id?: string
          priority_order?: number | null
          subject_name?: string
          updated_at?: string
          user_id?: string
          weekly_target_minutes?: number | null
        }
        Relationships: []
      }
      study_tasks: {
        Row: {
          completed_at: string | null
          created_at: string
          difficulty: string
          duration_minutes: number
          id: string
          started_at: string | null
          status: string
          subject_id: string | null
          task_date: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          difficulty?: string
          duration_minutes?: number
          id?: string
          started_at?: string | null
          status?: string
          subject_id?: string | null
          task_date?: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          difficulty?: string
          duration_minutes?: number
          id?: string
          started_at?: string | null
          status?: string
          subject_id?: string | null
          task_date?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "study_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_ai_providers: {
        Row: {
          created_at: string
          encrypted_api_key: string
          is_default: boolean
          key_last4: string
          provider: string
          selected_model: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          encrypted_api_key: string
          is_default?: boolean
          key_last4: string
          provider?: string
          selected_model?: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          encrypted_api_key?: string
          is_default?: boolean
          key_last4?: string
          provider?: string
          selected_model?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      user_documents: {
        Row: {
          created_at: string | null
          document_name: string
          document_type: string
          file_size: number | null
          file_url: string
          id: string
          mime_type: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          document_name: string
          document_type: string
          file_size?: number | null
          file_url: string
          id?: string
          mime_type?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          document_name?: string
          document_type?: string
          file_size?: number | null
          file_url?: string
          id?: string
          mime_type?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_insights: {
        Row: {
          confidence_level: string | null
          created_at: string | null
          id: string
          insight_key: string
          insight_type: string
          insight_value: string
          last_mentioned_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          confidence_level?: string | null
          created_at?: string | null
          id?: string
          insight_key: string
          insight_type: string
          insight_value: string
          last_mentioned_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          confidence_level?: string | null
          created_at?: string | null
          id?: string
          insight_key?: string
          insight_type?: string
          insight_value?: string
          last_mentioned_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          id: string
          name: string | null
        }
        Insert: {
          id: string
          name?: string | null
        }
        Update: {
          id?: string
          name?: string | null
        }
        Relationships: []
      }
      weekly_goals: {
        Row: {
          completed: boolean | null
          created_at: string
          current_value: number | null
          goal_category: string
          id: string
          target_value: number
          updated_at: string
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          current_value?: number | null
          goal_category: string
          id?: string
          target_value: number
          updated_at?: string
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          current_value?: number | null
          goal_category?: string
          id?: string
          target_value?: number
          updated_at?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_leaderboard: {
        Row: {
          computed_at: string
          days_studied: number
          discipline_score: number
          id: string
          streak_days: number
          study_hours: number
          user_id: string
          week_start: string
        }
        Insert: {
          computed_at?: string
          days_studied?: number
          discipline_score?: number
          id?: string
          streak_days?: number
          study_hours?: number
          user_id: string
          week_start: string
        }
        Update: {
          computed_at?: string
          days_studied?: number
          discipline_score?: number
          id?: string
          streak_days?: number
          study_hours?: number
          user_id?: string
          week_start?: string
        }
        Relationships: []
      }
      weekly_reports: {
        Row: {
          action_items: string[] | null
          compared_to_high_performers: string | null
          consistency_percentage: number | null
          created_at: string
          id: string
          main_reason: string | null
          progress_trend: string
          study_hours_logged: number | null
          summary: string
          user_id: string
          week_end: string
          week_start: string
        }
        Insert: {
          action_items?: string[] | null
          compared_to_high_performers?: string | null
          consistency_percentage?: number | null
          created_at?: string
          id?: string
          main_reason?: string | null
          progress_trend: string
          study_hours_logged?: number | null
          summary: string
          user_id: string
          week_end: string
          week_start: string
        }
        Update: {
          action_items?: string[] | null
          compared_to_high_performers?: string | null
          consistency_percentage?: number | null
          created_at?: string
          id?: string
          main_reason?: string | null
          progress_trend?: string
          study_hours_logged?: number | null
          summary?: string
          user_id?: string
          week_end?: string
          week_start?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_jobs: {
        Args: { _kind: string; _lease_seconds?: number; _n?: number }
        Returns: {
          attempts: number
          created_at: string
          id: string
          key: string
          kind: string
          last_error: string | null
          lease_until: string | null
          max_attempts: number
          next_run_at: string
          payload: Json
          status: Database["public"]["Enums"]["job_status"]
          trace_id: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      complete_job: { Args: { _id: string }; Returns: undefined }
      enqueue_job: {
        Args: {
          _key: string
          _kind: string
          _max_attempts?: number
          _payload?: Json
          _run_at?: string
          _trace_id?: string
        }
        Returns: string
      }
      fail_job: {
        Args: { _error: string; _id: string }
        Returns: Database["public"]["Enums"]["job_status"]
      }
      gc_anon_sessions: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          content: string
          doc_id: string
          doc_title: string
          id: string
          similarity: number
        }[]
      }
      match_user_chunks: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          content: string
          doc_title: string
          document_id: string
          id: string
          page_no: number
          similarity: number
        }[]
      }
      outbox_enqueue: {
        Args: {
          _key: string
          _kind: string
          _payload?: Json
          _trace_id?: string
        }
        Returns: string
      }
      purge_jobs: {
        Args: { _dead_retention?: string; _done_retention?: string }
        Returns: {
          dead_purged: number
          done_purged: number
        }[]
      }
      reconcile_stuck_documents: {
        Args: { _stale?: string }
        Returns: {
          dead_reconciled: number
          stale_failed: number
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user"
      job_status: "pending" | "running" | "done" | "failed" | "dead"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      job_status: ["pending", "running", "done", "failed", "dead"],
    },
  },
} as const
