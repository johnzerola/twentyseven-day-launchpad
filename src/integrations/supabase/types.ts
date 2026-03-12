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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ab_tests: {
        Row: {
          ended_at: string | null
          id: string
          metric_target: string | null
          project_id: string | null
          result: Json | null
          started_at: string | null
          test_type: string | null
          variant_a: Json | null
          variant_b: Json | null
        }
        Insert: {
          ended_at?: string | null
          id?: string
          metric_target?: string | null
          project_id?: string | null
          result?: Json | null
          started_at?: string | null
          test_type?: string | null
          variant_a?: Json | null
          variant_b?: Json | null
        }
        Update: {
          ended_at?: string | null
          id?: string
          metric_target?: string | null
          project_id?: string | null
          result?: Json | null
          started_at?: string | null
          test_type?: string | null
          variant_a?: Json | null
          variant_b?: Json | null
        }
        Relationships: []
      }
      ai_learning: {
        Row: {
          created_at: string | null
          id: string
          insight: string | null
          source: string | null
          topic: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          insight?: string | null
          source?: string | null
          topic?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          insight?: string | null
          source?: string | null
          topic?: string | null
        }
        Relationships: []
      }
      api_config: {
        Row: {
          api_name: string
          daily_limit: number | null
          env_var_key: string
          id: string
          notes: string | null
        }
        Insert: {
          api_name: string
          daily_limit?: number | null
          env_var_key: string
          id?: string
          notes?: string | null
        }
        Update: {
          api_name?: string
          daily_limit?: number | null
          env_var_key?: string
          id?: string
          notes?: string | null
        }
        Relationships: []
      }
      api_logs: {
        Row: {
          cost: number | null
          created_at: string | null
          endpoint: string | null
          id: string
          response_code: number | null
          service: string
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          response_code?: number | null
          service: string
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          endpoint?: string | null
          id?: string
          response_code?: number | null
          service?: string
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          api_name: string
          daily_limit: number
          date: string
          id: string
          requests_used: number
          updated_at: string
        }
        Insert: {
          api_name: string
          daily_limit?: number
          date?: string
          id?: string
          requests_used?: number
          updated_at?: string
        }
        Update: {
          api_name?: string
          daily_limit?: number
          date?: string
          id?: string
          requests_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      attention_engineering: {
        Row: {
          applicable_niches: Json | null
          category: string
          created_at: string | null
          duration_window_sec: number | null
          examples: Json | null
          id: string
          intensity_level: number | null
          pattern_name: string
          psychological_basis: string | null
          retention_impact: number | null
          source: string | null
          technique: string
          trigger_second: number | null
        }
        Insert: {
          applicable_niches?: Json | null
          category?: string
          created_at?: string | null
          duration_window_sec?: number | null
          examples?: Json | null
          id?: string
          intensity_level?: number | null
          pattern_name: string
          psychological_basis?: string | null
          retention_impact?: number | null
          source?: string | null
          technique?: string
          trigger_second?: number | null
        }
        Update: {
          applicable_niches?: Json | null
          category?: string
          created_at?: string | null
          duration_window_sec?: number | null
          examples?: Json | null
          id?: string
          intensity_level?: number | null
          pattern_name?: string
          psychological_basis?: string | null
          retention_impact?: number | null
          source?: string | null
          technique?: string
          trigger_second?: number | null
        }
        Relationships: []
      }
      audience_psychology_patterns: {
        Row: {
          created_at: string | null
          description: string
          example_hooks: string[] | null
          example_titles: string[] | null
          id: string
          niches: string[] | null
          retention_score: number | null
          source: string | null
          storytelling_pattern: string | null
          trigger_type: string
        }
        Insert: {
          created_at?: string | null
          description?: string
          example_hooks?: string[] | null
          example_titles?: string[] | null
          id?: string
          niches?: string[] | null
          retention_score?: number | null
          source?: string | null
          storytelling_pattern?: string | null
          trigger_type: string
        }
        Update: {
          created_at?: string | null
          description?: string
          example_hooks?: string[] | null
          example_titles?: string[] | null
          id?: string
          niches?: string[] | null
          retention_score?: number | null
          source?: string | null
          storytelling_pattern?: string | null
          trigger_type?: string
        }
        Relationships: []
      }
      channel_groups: {
        Row: {
          channels: Json | null
          color: string | null
          created_at: string | null
          default_country: string | null
          default_language: string | null
          description: string | null
          id: string
          name: string
          user_id: string
        }
        Insert: {
          channels?: Json | null
          color?: string | null
          created_at?: string | null
          default_country?: string | null
          default_language?: string | null
          description?: string | null
          id?: string
          name: string
          user_id: string
        }
        Update: {
          channels?: Json | null
          color?: string | null
          created_at?: string | null
          default_country?: string | null
          default_language?: string | null
          description?: string | null
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      channel_intelligence: {
        Row: {
          analyzed_at: string | null
          avg_views: number
          channel_name: string
          country: string
          created_at: string | null
          growth_rate: string
          id: string
          is_faceless: boolean
          is_monetized: boolean
          language: string
          niche: string
          rpm_estimate: number | null
          style: string
          sub_niche: string | null
          subscribers: number
          top_videos: Json
          upload_frequency: string | null
          viral_patterns: Json
          visual_style_notes: string | null
          youtube_channel_id: string
        }
        Insert: {
          analyzed_at?: string | null
          avg_views?: number
          channel_name: string
          country?: string
          created_at?: string | null
          growth_rate?: string
          id?: string
          is_faceless?: boolean
          is_monetized?: boolean
          language?: string
          niche?: string
          rpm_estimate?: number | null
          style?: string
          sub_niche?: string | null
          subscribers?: number
          top_videos?: Json
          upload_frequency?: string | null
          viral_patterns?: Json
          visual_style_notes?: string | null
          youtube_channel_id?: string
        }
        Update: {
          analyzed_at?: string | null
          avg_views?: number
          channel_name?: string
          country?: string
          created_at?: string | null
          growth_rate?: string
          id?: string
          is_faceless?: boolean
          is_monetized?: boolean
          language?: string
          niche?: string
          rpm_estimate?: number | null
          style?: string
          sub_niche?: string | null
          subscribers?: number
          top_videos?: Json
          upload_frequency?: string | null
          viral_patterns?: Json
          visual_style_notes?: string | null
          youtube_channel_id?: string
        }
        Relationships: []
      }
      characters: {
        Row: {
          created_at: string | null
          global_prompt_append: string | null
          id: string
          name: string
          project_id: string
          reference_image_url: string | null
          visual_attributes: Json | null
          visual_prompt: string
        }
        Insert: {
          created_at?: string | null
          global_prompt_append?: string | null
          id?: string
          name: string
          project_id: string
          reference_image_url?: string | null
          visual_attributes?: Json | null
          visual_prompt?: string
        }
        Update: {
          created_at?: string | null
          global_prompt_append?: string | null
          id?: string
          name?: string
          project_id?: string
          reference_image_url?: string | null
          visual_attributes?: Json | null
          visual_prompt?: string
        }
        Relationships: [
          {
            foreignKeyName: "characters_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_queue: {
        Row: {
          channel_id: string | null
          country: string | null
          created_at: string | null
          id: string
          language: string | null
          metadata_json: Json | null
          niche: string | null
          notes: string | null
          priority: string | null
          project_id: string | null
          published_url: string | null
          scheduled_date: string | null
          script_id: string | null
          status: string
          tags: Json | null
          template_id: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          metadata_json?: Json | null
          niche?: string | null
          notes?: string | null
          priority?: string | null
          project_id?: string | null
          published_url?: string | null
          scheduled_date?: string | null
          script_id?: string | null
          status?: string
          tags?: Json | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string | null
          country?: string | null
          created_at?: string | null
          id?: string
          language?: string | null
          metadata_json?: Json | null
          niche?: string | null
          notes?: string | null
          priority?: string | null
          project_id?: string | null
          published_url?: string | null
          scheduled_date?: string | null
          script_id?: string | null
          status?: string
          tags?: Json | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_queue_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "user_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_queue_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      content_templates: {
        Row: {
          category: string
          created_at: string | null
          id: string
          language: string | null
          name: string
          niche: string | null
          template_json: Json
          updated_at: string | null
          use_count: number | null
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string | null
          id?: string
          language?: string | null
          name: string
          niche?: string | null
          template_json?: Json
          updated_at?: string | null
          use_count?: number | null
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          language?: string | null
          name?: string
          niche?: string | null
          template_json?: Json
          updated_at?: string | null
          use_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      emerging_channels: {
        Row: {
          channel_id: string
          channel_title: string | null
          detected_at: string | null
          id: string
          last_checked: string | null
          meta: Json | null
          niche: string | null
          sample_video_id: string | null
          viral_score: number | null
        }
        Insert: {
          channel_id: string
          channel_title?: string | null
          detected_at?: string | null
          id?: string
          last_checked?: string | null
          meta?: Json | null
          niche?: string | null
          sample_video_id?: string | null
          viral_score?: number | null
        }
        Update: {
          channel_id?: string
          channel_title?: string | null
          detected_at?: string | null
          id?: string
          last_checked?: string | null
          meta?: Json | null
          niche?: string | null
          sample_video_id?: string | null
          viral_score?: number | null
        }
        Relationships: []
      }
      execution_logs: {
        Row: {
          api_calls_made: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          function_name: string
          id: string
          metadata: Json | null
          payload_size: number | null
          success: boolean
        }
        Insert: {
          api_calls_made?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name: string
          id?: string
          metadata?: Json | null
          payload_size?: number | null
          success?: boolean
        }
        Update: {
          api_calls_made?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          function_name?: string
          id?: string
          metadata?: Json | null
          payload_size?: number | null
          success?: boolean
        }
        Relationships: []
      }
      generated_branding: {
        Row: {
          branding_data: Json | null
          channel_name_suggestions: Json | null
          created_at: string | null
          description: string | null
          id: string
          logo_url: string | null
          niche: string | null
          seo_tags: Json | null
          user_id: string
        }
        Insert: {
          branding_data?: Json | null
          channel_name_suggestions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          niche?: string | null
          seo_tags?: Json | null
          user_id: string
        }
        Update: {
          branding_data?: Json | null
          channel_name_suggestions?: Json | null
          created_at?: string | null
          description?: string | null
          id?: string
          logo_url?: string | null
          niche?: string | null
          seo_tags?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      hook_library: {
        Row: {
          created_at: string | null
          hook_text: string
          hook_type: string | null
          id: string
          niche: string | null
          retention_score: number | null
          source_video: string | null
        }
        Insert: {
          created_at?: string | null
          hook_text: string
          hook_type?: string | null
          id?: string
          niche?: string | null
          retention_score?: number | null
          source_video?: string | null
        }
        Update: {
          created_at?: string | null
          hook_text?: string
          hook_type?: string | null
          id?: string
          niche?: string | null
          retention_score?: number | null
          source_video?: string | null
        }
        Relationships: []
      }
      micro_niches: {
        Row: {
          avg_views: number | null
          competition: string | null
          created_at: string | null
          example_channels: Json | null
          faceless_friendly: boolean | null
          growth_rate: string | null
          id: string
          keywords: Json | null
          micro_niche: string
          monetization_score: number | null
          niche: string
          trend_direction: string | null
        }
        Insert: {
          avg_views?: number | null
          competition?: string | null
          created_at?: string | null
          example_channels?: Json | null
          faceless_friendly?: boolean | null
          growth_rate?: string | null
          id?: string
          keywords?: Json | null
          micro_niche: string
          monetization_score?: number | null
          niche: string
          trend_direction?: string | null
        }
        Update: {
          avg_views?: number | null
          competition?: string | null
          created_at?: string | null
          example_channels?: Json | null
          faceless_friendly?: boolean | null
          growth_rate?: string | null
          id?: string
          keywords?: Json | null
          micro_niche?: string
          monetization_score?: number | null
          niche?: string
          trend_direction?: string | null
        }
        Relationships: []
      }
      monetization_plans: {
        Row: {
          chat_history: Json | null
          created_at: string | null
          id: string
          plan_json: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          chat_history?: Json | null
          created_at?: string | null
          id?: string
          plan_json?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          chat_history?: Json | null
          created_at?: string | null
          id?: string
          plan_json?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      niche_database: {
        Row: {
          country: string | null
          created_at: string | null
          difficulty: string | null
          faceless_friendly: boolean | null
          id: string
          language: string | null
          name: string
          rpm_estimate: number | null
          saturation: string | null
          sub_niches: Json | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          difficulty?: string | null
          faceless_friendly?: boolean | null
          id?: string
          language?: string | null
          name: string
          rpm_estimate?: number | null
          saturation?: string | null
          sub_niches?: Json | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          difficulty?: string | null
          faceless_friendly?: boolean | null
          id?: string
          language?: string | null
          name?: string
          rpm_estimate?: number | null
          saturation?: string | null
          sub_niches?: Json | null
        }
        Relationships: []
      }
      onboarding_plans: {
        Row: {
          channel_analysis_json: Json | null
          channel_id: string | null
          content_type: string | null
          created_at: string
          goal: string | null
          id: string
          language: string | null
          niche: string | null
          plan_json: Json
          time_per_day: string | null
          user_id: string
        }
        Insert: {
          channel_analysis_json?: Json | null
          channel_id?: string | null
          content_type?: string | null
          created_at?: string
          goal?: string | null
          id?: string
          language?: string | null
          niche?: string | null
          plan_json?: Json
          time_per_day?: string | null
          user_id: string
        }
        Update: {
          channel_analysis_json?: Json | null
          channel_id?: string | null
          content_type?: string | null
          created_at?: string
          goal?: string | null
          id?: string
          language?: string | null
          niche?: string | null
          plan_json?: Json
          time_per_day?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_plans_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "user_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      outlier_channels: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          found_at: string | null
          id: string
          multiplier: number | null
          niche: string | null
          published_at: string | null
          subscribers: number | null
          thumbnail_url: string | null
          user_id: string
          video_title: string
          video_url: string | null
          views: number | null
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          found_at?: string | null
          id?: string
          multiplier?: number | null
          niche?: string | null
          published_at?: string | null
          subscribers?: number | null
          thumbnail_url?: string | null
          user_id: string
          video_title: string
          video_url?: string | null
          views?: number | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          found_at?: string | null
          id?: string
          multiplier?: number | null
          niche?: string | null
          published_at?: string | null
          subscribers?: number | null
          thumbnail_url?: string | null
          user_id?: string
          video_title?: string
          video_url?: string | null
          views?: number | null
        }
        Relationships: []
      }
      planner_cards: {
        Row: {
          column_id: string
          created_at: string | null
          due_date: string | null
          id: string
          position: number | null
          priority: string | null
          tags: Json | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          column_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          position?: number | null
          priority?: string | null
          tags?: Json | null
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          column_id?: string
          created_at?: string | null
          due_date?: string | null
          id?: string
          position?: number | null
          priority?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      playbook_progress: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          day_number: number
          id: string
          notes: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          day_number: number
          id?: string
          notes?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          day_number?: number
          id?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      prompts: {
        Row: {
          ai_model: string | null
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          raw_prompt: string
          result_url: string | null
          scene_id: string
          status: string | null
        }
        Insert: {
          ai_model?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          raw_prompt: string
          result_url?: string | null
          scene_id: string
          status?: string | null
        }
        Update: {
          ai_model?: string | null
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          raw_prompt?: string
          result_url?: string | null
          scene_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompts_scene_id_fkey"
            columns: ["scene_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id"]
          },
        ]
      }
      research_cache: {
        Row: {
          cache_key: string
          created_at: string | null
          expires_at: string
          id: string
          params: Json | null
          query: string | null
          result_json: Json
          source: string
          ttl: string | null
        }
        Insert: {
          cache_key: string
          created_at?: string | null
          expires_at?: string
          id?: string
          params?: Json | null
          query?: string | null
          result_json?: Json
          source?: string
          ttl?: string | null
        }
        Update: {
          cache_key?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          params?: Json | null
          query?: string | null
          result_json?: Json
          source?: string
          ttl?: string | null
        }
        Relationships: []
      }
      reverse_engineering_analyses: {
        Row: {
          analyzed_by: string | null
          channel_id: string | null
          channel_name: string | null
          clone_template: Json | null
          created_at: string | null
          duration_seconds: number | null
          hook_analysis: Json | null
          id: string
          language: string | null
          monetization_score: number | null
          narrative_structure: Json | null
          niche: string | null
          pacing_analysis: Json | null
          psychological_triggers: string[] | null
          quality_score: number | null
          retention_curve: Json | null
          scene_structure: Json | null
          subscribers: number | null
          user_id: string | null
          video_id: string
          video_title: string
          views: number | null
          viral_score: number | null
        }
        Insert: {
          analyzed_by?: string | null
          channel_id?: string | null
          channel_name?: string | null
          clone_template?: Json | null
          created_at?: string | null
          duration_seconds?: number | null
          hook_analysis?: Json | null
          id?: string
          language?: string | null
          monetization_score?: number | null
          narrative_structure?: Json | null
          niche?: string | null
          pacing_analysis?: Json | null
          psychological_triggers?: string[] | null
          quality_score?: number | null
          retention_curve?: Json | null
          scene_structure?: Json | null
          subscribers?: number | null
          user_id?: string | null
          video_id: string
          video_title?: string
          views?: number | null
          viral_score?: number | null
        }
        Update: {
          analyzed_by?: string | null
          channel_id?: string | null
          channel_name?: string | null
          clone_template?: Json | null
          created_at?: string | null
          duration_seconds?: number | null
          hook_analysis?: Json | null
          id?: string
          language?: string | null
          monetization_score?: number | null
          narrative_structure?: Json | null
          niche?: string | null
          pacing_analysis?: Json | null
          psychological_triggers?: string[] | null
          quality_score?: number | null
          retention_curve?: Json | null
          scene_structure?: Json | null
          subscribers?: number | null
          user_id?: string | null
          video_id?: string
          video_title?: string
          views?: number | null
          viral_score?: number | null
        }
        Relationships: []
      }
      saved_niche_analyses: {
        Row: {
          analysis_json: Json
          country: string | null
          created_at: string | null
          id: string
          niche: string
          score: number | null
          user_id: string
        }
        Insert: {
          analysis_json?: Json
          country?: string | null
          created_at?: string | null
          id?: string
          niche: string
          score?: number | null
          user_id: string
        }
        Update: {
          analysis_json?: Json
          country?: string | null
          created_at?: string | null
          id?: string
          niche?: string
          score?: number | null
          user_id?: string
        }
        Relationships: []
      }
      saved_scripts: {
        Row: {
          created_at: string
          duration: number | null
          id: string
          script_content: string
          style: string | null
          topic: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration?: number | null
          id?: string
          script_content: string
          style?: string | null
          topic: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: number | null
          id?: string
          script_content?: string
          style?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_searches: {
        Row: {
          channel_info_json: Json | null
          created_at: string
          filters_json: Json | null
          id: string
          notes: string | null
          query: string
          results_json: Json | null
          tab: string
          updated_at: string
          user_id: string
        }
        Insert: {
          channel_info_json?: Json | null
          created_at?: string
          filters_json?: Json | null
          id?: string
          notes?: string | null
          query: string
          results_json?: Json | null
          tab?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          channel_info_json?: Json | null
          created_at?: string
          filters_json?: Json | null
          id?: string
          notes?: string | null
          query?: string
          results_json?: Json | null
          tab?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_titles: {
        Row: {
          ab_test_json: Json | null
          created_at: string | null
          id: string
          niche: string | null
          seo_json: Json | null
          titles_json: Json | null
          topic: string | null
          user_id: string
        }
        Insert: {
          ab_test_json?: Json | null
          created_at?: string | null
          id?: string
          niche?: string | null
          seo_json?: Json | null
          titles_json?: Json | null
          topic?: string | null
          user_id: string
        }
        Update: {
          ab_test_json?: Json | null
          created_at?: string | null
          id?: string
          niche?: string | null
          seo_json?: Json | null
          titles_json?: Json | null
          topic?: string | null
          user_id?: string
        }
        Relationships: []
      }
      scene_prompt_knowledge: {
        Row: {
          category: string
          created_at: string | null
          id: string
          prompt_template: string
          tags: Json | null
          title: string
          viral_score: number | null
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          prompt_template: string
          tags?: Json | null
          title: string
          viral_score?: number | null
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          prompt_template?: string
          tags?: Json | null
          title?: string
          viral_score?: number | null
        }
        Relationships: []
      }
      scenes: {
        Row: {
          audio_url: string | null
          camera_movement: string | null
          character_ref: string | null
          created_at: string | null
          duration_sec: number | null
          emotional_intent: string | null
          id: string
          lighting: string | null
          media_url: string | null
          negative_prompt: string | null
          project_id: string
          reference_image_url: string | null
          segment_index: number | null
          sequence_order: number
          status: string | null
          style_tags: Json | null
          text_content: string | null
          tts_text: string | null
          veo3_prompt: string | null
          video_clip_url: string | null
        }
        Insert: {
          audio_url?: string | null
          camera_movement?: string | null
          character_ref?: string | null
          created_at?: string | null
          duration_sec?: number | null
          emotional_intent?: string | null
          id?: string
          lighting?: string | null
          media_url?: string | null
          negative_prompt?: string | null
          project_id: string
          reference_image_url?: string | null
          segment_index?: number | null
          sequence_order: number
          status?: string | null
          style_tags?: Json | null
          text_content?: string | null
          tts_text?: string | null
          veo3_prompt?: string | null
          video_clip_url?: string | null
        }
        Update: {
          audio_url?: string | null
          camera_movement?: string | null
          character_ref?: string | null
          created_at?: string | null
          duration_sec?: number | null
          emotional_intent?: string | null
          id?: string
          lighting?: string | null
          media_url?: string | null
          negative_prompt?: string | null
          project_id?: string
          reference_image_url?: string | null
          segment_index?: number | null
          sequence_order?: number
          status?: string | null
          style_tags?: Json | null
          text_content?: string | null
          tts_text?: string | null
          veo3_prompt?: string | null
          video_clip_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      script_knowledge: {
        Row: {
          category: string
          content: string
          created_at: string | null
          effectiveness_score: number | null
          examples: Json | null
          id: string
          title: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          effectiveness_score?: number | null
          examples?: Json | null
          id?: string
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          effectiveness_score?: number | null
          examples?: Json | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      script_structures: {
        Row: {
          avg_retention: number | null
          cliffhanger_pattern: string
          created_at: string | null
          effectiveness_score: number | null
          ending_pattern: string
          examples: Json | null
          id: string
          intro_pattern: string
          middle_pattern: string
          niche: string | null
          segments: Json | null
          source: string | null
          structure_name: string
        }
        Insert: {
          avg_retention?: number | null
          cliffhanger_pattern?: string
          created_at?: string | null
          effectiveness_score?: number | null
          ending_pattern?: string
          examples?: Json | null
          id?: string
          intro_pattern?: string
          middle_pattern?: string
          niche?: string | null
          segments?: Json | null
          source?: string | null
          structure_name: string
        }
        Update: {
          avg_retention?: number | null
          cliffhanger_pattern?: string
          created_at?: string | null
          effectiveness_score?: number | null
          ending_pattern?: string
          examples?: Json | null
          id?: string
          intro_pattern?: string
          middle_pattern?: string
          niche?: string | null
          segments?: Json | null
          source?: string | null
          structure_name?: string
        }
        Relationships: []
      }
      task_queue: {
        Row: {
          attempts: number
          completed_at: string | null
          created_at: string | null
          error_message: string | null
          id: string
          idempotency_key: string | null
          max_attempts: number
          payload: Json | null
          result: Json | null
          scheduled_at: string | null
          started_at: string | null
          status: string
          task_type: string
        }
        Insert: {
          attempts?: number
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          max_attempts?: number
          payload?: Json | null
          result?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          task_type: string
        }
        Update: {
          attempts?: number
          completed_at?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          idempotency_key?: string | null
          max_attempts?: number
          payload?: Json | null
          result?: Json | null
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          task_type?: string
        }
        Relationships: []
      }
      thumbnail_features: {
        Row: {
          avg_contrast: number | null
          color_profile: Json | null
          created_at: string | null
          ctr_estimate: number | null
          dominant_colors: Json | null
          emotion_tags: Json | null
          face_count: number | null
          id: string
          source_url: string | null
          text_overlay: boolean | null
          video_id: string
        }
        Insert: {
          avg_contrast?: number | null
          color_profile?: Json | null
          created_at?: string | null
          ctr_estimate?: number | null
          dominant_colors?: Json | null
          emotion_tags?: Json | null
          face_count?: number | null
          id?: string
          source_url?: string | null
          text_overlay?: boolean | null
          video_id: string
        }
        Update: {
          avg_contrast?: number | null
          color_profile?: Json | null
          created_at?: string | null
          ctr_estimate?: number | null
          dominant_colors?: Json | null
          emotion_tags?: Json | null
          face_count?: number | null
          id?: string
          source_url?: string | null
          text_overlay?: boolean | null
          video_id?: string
        }
        Relationships: []
      }
      thumbnail_patterns: {
        Row: {
          color_scheme: Json | null
          composition_rules: Json | null
          created_at: string | null
          ctr_average: number | null
          effectiveness_score: number | null
          emotion: string | null
          examples: Json | null
          faces_required: boolean | null
          id: string
          niche: string | null
          pattern_name: string
          text_overlay_style: string | null
          thumbnail_type: string
        }
        Insert: {
          color_scheme?: Json | null
          composition_rules?: Json | null
          created_at?: string | null
          ctr_average?: number | null
          effectiveness_score?: number | null
          emotion?: string | null
          examples?: Json | null
          faces_required?: boolean | null
          id?: string
          niche?: string | null
          pattern_name: string
          text_overlay_style?: string | null
          thumbnail_type?: string
        }
        Update: {
          color_scheme?: Json | null
          composition_rules?: Json | null
          created_at?: string | null
          ctr_average?: number | null
          effectiveness_score?: number | null
          emotion?: string | null
          examples?: Json | null
          faces_required?: boolean | null
          id?: string
          niche?: string | null
          pattern_name?: string
          text_overlay_style?: string | null
          thumbnail_type?: string
        }
        Relationships: []
      }
      tracked_channels: {
        Row: {
          channel_name: string
          created_at: string | null
          folder: string | null
          id: string
          last_video_check: string | null
          subscribers: number | null
          thumbnail: string | null
          user_id: string
          youtube_channel_id: string
        }
        Insert: {
          channel_name: string
          created_at?: string | null
          folder?: string | null
          id?: string
          last_video_check?: string | null
          subscribers?: number | null
          thumbnail?: string | null
          user_id: string
          youtube_channel_id: string
        }
        Update: {
          channel_name?: string
          created_at?: string | null
          folder?: string | null
          id?: string
          last_video_check?: string | null
          subscribers?: number | null
          thumbnail?: string | null
          user_id?: string
          youtube_channel_id?: string
        }
        Relationships: []
      }
      user_channels: {
        Row: {
          analysis_json: Json | null
          channel_name: string
          id: string
          linked_at: string
          niche: string | null
          subscribers: number | null
          thumbnail: string | null
          user_id: string
          videos: number | null
          views: number | null
          youtube_channel_id: string
        }
        Insert: {
          analysis_json?: Json | null
          channel_name: string
          id?: string
          linked_at?: string
          niche?: string | null
          subscribers?: number | null
          thumbnail?: string | null
          user_id: string
          videos?: number | null
          views?: number | null
          youtube_channel_id: string
        }
        Update: {
          analysis_json?: Json | null
          channel_name?: string
          id?: string
          linked_at?: string
          niche?: string | null
          subscribers?: number | null
          thumbnail?: string | null
          user_id?: string
          videos?: number | null
          views?: number | null
          youtube_channel_id?: string
        }
        Relationships: []
      }
      user_progress: {
        Row: {
          completed_items: Json
          id: string
          module: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_items?: Json
          id?: string
          module: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_items?: Json
          id?: string
          module?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          active_devices: number
          created_at: string
          credits_monthly_limit: number
          credits_remaining: number
          expires_at: string | null
          id: string
          max_devices: number
          started_at: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          active_devices?: number
          created_at?: string
          credits_monthly_limit?: number
          credits_remaining?: number
          expires_at?: string | null
          id?: string
          max_devices?: number
          started_at?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          active_devices?: number
          created_at?: string
          credits_monthly_limit?: number
          credits_remaining?: number
          expires_at?: string | null
          id?: string
          max_devices?: number
          started_at?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      video_blueprints: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          clone_template: Json | null
          created_at: string | null
          hook_text: string | null
          hook_type: string | null
          id: string
          likes: number | null
          narrative_style: string | null
          niche: string | null
          pacing_type: string | null
          psychological_triggers: string[] | null
          retention_map: Json | null
          scene_structure: Json | null
          scores: Json | null
          source: string | null
          story_structure: Json | null
          thumbnail_analysis: Json | null
          video_id: string
          video_title: string
          views: number | null
          visual_style: string | null
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          clone_template?: Json | null
          created_at?: string | null
          hook_text?: string | null
          hook_type?: string | null
          id?: string
          likes?: number | null
          narrative_style?: string | null
          niche?: string | null
          pacing_type?: string | null
          psychological_triggers?: string[] | null
          retention_map?: Json | null
          scene_structure?: Json | null
          scores?: Json | null
          source?: string | null
          story_structure?: Json | null
          thumbnail_analysis?: Json | null
          video_id: string
          video_title?: string
          views?: number | null
          visual_style?: string | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          clone_template?: Json | null
          created_at?: string | null
          hook_text?: string | null
          hook_type?: string | null
          id?: string
          likes?: number | null
          narrative_style?: string | null
          niche?: string | null
          pacing_type?: string | null
          psychological_triggers?: string[] | null
          retention_map?: Json | null
          scene_structure?: Json | null
          scores?: Json | null
          source?: string | null
          story_structure?: Json | null
          thumbnail_analysis?: Json | null
          video_id?: string
          video_title?: string
          views?: number | null
          visual_style?: string | null
        }
        Relationships: []
      }
      video_projects: {
        Row: {
          channel_id: string | null
          created_at: string | null
          duration_seconds: number | null
          id: string
          intelligence_json: Json | null
          niche: string | null
          scene_blueprint_json: Json | null
          script: string | null
          status: string | null
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          intelligence_json?: Json | null
          niche?: string | null
          scene_blueprint_json?: Json | null
          script?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          id?: string
          intelligence_json?: Json | null
          niche?: string | null
          scene_blueprint_json?: Json | null
          script?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      video_retention_curve: {
        Row: {
          bucket_seconds: number
          created_at: string | null
          id: string
          percent_viewers: number
          video_id: string
        }
        Insert: {
          bucket_seconds?: number
          created_at?: string | null
          id?: string
          percent_viewers?: number
          video_id: string
        }
        Update: {
          bucket_seconds?: number
          created_at?: string | null
          id?: string
          percent_viewers?: number
          video_id?: string
        }
        Relationships: []
      }
      video_segments: {
        Row: {
          end_seconds: number
          id: string
          meta: Json | null
          metric: number | null
          segment_type: string
          start_seconds: number
          video_id: string
        }
        Insert: {
          end_seconds?: number
          id?: string
          meta?: Json | null
          metric?: number | null
          segment_type?: string
          start_seconds?: number
          video_id: string
        }
        Update: {
          end_seconds?: number
          id?: string
          meta?: Json | null
          metric?: number | null
          segment_type?: string
          start_seconds?: number
          video_id?: string
        }
        Relationships: []
      }
      viral_content_library: {
        Row: {
          category: string
          content_json: Json
          created_at: string | null
          effectiveness_score: number | null
          id: string
          language: string
          niches: string[] | null
          updated_at: string | null
        }
        Insert: {
          category: string
          content_json?: Json
          created_at?: string | null
          effectiveness_score?: number | null
          id?: string
          language?: string
          niches?: string[] | null
          updated_at?: string | null
        }
        Update: {
          category?: string
          content_json?: Json
          created_at?: string | null
          effectiveness_score?: number | null
          id?: string
          language?: string
          niches?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      viral_patterns: {
        Row: {
          created_at: string | null
          id: string
          niche: string | null
          pattern_json: Json | null
          pattern_name: string
          source_video: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          niche?: string | null
          pattern_json?: Json | null
          pattern_name: string
          source_video?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          niche?: string | null
          pattern_json?: Json | null
          pattern_name?: string
          source_video?: string | null
        }
        Relationships: []
      }
      viral_titles_db: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          country: string | null
          created_at: string | null
          duration_seconds: number | null
          emotional_triggers: string[] | null
          id: string
          language: string | null
          likes: number | null
          niche: string | null
          published_at: string | null
          seo_score: number | null
          title: string
          title_pattern: string | null
          views: number
          why_viral: string | null
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          country?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          emotional_triggers?: string[] | null
          id?: string
          language?: string | null
          likes?: number | null
          niche?: string | null
          published_at?: string | null
          seo_score?: number | null
          title: string
          title_pattern?: string | null
          views?: number
          why_viral?: string | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          country?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          emotional_triggers?: string[] | null
          id?: string
          language?: string | null
          likes?: number | null
          niche?: string | null
          published_at?: string | null
          seo_score?: number | null
          title?: string
          title_pattern?: string | null
          views?: number
          why_viral?: string | null
        }
        Relationships: []
      }
      youtube_keywords: {
        Row: {
          best_title_patterns: Json | null
          competition: string | null
          created_at: string | null
          ctr_estimate: number | null
          id: string
          keyword: string
          language: string | null
          niche: string | null
          related_keywords: Json | null
          search_volume: string | null
          trend: string | null
        }
        Insert: {
          best_title_patterns?: Json | null
          competition?: string | null
          created_at?: string | null
          ctr_estimate?: number | null
          id?: string
          keyword: string
          language?: string | null
          niche?: string | null
          related_keywords?: Json | null
          search_volume?: string | null
          trend?: string | null
        }
        Update: {
          best_title_patterns?: Json | null
          competition?: string | null
          created_at?: string | null
          ctr_estimate?: number | null
          id?: string
          keyword?: string
          language?: string | null
          niche?: string | null
          related_keywords?: Json | null
          search_volume?: string | null
          trend?: string | null
        }
        Relationships: []
      }
      youtube_knowledge: {
        Row: {
          category: string
          content: string
          created_at: string | null
          id: string
          priority: number | null
          source: string | null
          tags: Json | null
          title: string
        }
        Insert: {
          category: string
          content: string
          created_at?: string | null
          id?: string
          priority?: number | null
          source?: string | null
          tags?: Json | null
          title: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string | null
          id?: string
          priority?: number | null
          source?: string | null
          tags?: Json | null
          title?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_and_increment_api_usage: {
        Args: { _api_name: string }
        Returns: boolean
      }
      consume_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
      get_user_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
    }
    Enums: {
      subscription_tier: "starter" | "pro" | "full"
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
      subscription_tier: ["starter", "pro", "full"],
    },
  },
} as const
