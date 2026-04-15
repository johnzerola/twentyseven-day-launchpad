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
          user_id: string | null
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
          user_id?: string | null
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
          user_id?: string | null
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
      attention_curves: {
        Row: {
          avg_retention: number | null
          best_for: string | null
          created_at: string | null
          curve_data: Json
          curve_name: string
          duration_minutes: number | null
          id: string
          niche: string | null
          source: string | null
          video_type: string
        }
        Insert: {
          avg_retention?: number | null
          best_for?: string | null
          created_at?: string | null
          curve_data?: Json
          curve_name: string
          duration_minutes?: number | null
          id?: string
          niche?: string | null
          source?: string | null
          video_type?: string
        }
        Update: {
          avg_retention?: number | null
          best_for?: string | null
          created_at?: string | null
          curve_data?: Json
          curve_name?: string
          duration_minutes?: number | null
          id?: string
          niche?: string | null
          source?: string | null
          video_type?: string
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
      attention_library: {
        Row: {
          attention_score: number
          created_at: string | null
          curiosity_gap_score: number | null
          drop_off_risk: string | null
          emotion: string | null
          emotional_intensity: number | null
          example_text: string | null
          example_videos: Json | null
          id: string
          information_density: number | null
          language: string | null
          niche: string | null
          novelty_score: number | null
          pattern_name: string
          recovery_technique: string | null
          retention_score: number | null
          scene_duration_sec: number | null
          scene_type: string
          source: string | null
          time_window: string | null
          visual_change: number | null
        }
        Insert: {
          attention_score?: number
          created_at?: string | null
          curiosity_gap_score?: number | null
          drop_off_risk?: string | null
          emotion?: string | null
          emotional_intensity?: number | null
          example_text?: string | null
          example_videos?: Json | null
          id?: string
          information_density?: number | null
          language?: string | null
          niche?: string | null
          novelty_score?: number | null
          pattern_name: string
          recovery_technique?: string | null
          retention_score?: number | null
          scene_duration_sec?: number | null
          scene_type?: string
          source?: string | null
          time_window?: string | null
          visual_change?: number | null
        }
        Update: {
          attention_score?: number
          created_at?: string | null
          curiosity_gap_score?: number | null
          drop_off_risk?: string | null
          emotion?: string | null
          emotional_intensity?: number | null
          example_text?: string | null
          example_videos?: Json | null
          id?: string
          information_density?: number | null
          language?: string | null
          niche?: string | null
          novelty_score?: number | null
          pattern_name?: string
          recovery_technique?: string | null
          retention_score?: number | null
          scene_duration_sec?: number | null
          scene_type?: string
          source?: string | null
          time_window?: string | null
          visual_change?: number | null
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
      case_studies: {
        Row: {
          channel_name: string
          created_at: string | null
          days_to_monetization: number | null
          end_date: string | null
          final_subscribers: number | null
          id: string
          initial_subscribers: number | null
          is_public: boolean | null
          lessons_learned: string[] | null
          milestones: Json | null
          monetized_at: string | null
          niche: string | null
          revenue_estimate: number | null
          screenshots: Json | null
          start_date: string | null
          strategy_used: string | null
          tools_used: string[] | null
          total_shorts: number | null
          total_videos: number | null
          total_views: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_name: string
          created_at?: string | null
          days_to_monetization?: number | null
          end_date?: string | null
          final_subscribers?: number | null
          id?: string
          initial_subscribers?: number | null
          is_public?: boolean | null
          lessons_learned?: string[] | null
          milestones?: Json | null
          monetized_at?: string | null
          niche?: string | null
          revenue_estimate?: number | null
          screenshots?: Json | null
          start_date?: string | null
          strategy_used?: string | null
          tools_used?: string[] | null
          total_shorts?: number | null
          total_videos?: number | null
          total_views?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_name?: string
          created_at?: string | null
          days_to_monetization?: number | null
          end_date?: string | null
          final_subscribers?: number | null
          id?: string
          initial_subscribers?: number | null
          is_public?: boolean | null
          lessons_learned?: string[] | null
          milestones?: Json | null
          monetized_at?: string | null
          niche?: string | null
          revenue_estimate?: number | null
          screenshots?: Json | null
          start_date?: string | null
          strategy_used?: string | null
          tools_used?: string[] | null
          total_shorts?: number | null
          total_videos?: number | null
          total_views?: number | null
          updated_at?: string | null
          user_id?: string
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
          content_category: string | null
          country: string
          created_at: string | null
          growth_rate: string
          id: string
          impact_tier: string | null
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
          content_category?: string | null
          country?: string
          created_at?: string | null
          growth_rate?: string
          id?: string
          impact_tier?: string | null
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
          content_category?: string | null
          country?: string
          created_at?: string | null
          growth_rate?: string
          id?: string
          impact_tier?: string | null
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
      channel_styles: {
        Row: {
          channel_id: string | null
          color_palette: Json | null
          created_at: string
          id: string
          is_default: boolean | null
          reference_images: Json | null
          style_description: string | null
          style_name: string
          updated_at: string
          user_id: string
          visual_notes: string | null
        }
        Insert: {
          channel_id?: string | null
          color_palette?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          reference_images?: Json | null
          style_description?: string | null
          style_name: string
          updated_at?: string
          user_id: string
          visual_notes?: string | null
        }
        Update: {
          channel_id?: string | null
          color_palette?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          reference_images?: Json | null
          style_description?: string | null
          style_name?: string
          updated_at?: string
          user_id?: string
          visual_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_styles_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "user_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_voice_profiles: {
        Row: {
          average_video_length: number | null
          avg_sentence_length: number | null
          channel_id: string | null
          common_hooks: string[] | null
          created_at: string | null
          id: string
          last_analyzed_at: string | null
          sample_scripts_analyzed: number | null
          story_structure: string | null
          style_markers: string[] | null
          tone_keywords: string[] | null
          user_id: string
          visual_style: string | null
          vocabulary_richness: number | null
          voice_signature: Json | null
        }
        Insert: {
          average_video_length?: number | null
          avg_sentence_length?: number | null
          channel_id?: string | null
          common_hooks?: string[] | null
          created_at?: string | null
          id?: string
          last_analyzed_at?: string | null
          sample_scripts_analyzed?: number | null
          story_structure?: string | null
          style_markers?: string[] | null
          tone_keywords?: string[] | null
          user_id: string
          visual_style?: string | null
          vocabulary_richness?: number | null
          voice_signature?: Json | null
        }
        Update: {
          average_video_length?: number | null
          avg_sentence_length?: number | null
          channel_id?: string | null
          common_hooks?: string[] | null
          created_at?: string | null
          id?: string
          last_analyzed_at?: string | null
          sample_scripts_analyzed?: number | null
          story_structure?: string | null
          style_markers?: string[] | null
          tone_keywords?: string[] | null
          user_id?: string
          visual_style?: string | null
          vocabulary_richness?: number | null
          voice_signature?: Json | null
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
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_dna: {
        Row: {
          attention_score: number | null
          channel_id: string | null
          channel_name: string | null
          cliffhanger_count: number | null
          content_model: string | null
          created_at: string | null
          curiosity_score: number | null
          dopamine_score: number | null
          duration_seconds: number | null
          emotion_primary: string | null
          emotion_secondary: string | null
          emotional_arc: Json | null
          estimated_retention: number | null
          gold_score: number | null
          hook_pattern: string | null
          hook_strength: number | null
          hook_type: string | null
          id: string
          language: string | null
          multiplier: number | null
          narrative_arc: Json | null
          niche: string | null
          open_loop_count: number | null
          pacing: string | null
          psychological_triggers: string[] | null
          quality_tier: string | null
          replication_template: string | null
          retention_hooks: Json | null
          source: string | null
          story_structure: string | null
          subscribers: number | null
          thumbnail_pattern: string | null
          title_emotion: string | null
          title_structure: string | null
          title_uses_numbers: boolean | null
          title_uses_questions: boolean | null
          video_id: string
          video_title: string
          video_type: string | null
          views: number | null
          viral_score: number | null
          visual_style: string | null
          why_viral: string | null
        }
        Insert: {
          attention_score?: number | null
          channel_id?: string | null
          channel_name?: string | null
          cliffhanger_count?: number | null
          content_model?: string | null
          created_at?: string | null
          curiosity_score?: number | null
          dopamine_score?: number | null
          duration_seconds?: number | null
          emotion_primary?: string | null
          emotion_secondary?: string | null
          emotional_arc?: Json | null
          estimated_retention?: number | null
          gold_score?: number | null
          hook_pattern?: string | null
          hook_strength?: number | null
          hook_type?: string | null
          id?: string
          language?: string | null
          multiplier?: number | null
          narrative_arc?: Json | null
          niche?: string | null
          open_loop_count?: number | null
          pacing?: string | null
          psychological_triggers?: string[] | null
          quality_tier?: string | null
          replication_template?: string | null
          retention_hooks?: Json | null
          source?: string | null
          story_structure?: string | null
          subscribers?: number | null
          thumbnail_pattern?: string | null
          title_emotion?: string | null
          title_structure?: string | null
          title_uses_numbers?: boolean | null
          title_uses_questions?: boolean | null
          video_id: string
          video_title?: string
          video_type?: string | null
          views?: number | null
          viral_score?: number | null
          visual_style?: string | null
          why_viral?: string | null
        }
        Update: {
          attention_score?: number | null
          channel_id?: string | null
          channel_name?: string | null
          cliffhanger_count?: number | null
          content_model?: string | null
          created_at?: string | null
          curiosity_score?: number | null
          dopamine_score?: number | null
          duration_seconds?: number | null
          emotion_primary?: string | null
          emotion_secondary?: string | null
          emotional_arc?: Json | null
          estimated_retention?: number | null
          gold_score?: number | null
          hook_pattern?: string | null
          hook_strength?: number | null
          hook_type?: string | null
          id?: string
          language?: string | null
          multiplier?: number | null
          narrative_arc?: Json | null
          niche?: string | null
          open_loop_count?: number | null
          pacing?: string | null
          psychological_triggers?: string[] | null
          quality_tier?: string | null
          replication_template?: string | null
          retention_hooks?: Json | null
          source?: string | null
          story_structure?: string | null
          subscribers?: number | null
          thumbnail_pattern?: string | null
          title_emotion?: string | null
          title_structure?: string | null
          title_uses_numbers?: boolean | null
          title_uses_questions?: boolean | null
          video_id?: string
          video_title?: string
          video_type?: string | null
          views?: number | null
          viral_score?: number | null
          visual_style?: string | null
          why_viral?: string | null
        }
        Relationships: []
      }
      content_models: {
        Row: {
          best_for_duration: string | null
          best_for_niches: Json | null
          created_at: string | null
          description: string
          effectiveness_score: number | null
          examples: Json | null
          hook_pattern: string
          id: string
          model_name: string
          model_type: string
          pacing_guide: string
          retention_profile: Json
          source: string | null
          structure_json: Json
          video_type: Database["public"]["Enums"]["video_type"]
        }
        Insert: {
          best_for_duration?: string | null
          best_for_niches?: Json | null
          created_at?: string | null
          description?: string
          effectiveness_score?: number | null
          examples?: Json | null
          hook_pattern?: string
          id?: string
          model_name: string
          model_type?: string
          pacing_guide?: string
          retention_profile?: Json
          source?: string | null
          structure_json?: Json
          video_type?: Database["public"]["Enums"]["video_type"]
        }
        Update: {
          best_for_duration?: string | null
          best_for_niches?: Json | null
          created_at?: string | null
          description?: string
          effectiveness_score?: number | null
          examples?: Json | null
          hook_pattern?: string
          id?: string
          model_name?: string
          model_type?: string
          pacing_guide?: string
          retention_profile?: Json
          source?: string | null
          structure_json?: Json
          video_type?: Database["public"]["Enums"]["video_type"]
        }
        Relationships: []
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
          video_type: Database["public"]["Enums"]["video_type"]
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
          video_type?: Database["public"]["Enums"]["video_type"]
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
          video_type?: Database["public"]["Enums"]["video_type"]
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
      content_series: {
        Row: {
          auto_generate: boolean | null
          channel_id: string | null
          content_style: string
          created_at: string | null
          custom_prompt: string | null
          frequency: string
          id: string
          language: string
          niche: string
          series_name: string
          settings_json: Json | null
          status: string
          sub_niche: string | null
          total_generated: number | null
          total_published: number | null
          updated_at: string | null
          user_id: string
          video_format: string
          visual_style: string
        }
        Insert: {
          auto_generate?: boolean | null
          channel_id?: string | null
          content_style?: string
          created_at?: string | null
          custom_prompt?: string | null
          frequency?: string
          id?: string
          language?: string
          niche?: string
          series_name: string
          settings_json?: Json | null
          status?: string
          sub_niche?: string | null
          total_generated?: number | null
          total_published?: number | null
          updated_at?: string | null
          user_id: string
          video_format?: string
          visual_style?: string
        }
        Update: {
          auto_generate?: boolean | null
          channel_id?: string | null
          content_style?: string
          created_at?: string | null
          custom_prompt?: string | null
          frequency?: string
          id?: string
          language?: string
          niche?: string
          series_name?: string
          settings_json?: Json | null
          status?: string
          sub_niche?: string | null
          total_generated?: number | null
          total_published?: number | null
          updated_at?: string | null
          user_id?: string
          video_format?: string
          visual_style?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_series_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "user_channels"
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
      content_thesis: {
        Row: {
          actual_ctr: number | null
          actual_retention: number | null
          actual_views: number | null
          angle: string | null
          channel_id: string | null
          confidence_score: number | null
          created_at: string
          evidence_json: Json | null
          expires_at: string | null
          format: string | null
          freshness_score: number | null
          id: string
          monetization_result_json: Json | null
          niche: string | null
          originality_notes: string | null
          originality_risk: number | null
          packaging_notes: string | null
          saturation_risk: number | null
          script_id: string | null
          source_notes: string | null
          status: string | null
          thesis_text: string
          thumbnail_prompt_ids: string[] | null
          title_ids: string[] | null
          updated_at: string
          user_id: string
          video_project_id: string | null
          why_now: string | null
          youtube_video_id: string | null
        }
        Insert: {
          actual_ctr?: number | null
          actual_retention?: number | null
          actual_views?: number | null
          angle?: string | null
          channel_id?: string | null
          confidence_score?: number | null
          created_at?: string
          evidence_json?: Json | null
          expires_at?: string | null
          format?: string | null
          freshness_score?: number | null
          id?: string
          monetization_result_json?: Json | null
          niche?: string | null
          originality_notes?: string | null
          originality_risk?: number | null
          packaging_notes?: string | null
          saturation_risk?: number | null
          script_id?: string | null
          source_notes?: string | null
          status?: string | null
          thesis_text: string
          thumbnail_prompt_ids?: string[] | null
          title_ids?: string[] | null
          updated_at?: string
          user_id: string
          video_project_id?: string | null
          why_now?: string | null
          youtube_video_id?: string | null
        }
        Update: {
          actual_ctr?: number | null
          actual_retention?: number | null
          actual_views?: number | null
          angle?: string | null
          channel_id?: string | null
          confidence_score?: number | null
          created_at?: string
          evidence_json?: Json | null
          expires_at?: string | null
          format?: string | null
          freshness_score?: number | null
          id?: string
          monetization_result_json?: Json | null
          niche?: string | null
          originality_notes?: string | null
          originality_risk?: number | null
          packaging_notes?: string | null
          saturation_risk?: number | null
          script_id?: string | null
          source_notes?: string | null
          status?: string | null
          thesis_text?: string
          thumbnail_prompt_ids?: string[] | null
          title_ids?: string[] | null
          updated_at?: string
          user_id?: string
          video_project_id?: string | null
          why_now?: string | null
          youtube_video_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_thesis_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "user_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_thesis_video_project_id_fkey"
            columns: ["video_project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_adaptive_plan: {
        Row: {
          adaptation_reason: string | null
          ai_adaptation_notes: string | null
          ai_adapted: boolean | null
          channel_id: string | null
          completed_tasks: number | null
          completion_pct: number | null
          created_at: string | null
          generated_based_on: string | null
          id: string
          plan_date: string
          tasks: Json
          total_tasks: number | null
          updated_at: string | null
          user_id: string
          week_number: number
          yesterday_performance: Json | null
        }
        Insert: {
          adaptation_reason?: string | null
          ai_adaptation_notes?: string | null
          ai_adapted?: boolean | null
          channel_id?: string | null
          completed_tasks?: number | null
          completion_pct?: number | null
          created_at?: string | null
          generated_based_on?: string | null
          id?: string
          plan_date: string
          tasks?: Json
          total_tasks?: number | null
          updated_at?: string | null
          user_id: string
          week_number: number
          yesterday_performance?: Json | null
        }
        Update: {
          adaptation_reason?: string | null
          ai_adaptation_notes?: string | null
          ai_adapted?: boolean | null
          channel_id?: string | null
          completed_tasks?: number | null
          completion_pct?: number | null
          created_at?: string | null
          generated_based_on?: string | null
          id?: string
          plan_date?: string
          tasks?: Json
          total_tasks?: number | null
          updated_at?: string | null
          user_id?: string
          week_number?: number
          yesterday_performance?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_adaptive_plan_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "user_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_tasks: {
        Row: {
          actual_subs: number | null
          actual_views: number | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          day_number: number
          description: string | null
          id: string
          metadata: Json | null
          notes: string | null
          plan_id: string | null
          target_longs: number | null
          target_shorts: number | null
          target_subs: number | null
          target_views: number | null
          task_type: string
          title: string
          updated_at: string | null
          user_id: string
          video_type: string | null
        }
        Insert: {
          actual_subs?: number | null
          actual_views?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          day_number: number
          description?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          plan_id?: string | null
          target_longs?: number | null
          target_shorts?: number | null
          target_subs?: number | null
          target_views?: number | null
          task_type?: string
          title: string
          updated_at?: string | null
          user_id: string
          video_type?: string | null
        }
        Update: {
          actual_subs?: number | null
          actual_views?: number | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          day_number?: number
          description?: string | null
          id?: string
          metadata?: Json | null
          notes?: string | null
          plan_id?: string | null
          target_longs?: number | null
          target_shorts?: number | null
          target_subs?: number | null
          target_views?: number | null
          task_type?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          video_type?: string | null
        }
        Relationships: []
      }
      dotti_suggestions: {
        Row: {
          channel_id: string | null
          confidence: number | null
          content: string
          content_thesis_id: string | null
          created_at: string
          evidence_json: Json | null
          expires_at: string | null
          format: string | null
          freshness_score: number | null
          id: string
          language: string | null
          monetization_angle: string | null
          niche: string | null
          originality_risk: number | null
          production_effort: string | null
          style: string | null
          suggestion_type: string | null
          title: string
          topic: string | null
          updated_at: string
          used_count: number | null
          user_id: string
          why_now: string | null
        }
        Insert: {
          channel_id?: string | null
          confidence?: number | null
          content: string
          content_thesis_id?: string | null
          created_at?: string
          evidence_json?: Json | null
          expires_at?: string | null
          format?: string | null
          freshness_score?: number | null
          id?: string
          language?: string | null
          monetization_angle?: string | null
          niche?: string | null
          originality_risk?: number | null
          production_effort?: string | null
          style?: string | null
          suggestion_type?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          used_count?: number | null
          user_id: string
          why_now?: string | null
        }
        Update: {
          channel_id?: string | null
          confidence?: number | null
          content?: string
          content_thesis_id?: string | null
          created_at?: string
          evidence_json?: Json | null
          expires_at?: string | null
          format?: string | null
          freshness_score?: number | null
          id?: string
          language?: string | null
          monetization_angle?: string | null
          niche?: string | null
          originality_risk?: number | null
          production_effort?: string | null
          style?: string | null
          suggestion_type?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          used_count?: number | null
          user_id?: string
          why_now?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dotti_suggestions_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "user_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dotti_suggestions_content_thesis_id_fkey"
            columns: ["content_thesis_id"]
            isOneToOne: false
            referencedRelation: "content_thesis"
            referencedColumns: ["id"]
          },
        ]
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
      emerging_videos: {
        Row: {
          channel_id: string | null
          channel_name: string | null
          comments: number | null
          confirmed_viral_at: string | null
          created_at: string | null
          detected_at: string | null
          duration_seconds: number | null
          engagement_rate: number | null
          growth_acceleration: number | null
          id: string
          likes: number | null
          metadata: Json | null
          niche: string | null
          peak_views: number | null
          pre_viral_score: number | null
          published_at: string | null
          recency_factor: number | null
          snapshots_count: number | null
          status: string | null
          subscribers: number | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          velocity_score: number | null
          video_id: string
          view_ratio: number | null
          views: number | null
          views_per_hour: number | null
        }
        Insert: {
          channel_id?: string | null
          channel_name?: string | null
          comments?: number | null
          confirmed_viral_at?: string | null
          created_at?: string | null
          detected_at?: string | null
          duration_seconds?: number | null
          engagement_rate?: number | null
          growth_acceleration?: number | null
          id?: string
          likes?: number | null
          metadata?: Json | null
          niche?: string | null
          peak_views?: number | null
          pre_viral_score?: number | null
          published_at?: string | null
          recency_factor?: number | null
          snapshots_count?: number | null
          status?: string | null
          subscribers?: number | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          velocity_score?: number | null
          video_id: string
          view_ratio?: number | null
          views?: number | null
          views_per_hour?: number | null
        }
        Update: {
          channel_id?: string | null
          channel_name?: string | null
          comments?: number | null
          confirmed_viral_at?: string | null
          created_at?: string | null
          detected_at?: string | null
          duration_seconds?: number | null
          engagement_rate?: number | null
          growth_acceleration?: number | null
          id?: string
          likes?: number | null
          metadata?: Json | null
          niche?: string | null
          peak_views?: number | null
          pre_viral_score?: number | null
          published_at?: string | null
          recency_factor?: number | null
          snapshots_count?: number | null
          status?: string | null
          subscribers?: number | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          velocity_score?: number | null
          video_id?: string
          view_ratio?: number | null
          views?: number | null
          views_per_hour?: number | null
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
      global_characters: {
        Row: {
          age: number | null
          appearance: Json | null
          clothing: Json | null
          created_at: string | null
          facial_features: Json | null
          gender: string | null
          id: string
          is_main_character: boolean | null
          name: string
          personality: string[] | null
          photo_url: string | null
          role: string | null
          updated_at: string | null
          usage_count: number | null
          user_id: string
          visual_description: string | null
        }
        Insert: {
          age?: number | null
          appearance?: Json | null
          clothing?: Json | null
          created_at?: string | null
          facial_features?: Json | null
          gender?: string | null
          id?: string
          is_main_character?: boolean | null
          name: string
          personality?: string[] | null
          photo_url?: string | null
          role?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id: string
          visual_description?: string | null
        }
        Update: {
          age?: number | null
          appearance?: Json | null
          clothing?: Json | null
          created_at?: string | null
          facial_features?: Json | null
          gender?: string | null
          id?: string
          is_main_character?: boolean | null
          name?: string
          personality?: string[] | null
          photo_url?: string | null
          role?: string | null
          updated_at?: string | null
          usage_count?: number | null
          user_id?: string
          visual_description?: string | null
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
      hook_patterns: {
        Row: {
          avg_retention_boost: number | null
          best_for_niches: Json | null
          best_for_video_type: Database["public"]["Enums"]["video_type"] | null
          created_at: string | null
          effectiveness_score: number | null
          example_hooks: Json | null
          id: string
          pattern_name: string
          pattern_type: string
          psychology_trigger: string | null
          source: string | null
          template: string
        }
        Insert: {
          avg_retention_boost?: number | null
          best_for_niches?: Json | null
          best_for_video_type?: Database["public"]["Enums"]["video_type"] | null
          created_at?: string | null
          effectiveness_score?: number | null
          example_hooks?: Json | null
          id?: string
          pattern_name: string
          pattern_type?: string
          psychology_trigger?: string | null
          source?: string | null
          template?: string
        }
        Update: {
          avg_retention_boost?: number | null
          best_for_niches?: Json | null
          best_for_video_type?: Database["public"]["Enums"]["video_type"] | null
          created_at?: string | null
          effectiveness_score?: number | null
          example_hooks?: Json | null
          id?: string
          pattern_name?: string
          pattern_type?: string
          psychology_trigger?: string | null
          source?: string | null
          template?: string
        }
        Relationships: []
      }
      knowledge_embeddings: {
        Row: {
          content_text: string
          created_at: string | null
          embedding: string | null
          id: string
          metadata: Json | null
          source_id: string
          source_table: string
        }
        Insert: {
          content_text: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id: string
          source_table: string
        }
        Update: {
          content_text?: string
          created_at?: string | null
          embedding?: string | null
          id?: string
          metadata?: Json | null
          source_id?: string
          source_table?: string
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
      monetization_30day_plans: {
        Row: {
          channel_id: string | null
          country: string | null
          created_at: string | null
          current_day: number | null
          id: string
          language: string | null
          niche: string | null
          plan_json: Json | null
          started_at: string | null
          status: string | null
          strategy: string | null
          target_subs: number | null
          target_watch_hours: number | null
          total_longs_published: number | null
          total_shorts_published: number | null
          total_views: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          channel_id?: string | null
          country?: string | null
          created_at?: string | null
          current_day?: number | null
          id?: string
          language?: string | null
          niche?: string | null
          plan_json?: Json | null
          started_at?: string | null
          status?: string | null
          strategy?: string | null
          target_subs?: number | null
          target_watch_hours?: number | null
          total_longs_published?: number | null
          total_shorts_published?: number | null
          total_views?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          channel_id?: string | null
          country?: string | null
          created_at?: string | null
          current_day?: number | null
          id?: string
          language?: string | null
          niche?: string | null
          plan_json?: Json | null
          started_at?: string | null
          status?: string | null
          strategy?: string | null
          target_subs?: number | null
          target_watch_hours?: number | null
          total_longs_published?: number | null
          total_shorts_published?: number | null
          total_views?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      monetization_knowledge_base: {
        Row: {
          confidence_score: number | null
          content: string
          country_code: string | null
          created_at: string | null
          data_json: Json | null
          embedding: string | null
          id: string
          last_updated: string | null
          niche: string | null
          source: string | null
          title: string
          topic: string
        }
        Insert: {
          confidence_score?: number | null
          content: string
          country_code?: string | null
          created_at?: string | null
          data_json?: Json | null
          embedding?: string | null
          id?: string
          last_updated?: string | null
          niche?: string | null
          source?: string | null
          title: string
          topic: string
        }
        Update: {
          confidence_score?: number | null
          content?: string
          country_code?: string | null
          created_at?: string | null
          data_json?: Json | null
          embedding?: string | null
          id?: string
          last_updated?: string | null
          niche?: string | null
          source?: string | null
          title?: string
          topic?: string
        }
        Relationships: []
      }
      monetization_milestones: {
        Row: {
          created_at: string | null
          current_value: number | null
          day_expected: number | null
          description: string | null
          icon: string | null
          id: string
          milestone_type: string
          plan_id: string | null
          reached: boolean | null
          reached_at: string | null
          target_value: number
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number | null
          day_expected?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          milestone_type: string
          plan_id?: string | null
          reached?: boolean | null
          reached_at?: string | null
          target_value?: number
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number | null
          day_expected?: number | null
          description?: string | null
          icon?: string | null
          id?: string
          milestone_type?: string
          plan_id?: string | null
          reached?: boolean | null
          reached_at?: string | null
          target_value?: number
          title?: string
          user_id?: string
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
      niche_score_benchmarks: {
        Row: {
          avg_score: number | null
          id: string
          min_passing_score: number | null
          niche: string
          top_techniques: string[] | null
          total_scripts_scored: number | null
          updated_at: string | null
        }
        Insert: {
          avg_score?: number | null
          id?: string
          min_passing_score?: number | null
          niche: string
          top_techniques?: string[] | null
          total_scripts_scored?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_score?: number | null
          id?: string
          min_passing_score?: number | null
          niche?: string
          top_techniques?: string[] | null
          total_scripts_scored?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      niche_skill_templates: {
        Row: {
          created_at: string | null
          display_name: string
          effectiveness_score: number | null
          emotional_arc_template: string | null
          example_hooks: string[] | null
          forbidden_patterns: string[] | null
          hook_guidelines: string | null
          id: string
          is_active: boolean | null
          niche: string
          pacing_notes: string | null
          style: string
          system_prompt_addition: string | null
          tone_rules: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_name: string
          effectiveness_score?: number | null
          emotional_arc_template?: string | null
          example_hooks?: string[] | null
          forbidden_patterns?: string[] | null
          hook_guidelines?: string | null
          id?: string
          is_active?: boolean | null
          niche: string
          pacing_notes?: string | null
          style?: string
          system_prompt_addition?: string | null
          tone_rules?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_name?: string
          effectiveness_score?: number | null
          emotional_arc_template?: string | null
          example_hooks?: string[] | null
          forbidden_patterns?: string[] | null
          hook_guidelines?: string | null
          id?: string
          is_active?: boolean | null
          niche?: string
          pacing_notes?: string | null
          style?: string
          system_prompt_addition?: string | null
          tone_rules?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      niche_velocity: {
        Row: {
          avg_views_per_video: number | null
          growth_velocity: number | null
          id: string
          metadata: Json | null
          new_channels_30d: number | null
          niche: string
          opportunity_window: string | null
          saturation_score: number | null
          snapshot_date: string
          top_video_views: number | null
          total_channels: number | null
          total_videos_30d: number | null
        }
        Insert: {
          avg_views_per_video?: number | null
          growth_velocity?: number | null
          id?: string
          metadata?: Json | null
          new_channels_30d?: number | null
          niche: string
          opportunity_window?: string | null
          saturation_score?: number | null
          snapshot_date?: string
          top_video_views?: number | null
          total_channels?: number | null
          total_videos_30d?: number | null
        }
        Update: {
          avg_views_per_video?: number | null
          growth_velocity?: number | null
          id?: string
          metadata?: Json | null
          new_channels_30d?: number | null
          niche?: string
          opportunity_window?: string | null
          saturation_score?: number | null
          snapshot_date?: string
          top_video_views?: number | null
          total_channels?: number | null
          total_videos_30d?: number | null
        }
        Relationships: []
      }
      oauth_state_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          nonce: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          nonce: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          nonce?: string
          user_id?: string
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
      output_performance_feedback: {
        Row: {
          actual_ctr: number | null
          actual_retention: number | null
          actual_views: number | null
          created_at: string | null
          format: string | null
          id: string
          language: string | null
          niche: string | null
          output_content: string | null
          output_type: string
          predicted_ctr: number | null
          predicted_retention: number | null
          prediction_error_ctr: number | null
          prediction_error_retention: number | null
          script_id: string | null
          updated_at: string | null
          user_id: string
          youtube_video_id: string | null
        }
        Insert: {
          actual_ctr?: number | null
          actual_retention?: number | null
          actual_views?: number | null
          created_at?: string | null
          format?: string | null
          id?: string
          language?: string | null
          niche?: string | null
          output_content?: string | null
          output_type: string
          predicted_ctr?: number | null
          predicted_retention?: number | null
          prediction_error_ctr?: number | null
          prediction_error_retention?: number | null
          script_id?: string | null
          updated_at?: string | null
          user_id: string
          youtube_video_id?: string | null
        }
        Update: {
          actual_ctr?: number | null
          actual_retention?: number | null
          actual_views?: number | null
          created_at?: string | null
          format?: string | null
          id?: string
          language?: string | null
          niche?: string | null
          output_content?: string | null
          output_type?: string
          predicted_ctr?: number | null
          predicted_retention?: number | null
          prediction_error_ctr?: number | null
          prediction_error_retention?: number | null
          script_id?: string | null
          updated_at?: string | null
          user_id?: string
          youtube_video_id?: string | null
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
      prediction_vs_result: {
        Row: {
          calibrated_at: string | null
          created_at: string | null
          error_breakdown: Json | null
          hook_type: string | null
          id: string
          niche: string | null
          predicted_attention_score: number | null
          predicted_ctr: number | null
          predicted_dopamine_score: number | null
          predicted_engagement: number | null
          predicted_retention: number | null
          predicted_viral_score: number | null
          prediction_error_score: number | null
          project_id: string | null
          real_comments: number | null
          real_ctr: number | null
          real_engagement_rate: number | null
          real_likes: number | null
          real_retention: number | null
          real_subscribers_at_publish: number | null
          real_view_velocity: number | null
          real_views: number | null
          title_pattern: string | null
          updated_at: string | null
          user_id: string
          video_id: string
          video_type: string | null
        }
        Insert: {
          calibrated_at?: string | null
          created_at?: string | null
          error_breakdown?: Json | null
          hook_type?: string | null
          id?: string
          niche?: string | null
          predicted_attention_score?: number | null
          predicted_ctr?: number | null
          predicted_dopamine_score?: number | null
          predicted_engagement?: number | null
          predicted_retention?: number | null
          predicted_viral_score?: number | null
          prediction_error_score?: number | null
          project_id?: string | null
          real_comments?: number | null
          real_ctr?: number | null
          real_engagement_rate?: number | null
          real_likes?: number | null
          real_retention?: number | null
          real_subscribers_at_publish?: number | null
          real_view_velocity?: number | null
          real_views?: number | null
          title_pattern?: string | null
          updated_at?: string | null
          user_id: string
          video_id: string
          video_type?: string | null
        }
        Update: {
          calibrated_at?: string | null
          created_at?: string | null
          error_breakdown?: Json | null
          hook_type?: string | null
          id?: string
          niche?: string | null
          predicted_attention_score?: number | null
          predicted_ctr?: number | null
          predicted_dopamine_score?: number | null
          predicted_engagement?: number | null
          predicted_retention?: number | null
          predicted_viral_score?: number | null
          prediction_error_score?: number | null
          project_id?: string | null
          real_comments?: number | null
          real_ctr?: number | null
          real_engagement_rate?: number | null
          real_likes?: number | null
          real_retention?: number | null
          real_subscribers_at_publish?: number | null
          real_view_velocity?: number | null
          real_views?: number | null
          title_pattern?: string | null
          updated_at?: string | null
          user_id?: string
          video_id?: string
          video_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prediction_vs_result_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      processing_jobs: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string
          current_step: string | null
          error_message: string | null
          id: string
          input_data: Json
          job_type: string
          max_attempts: number | null
          progress: number | null
          result_data: Json | null
          started_at: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json
          job_type?: string
          max_attempts?: number | null
          progress?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string
          current_step?: string | null
          error_message?: string | null
          id?: string
          input_data?: Json
          job_type?: string
          max_attempts?: number | null
          progress?: number | null
          result_data?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
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
      prompt_library: {
        Row: {
          created_at: string | null
          id: string
          project_id: string | null
          prompt_text: string
          quality_score: number | null
          scene_type: string | null
          style: string | null
          tags: string[] | null
          user_id: string
          video_style: string | null
          word_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          prompt_text: string
          quality_score?: number | null
          scene_type?: string | null
          style?: string | null
          tags?: string[] | null
          user_id: string
          video_style?: string | null
          word_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          project_id?: string | null
          prompt_text?: string
          quality_score?: number | null
          scene_type?: string | null
          style?: string | null
          tags?: string[] | null
          user_id?: string
          video_style?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      prompt_performance: {
        Row: {
          camera_angle: string | null
          coherence_rating: number | null
          color_grading: string | null
          created_at: string | null
          id: string
          lighting: string | null
          niche: string | null
          project_id: string | null
          prompt_text: string
          quality_rating: number | null
          scene_index: number
          tags: string[] | null
          updated_at: string | null
          user_feedback: string | null
          user_id: string
          visual_style: string | null
        }
        Insert: {
          camera_angle?: string | null
          coherence_rating?: number | null
          color_grading?: string | null
          created_at?: string | null
          id?: string
          lighting?: string | null
          niche?: string | null
          project_id?: string | null
          prompt_text: string
          quality_rating?: number | null
          scene_index: number
          tags?: string[] | null
          updated_at?: string | null
          user_feedback?: string | null
          user_id: string
          visual_style?: string | null
        }
        Update: {
          camera_angle?: string | null
          coherence_rating?: number | null
          color_grading?: string | null
          created_at?: string | null
          id?: string
          lighting?: string | null
          niche?: string | null
          project_id?: string | null
          prompt_text?: string
          quality_rating?: number | null
          scene_index?: number
          tags?: string[] | null
          updated_at?: string | null
          user_feedback?: string | null
          user_id?: string
          visual_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prompt_performance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
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
      reference_channels: {
        Row: {
          avg_views: number | null
          channel_name: string
          content_format: string | null
          country: string | null
          created_at: string | null
          estimated_revenue_max: number | null
          estimated_revenue_min: number | null
          id: string
          is_faceless: boolean | null
          language: string | null
          niche: string
          subscribers: number | null
          top_videos: Json | null
          visual_style: string | null
          youtube_channel_id: string | null
          youtube_handle: string | null
        }
        Insert: {
          avg_views?: number | null
          channel_name: string
          content_format?: string | null
          country?: string | null
          created_at?: string | null
          estimated_revenue_max?: number | null
          estimated_revenue_min?: number | null
          id?: string
          is_faceless?: boolean | null
          language?: string | null
          niche?: string
          subscribers?: number | null
          top_videos?: Json | null
          visual_style?: string | null
          youtube_channel_id?: string | null
          youtube_handle?: string | null
        }
        Update: {
          avg_views?: number | null
          channel_name?: string
          content_format?: string | null
          country?: string | null
          created_at?: string | null
          estimated_revenue_max?: number | null
          estimated_revenue_min?: number | null
          id?: string
          is_faceless?: boolean | null
          language?: string | null
          niche?: string
          subscribers?: number | null
          top_videos?: Json | null
          visual_style?: string | null
          youtube_channel_id?: string | null
          youtube_handle?: string | null
        }
        Relationships: []
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
          video_type: Database["public"]["Enums"]["video_type"]
        }
        Insert: {
          created_at?: string
          duration?: number | null
          id?: string
          script_content: string
          style?: string | null
          topic: string
          user_id: string
          video_type?: Database["public"]["Enums"]["video_type"]
        }
        Update: {
          created_at?: string
          duration?: number | null
          id?: string
          script_content?: string
          style?: string | null
          topic?: string
          user_id?: string
          video_type?: Database["public"]["Enums"]["video_type"]
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
      scene_patterns: {
        Row: {
          aspect_ratio: string | null
          camera_movements: Json | null
          created_at: string | null
          duration_seconds: number | null
          effectiveness_score: number | null
          id: string
          lighting_setup: string | null
          mood: string | null
          pattern_name: string
          scene_type: string
          sound_design: string | null
          source: string | null
          vfx_suggestions: Json | null
          video_type: Database["public"]["Enums"]["video_type"] | null
          visual_template: string
        }
        Insert: {
          aspect_ratio?: string | null
          camera_movements?: Json | null
          created_at?: string | null
          duration_seconds?: number | null
          effectiveness_score?: number | null
          id?: string
          lighting_setup?: string | null
          mood?: string | null
          pattern_name: string
          scene_type?: string
          sound_design?: string | null
          source?: string | null
          vfx_suggestions?: Json | null
          video_type?: Database["public"]["Enums"]["video_type"] | null
          visual_template?: string
        }
        Update: {
          aspect_ratio?: string | null
          camera_movements?: Json | null
          created_at?: string | null
          duration_seconds?: number | null
          effectiveness_score?: number | null
          id?: string
          lighting_setup?: string | null
          mood?: string | null
          pattern_name?: string
          scene_type?: string
          sound_design?: string | null
          source?: string | null
          vfx_suggestions?: Json | null
          video_type?: Database["public"]["Enums"]["video_type"] | null
          visual_template?: string
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
      score_calibration: {
        Row: {
          avg_error: number | null
          bias_correction: number | null
          confidence: number | null
          created_at: string | null
          id: string
          last_calibrated_at: string | null
          metadata: Json | null
          niche: string | null
          samples_count: number | null
          score_type: string
          weight_adjustment: number | null
        }
        Insert: {
          avg_error?: number | null
          bias_correction?: number | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_calibrated_at?: string | null
          metadata?: Json | null
          niche?: string | null
          samples_count?: number | null
          score_type: string
          weight_adjustment?: number | null
        }
        Update: {
          avg_error?: number | null
          bias_correction?: number | null
          confidence?: number | null
          created_at?: string | null
          id?: string
          last_calibrated_at?: string | null
          metadata?: Json | null
          niche?: string | null
          samples_count?: number | null
          score_type?: string
          weight_adjustment?: number | null
        }
        Relationships: []
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
      script_performance_link: {
        Row: {
          avg_retention_pct: number | null
          beat_channel_average: boolean | null
          comments: number | null
          created_at: string | null
          ctr_pct: number | null
          id: string
          learnings_extracted: boolean | null
          learnings_json: Json | null
          likes: number | null
          performance_grade: string | null
          published_at: string | null
          script_id: string | null
          updated_at: string | null
          user_id: string
          video_title: string | null
          views_30d: number | null
          views_48h: number | null
          views_7d: number | null
          youtube_video_id: string
        }
        Insert: {
          avg_retention_pct?: number | null
          beat_channel_average?: boolean | null
          comments?: number | null
          created_at?: string | null
          ctr_pct?: number | null
          id?: string
          learnings_extracted?: boolean | null
          learnings_json?: Json | null
          likes?: number | null
          performance_grade?: string | null
          published_at?: string | null
          script_id?: string | null
          updated_at?: string | null
          user_id: string
          video_title?: string | null
          views_30d?: number | null
          views_48h?: number | null
          views_7d?: number | null
          youtube_video_id: string
        }
        Update: {
          avg_retention_pct?: number | null
          beat_channel_average?: boolean | null
          comments?: number | null
          created_at?: string | null
          ctr_pct?: number | null
          id?: string
          learnings_extracted?: boolean | null
          learnings_json?: Json | null
          likes?: number | null
          performance_grade?: string | null
          published_at?: string | null
          script_id?: string | null
          updated_at?: string | null
          user_id?: string
          video_title?: string | null
          views_30d?: number | null
          views_48h?: number | null
          views_7d?: number | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "script_performance_link_script_id_fkey"
            columns: ["script_id"]
            isOneToOne: false
            referencedRelation: "saved_scripts"
            referencedColumns: ["id"]
          },
        ]
      }
      script_scores: {
        Row: {
          ai_feedback: Json | null
          content_dna_match: number | null
          created_at: string | null
          emotion_score: number | null
          hook_score: number | null
          id: string
          improvement_suggestions: string[] | null
          niche: string | null
          overall_grade: string | null
          pacing_score: number | null
          project_id: string | null
          retention_score: number | null
          script_text: string
          similar_viral_videos: Json | null
          title: string | null
          user_id: string
          video_type: string | null
          viral_score: number | null
        }
        Insert: {
          ai_feedback?: Json | null
          content_dna_match?: number | null
          created_at?: string | null
          emotion_score?: number | null
          hook_score?: number | null
          id?: string
          improvement_suggestions?: string[] | null
          niche?: string | null
          overall_grade?: string | null
          pacing_score?: number | null
          project_id?: string | null
          retention_score?: number | null
          script_text: string
          similar_viral_videos?: Json | null
          title?: string | null
          user_id: string
          video_type?: string | null
          viral_score?: number | null
        }
        Update: {
          ai_feedback?: Json | null
          content_dna_match?: number | null
          created_at?: string | null
          emotion_score?: number | null
          hook_score?: number | null
          id?: string
          improvement_suggestions?: string[] | null
          niche?: string | null
          overall_grade?: string | null
          pacing_score?: number | null
          project_id?: string | null
          retention_score?: number | null
          script_text?: string
          similar_viral_videos?: Json | null
          title?: string | null
          user_id?: string
          video_type?: string | null
          viral_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "script_scores_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      script_skill_scores: {
        Row: {
          avg_score: number | null
          best_score: number | null
          created_at: string | null
          genre: string | null
          id: string
          last_used_at: string | null
          niche: string
          technique: string
          times_used: number | null
          total_score_contribution: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_score?: number | null
          best_score?: number | null
          created_at?: string | null
          genre?: string | null
          id?: string
          last_used_at?: string | null
          niche: string
          technique: string
          times_used?: number | null
          total_score_contribution?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_score?: number | null
          best_score?: number | null
          created_at?: string | null
          genre?: string | null
          id?: string
          last_used_at?: string | null
          niche?: string
          technique?: string
          times_used?: number | null
          total_score_contribution?: number | null
          updated_at?: string | null
          user_id?: string
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
      squad_runs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step: number | null
          id: string
          input_params: Json | null
          results: Json | null
          squad_name: string
          started_at: string | null
          status: string
          template_id: string | null
          total_steps: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          input_params?: Json | null
          results?: Json | null
          squad_name: string
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_steps?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step?: number | null
          id?: string
          input_params?: Json | null
          results?: Json | null
          squad_name?: string
          started_at?: string | null
          status?: string
          template_id?: string | null
          total_steps?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "squad_runs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "squad_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_steps: {
        Row: {
          agent_icon: string | null
          agent_name: string
          agent_role: string | null
          completed_at: string | null
          created_at: string | null
          id: string
          input_data: Json | null
          output_data: Json | null
          requires_approval: boolean | null
          run_id: string
          started_at: string | null
          status: string
          step_index: number
          task_description: string | null
          user_feedback: string | null
        }
        Insert: {
          agent_icon?: string | null
          agent_name: string
          agent_role?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          requires_approval?: boolean | null
          run_id: string
          started_at?: string | null
          status?: string
          step_index: number
          task_description?: string | null
          user_feedback?: string | null
        }
        Update: {
          agent_icon?: string | null
          agent_name?: string
          agent_role?: string | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          input_data?: Json | null
          output_data?: Json | null
          requires_approval?: boolean | null
          run_id?: string
          started_at?: string | null
          status?: string
          step_index?: number
          task_description?: string | null
          user_feedback?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "squad_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "squad_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      squad_templates: {
        Row: {
          agents: Json
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_system: boolean | null
          name: string
          pipeline_steps: Json
          squad_type: string
          tool_context: string | null
        }
        Insert: {
          agents?: Json
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name: string
          pipeline_steps?: Json
          squad_type: string
          tool_context?: string | null
        }
        Update: {
          agents?: Json
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_system?: boolean | null
          name?: string
          pipeline_steps?: Json
          squad_type?: string
          tool_context?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          price_id: string | null
          product_id: string | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id: string
          stripe_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          price_id?: string | null
          product_id?: string | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          updated_at?: string
          user_id?: string
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
      thumbnail_prompt_library: {
        Row: {
          color_palette: string[] | null
          created_at: string | null
          dalle_prompt: string
          effectiveness_score: number | null
          emotion_target: string | null
          expected_ctr_pct: number | null
          face_required: boolean | null
          id: string
          midjourney_prompt: string
          niche: string
          reference_channels: string[] | null
          style: string
          title: string
        }
        Insert: {
          color_palette?: string[] | null
          created_at?: string | null
          dalle_prompt: string
          effectiveness_score?: number | null
          emotion_target?: string | null
          expected_ctr_pct?: number | null
          face_required?: boolean | null
          id?: string
          midjourney_prompt: string
          niche: string
          reference_channels?: string[] | null
          style: string
          title: string
        }
        Update: {
          color_palette?: string[] | null
          created_at?: string | null
          dalle_prompt?: string
          effectiveness_score?: number | null
          emotion_target?: string | null
          expected_ctr_pct?: number | null
          face_required?: boolean | null
          id?: string
          midjourney_prompt?: string
          niche?: string
          reference_channels?: string[] | null
          style?: string
          title?: string
        }
        Relationships: []
      }
      title_rankings: {
        Row: {
          checked_at: string | null
          country: string | null
          id: string
          keyword: string
          position: number | null
          previous_position: number | null
          search_volume_estimate: string | null
          user_id: string
          video_performance_id: string | null
        }
        Insert: {
          checked_at?: string | null
          country?: string | null
          id?: string
          keyword: string
          position?: number | null
          previous_position?: number | null
          search_volume_estimate?: string | null
          user_id: string
          video_performance_id?: string | null
        }
        Update: {
          checked_at?: string | null
          country?: string | null
          id?: string
          keyword?: string
          position?: number | null
          previous_position?: number | null
          search_volume_estimate?: string | null
          user_id?: string
          video_performance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "title_rankings_video_performance_id_fkey"
            columns: ["video_performance_id"]
            isOneToOne: false
            referencedRelation: "video_performance"
            referencedColumns: ["id"]
          },
        ]
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
      user_content_memory: {
        Row: {
          ai_identified_patterns: Json | null
          avg_retention_pct: number | null
          best_performing_duration_minutes: number | null
          best_performing_niche: string | null
          best_performing_style: string | null
          channel_id: string | null
          created_at: string | null
          id: string
          last_topics_used: string[] | null
          preferred_duration_minutes: number | null
          preferred_hook_type: string | null
          preferred_narration_style: string | null
          preferred_style: string | null
          topics_to_avoid: string[] | null
          total_scripts_generated: number | null
          total_scripts_published: number | null
          total_views_accumulated: number | null
          updated_at: string | null
          user_id: string
          worst_performing_style: string | null
        }
        Insert: {
          ai_identified_patterns?: Json | null
          avg_retention_pct?: number | null
          best_performing_duration_minutes?: number | null
          best_performing_niche?: string | null
          best_performing_style?: string | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          last_topics_used?: string[] | null
          preferred_duration_minutes?: number | null
          preferred_hook_type?: string | null
          preferred_narration_style?: string | null
          preferred_style?: string | null
          topics_to_avoid?: string[] | null
          total_scripts_generated?: number | null
          total_scripts_published?: number | null
          total_views_accumulated?: number | null
          updated_at?: string | null
          user_id: string
          worst_performing_style?: string | null
        }
        Update: {
          ai_identified_patterns?: Json | null
          avg_retention_pct?: number | null
          best_performing_duration_minutes?: number | null
          best_performing_niche?: string | null
          best_performing_style?: string | null
          channel_id?: string | null
          created_at?: string | null
          id?: string
          last_topics_used?: string[] | null
          preferred_duration_minutes?: number | null
          preferred_hook_type?: string | null
          preferred_narration_style?: string | null
          preferred_style?: string | null
          topics_to_avoid?: string[] | null
          total_scripts_generated?: number | null
          total_scripts_published?: number | null
          total_views_accumulated?: number | null
          updated_at?: string | null
          user_id?: string
          worst_performing_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_content_memory_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "user_channels"
            referencedColumns: ["id"]
          },
        ]
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
      user_reference_channels: {
        Row: {
          channel_intelligence_id: string | null
          channel_name: string
          created_at: string
          id: string
          last_scanned_at: string | null
          latest_intel: Json | null
          role: string
          thumbnail: string | null
          user_id: string
          youtube_channel_id: string
        }
        Insert: {
          channel_intelligence_id?: string | null
          channel_name: string
          created_at?: string
          id?: string
          last_scanned_at?: string | null
          latest_intel?: Json | null
          role?: string
          thumbnail?: string | null
          user_id: string
          youtube_channel_id: string
        }
        Update: {
          channel_intelligence_id?: string | null
          channel_name?: string
          created_at?: string
          id?: string
          last_scanned_at?: string | null
          latest_intel?: Json | null
          role?: string
          thumbnail?: string | null
          user_id?: string
          youtube_channel_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_reference_channels_channel_intelligence_id_fkey"
            columns: ["channel_intelligence_id"]
            isOneToOne: false
            referencedRelation: "channel_intelligence"
            referencedColumns: ["id"]
          },
        ]
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
      user_script_preferences: {
        Row: {
          avg_score_achieved: number | null
          best_hook_types: string[] | null
          id: string
          learned_at: string | null
          niche: string
          preferred_duration_min: number | null
          preferred_pov: string | null
          preferred_style: string | null
          top_performing_patterns: Json | null
          total_scripts_generated: number | null
          updated_at: string | null
          user_id: string
          voice_notes: string | null
        }
        Insert: {
          avg_score_achieved?: number | null
          best_hook_types?: string[] | null
          id?: string
          learned_at?: string | null
          niche?: string
          preferred_duration_min?: number | null
          preferred_pov?: string | null
          preferred_style?: string | null
          top_performing_patterns?: Json | null
          total_scripts_generated?: number | null
          updated_at?: string | null
          user_id: string
          voice_notes?: string | null
        }
        Update: {
          avg_score_achieved?: number | null
          best_hook_types?: string[] | null
          id?: string
          learned_at?: string | null
          niche?: string
          preferred_duration_min?: number | null
          preferred_pov?: string | null
          preferred_style?: string | null
          top_performing_patterns?: Json | null
          total_scripts_generated?: number | null
          updated_at?: string | null
          user_id?: string
          voice_notes?: string | null
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
      validation_config: {
        Row: {
          config_key: string
          config_value: Json
          description: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json
          description?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      velocity_snapshots: {
        Row: {
          channel_id: string | null
          comments: number | null
          id: string
          likes: number | null
          niche: string | null
          snapshot_at: string
          source: string | null
          subscribers: number | null
          velocity_trend: string | null
          video_id: string
          views: number | null
          views_per_hour: number | null
        }
        Insert: {
          channel_id?: string | null
          comments?: number | null
          id?: string
          likes?: number | null
          niche?: string | null
          snapshot_at?: string
          source?: string | null
          subscribers?: number | null
          velocity_trend?: string | null
          video_id: string
          views?: number | null
          views_per_hour?: number | null
        }
        Update: {
          channel_id?: string | null
          comments?: number | null
          id?: string
          likes?: number | null
          niche?: string | null
          snapshot_at?: string
          source?: string | null
          subscribers?: number | null
          velocity_trend?: string | null
          video_id?: string
          views?: number | null
          views_per_hour?: number | null
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
      video_performance: {
        Row: {
          ai_feedback: Json | null
          avg_retention_percent: number | null
          avg_view_duration_seconds: number | null
          backtested_at: string | null
          best_ranking_position: number | null
          check_count: number | null
          comments: number | null
          created_at: string | null
          ctr_percent: number | null
          duration_seconds: number | null
          hook_type: string | null
          id: string
          impressions: number | null
          last_checked_at: string | null
          lessons_learned: string[] | null
          likes: number | null
          niche: string | null
          oauth_synced: boolean | null
          performance_grade: string | null
          predicted_attention_score: number | null
          predicted_viral_score: number | null
          prediction_accuracy: number | null
          project_id: string | null
          published_at: string | null
          ranking_keywords: Json | null
          script_id: string | null
          script_score: number | null
          subscribers_gained: number | null
          synced_at: string | null
          title: string
          title_pattern: string | null
          updated_at: string | null
          user_id: string
          views_current: number | null
          views_day1: number | null
          views_day3: number | null
          views_day30: number | null
          views_day7: number | null
          watch_time_hours: number | null
          watch_time_minutes: number | null
          youtube_video_id: string
        }
        Insert: {
          ai_feedback?: Json | null
          avg_retention_percent?: number | null
          avg_view_duration_seconds?: number | null
          backtested_at?: string | null
          best_ranking_position?: number | null
          check_count?: number | null
          comments?: number | null
          created_at?: string | null
          ctr_percent?: number | null
          duration_seconds?: number | null
          hook_type?: string | null
          id?: string
          impressions?: number | null
          last_checked_at?: string | null
          lessons_learned?: string[] | null
          likes?: number | null
          niche?: string | null
          oauth_synced?: boolean | null
          performance_grade?: string | null
          predicted_attention_score?: number | null
          predicted_viral_score?: number | null
          prediction_accuracy?: number | null
          project_id?: string | null
          published_at?: string | null
          ranking_keywords?: Json | null
          script_id?: string | null
          script_score?: number | null
          subscribers_gained?: number | null
          synced_at?: string | null
          title?: string
          title_pattern?: string | null
          updated_at?: string | null
          user_id: string
          views_current?: number | null
          views_day1?: number | null
          views_day3?: number | null
          views_day30?: number | null
          views_day7?: number | null
          watch_time_hours?: number | null
          watch_time_minutes?: number | null
          youtube_video_id: string
        }
        Update: {
          ai_feedback?: Json | null
          avg_retention_percent?: number | null
          avg_view_duration_seconds?: number | null
          backtested_at?: string | null
          best_ranking_position?: number | null
          check_count?: number | null
          comments?: number | null
          created_at?: string | null
          ctr_percent?: number | null
          duration_seconds?: number | null
          hook_type?: string | null
          id?: string
          impressions?: number | null
          last_checked_at?: string | null
          lessons_learned?: string[] | null
          likes?: number | null
          niche?: string | null
          oauth_synced?: boolean | null
          performance_grade?: string | null
          predicted_attention_score?: number | null
          predicted_viral_score?: number | null
          prediction_accuracy?: number | null
          project_id?: string | null
          published_at?: string | null
          ranking_keywords?: Json | null
          script_id?: string | null
          script_score?: number | null
          subscribers_gained?: number | null
          synced_at?: string | null
          title?: string
          title_pattern?: string | null
          updated_at?: string | null
          user_id?: string
          views_current?: number | null
          views_day1?: number | null
          views_day3?: number | null
          views_day30?: number | null
          views_day7?: number | null
          watch_time_hours?: number | null
          watch_time_minutes?: number | null
          youtube_video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_performance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "video_projects"
            referencedColumns: ["id"]
          },
        ]
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
          video_type: Database["public"]["Enums"]["video_type"]
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
          video_type?: Database["public"]["Enums"]["video_type"]
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
          video_type?: Database["public"]["Enums"]["video_type"]
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
      viral_alerts: {
        Row: {
          alert_type: string | null
          channel_name: string | null
          id: string
          metadata: Json | null
          pre_viral_score: number | null
          sent_at: string | null
          user_id: string
          video_id: string
          video_title: string | null
        }
        Insert: {
          alert_type?: string | null
          channel_name?: string | null
          id?: string
          metadata?: Json | null
          pre_viral_score?: number | null
          sent_at?: string | null
          user_id: string
          video_id: string
          video_title?: string | null
        }
        Update: {
          alert_type?: string | null
          channel_name?: string | null
          id?: string
          metadata?: Json | null
          pre_viral_score?: number | null
          sent_at?: string | null
          user_id?: string
          video_id?: string
          video_title?: string | null
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
      viral_mechanics_library: {
        Row: {
          avg_ctr_boost_pct: number | null
          avg_retention_boost_pct: number | null
          avg_views_multiplier: number | null
          best_niches: string[] | null
          best_video_format: string | null
          category: string
          created_at: string | null
          description: string
          difficulty: string | null
          effectiveness_score: number | null
          embedding: string | null
          example_channels: string[] | null
          example_titles: string[] | null
          how_to_apply: string
          id: string
          mechanic_name: string
          real_world_evidence: string | null
        }
        Insert: {
          avg_ctr_boost_pct?: number | null
          avg_retention_boost_pct?: number | null
          avg_views_multiplier?: number | null
          best_niches?: string[] | null
          best_video_format?: string | null
          category: string
          created_at?: string | null
          description: string
          difficulty?: string | null
          effectiveness_score?: number | null
          embedding?: string | null
          example_channels?: string[] | null
          example_titles?: string[] | null
          how_to_apply: string
          id?: string
          mechanic_name: string
          real_world_evidence?: string | null
        }
        Update: {
          avg_ctr_boost_pct?: number | null
          avg_retention_boost_pct?: number | null
          avg_views_multiplier?: number | null
          best_niches?: string[] | null
          best_video_format?: string | null
          category?: string
          created_at?: string | null
          description?: string
          difficulty?: string | null
          effectiveness_score?: number | null
          embedding?: string | null
          example_channels?: string[] | null
          example_titles?: string[] | null
          how_to_apply?: string
          id?: string
          mechanic_name?: string
          real_world_evidence?: string | null
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
          impact_score: number | null
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
          impact_score?: number | null
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
          impact_score?: number | null
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
      youtube_algorithm_knowledge: {
        Row: {
          applies_to_format: string | null
          applies_to_niche: string | null
          category: string
          confidence_score: number | null
          content: string
          created_at: string | null
          data_json: Json | null
          embedding: string | null
          id: string
          last_verified_at: string | null
          priority: number | null
          source: string | null
          title: string
          updated_at: string | null
          valid_until: string | null
        }
        Insert: {
          applies_to_format?: string | null
          applies_to_niche?: string | null
          category: string
          confidence_score?: number | null
          content: string
          created_at?: string | null
          data_json?: Json | null
          embedding?: string | null
          id?: string
          last_verified_at?: string | null
          priority?: number | null
          source?: string | null
          title: string
          updated_at?: string | null
          valid_until?: string | null
        }
        Update: {
          applies_to_format?: string | null
          applies_to_niche?: string | null
          category?: string
          confidence_score?: number | null
          content?: string
          created_at?: string | null
          data_json?: Json | null
          embedding?: string | null
          id?: string
          last_verified_at?: string | null
          priority?: number | null
          source?: string | null
          title?: string
          updated_at?: string | null
          valid_until?: string | null
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
      youtube_oauth_tokens: {
        Row: {
          access_token: string
          channel_id: string
          channel_name: string | null
          channel_thumbnail: string | null
          connected_at: string | null
          id: string
          refresh_token: string
          scopes: string[] | null
          token_expires_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          access_token: string
          channel_id: string
          channel_name?: string | null
          channel_thumbnail?: string | null
          connected_at?: string | null
          id?: string
          refresh_token: string
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          access_token?: string
          channel_id?: string
          channel_name?: string | null
          channel_thumbnail?: string | null
          connected_at?: string | null
          id?: string
          refresh_token?: string
          scopes?: string[] | null
          token_expires_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      mv_avg_scores_by_niche: {
        Row: {
          avg_attention_score: number | null
          avg_dopamine_score: number | null
          avg_gold_score: number | null
          avg_multiplier: number | null
          avg_retention: number | null
          avg_viral_score: number | null
          niche: string | null
          total_videos: number | null
        }
        Relationships: []
      }
      mv_niche_benchmarks: {
        Row: {
          avg_attention_score: number | null
          avg_hook_strength: number | null
          avg_retention: number | null
          avg_views: number | null
          avg_viral_score: number | null
          format: string | null
          language: string | null
          niche: string | null
          sample_count: number | null
          top_retention: number | null
          top_views: number | null
        }
        Relationships: []
      }
      mv_top_hooks_by_niche: {
        Row: {
          hook_text: string | null
          hook_type: string | null
          niche: string | null
          retention_score: number | null
          source_video: string | null
        }
        Relationships: []
      }
      mv_top_titles_by_views: {
        Row: {
          channel_name: string | null
          emotional_triggers: string[] | null
          niche: string | null
          title: string | null
          title_pattern: string | null
          views: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_pre_viral_score: {
        Args: {
          _engagement_rate: number
          _recency_factor: number
          _velocity_score: number
          _view_ratio: number
        }
        Returns: number
      }
      calculate_velocity_score: {
        Args: {
          _engagement_rate: number
          _growth_acceleration: number
          _views_per_hour: number
        }
        Returns: number
      }
      check_and_increment_api_usage: {
        Args: { _api_name: string }
        Returns: boolean
      }
      check_tubebot_limit: { Args: { _user_id: string }; Returns: Json }
      cleanup_expired_oauth_tokens: { Args: never; Returns: undefined }
      consume_credits: {
        Args: { _amount: number; _user_id: string }
        Returns: boolean
      }
      enforce_credits: {
        Args: { _operation: string; _user_id: string }
        Returns: Json
      }
      get_niche_benchmarks: { Args: { _niche?: string }; Returns: Json[] }
      get_user_tier: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      match_knowledge: {
        Args: {
          filter_tables?: string[]
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content_text: string
          id: string
          metadata: Json
          similarity: number
          source_id: string
          source_table: string
        }[]
      }
      owns_squad_step: { Args: { _run_id: string }; Returns: boolean }
      refresh_materialized_views: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      subscription_tier: "starter" | "pro" | "full" | "studio"
      video_type: "long" | "short"
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
      app_role: ["admin", "moderator", "user"],
      subscription_tier: ["starter", "pro", "full", "studio"],
      video_type: ["long", "short"],
    },
  },
} as const
