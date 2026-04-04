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
      ai_memory: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          source_message_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          source_message_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
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
      conversations: {
        Row: {
          created_at: string | null
          id: string
          is_pinned: boolean
          local_time: string | null
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
      leaderboard_opt_ins: {
        Row: {
          display_name: string
          id: string
          is_active: boolean
          opted_in_at: string
          show_avatar: boolean
          user_id: string
        }
        Insert: {
          display_name?: string
          id?: string
          is_active?: boolean
          opted_in_at?: string
          show_avatar?: boolean
          user_id: string
        }
        Update: {
          display_name?: string
          id?: string
          is_active?: boolean
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
