export type RiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical';
export type UploadStatus = 'pending' | 'analyzing' | 'completed' | 'flagged' | 'ready_to_file';

export interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  ghost_mode: boolean;
  encryption_salt: string | null;
  created_at: string;
}

export interface Upload {
  id: string;
  user_id: string;
  file_url: string;
  file_name: string;
  file_iv: string | null;         // IV for encrypted image
  original_type: string | null;   // original MIME type (e.g. image/png)
  status: UploadStatus;
  dispatch_metadata?: any;
  created_at: string;
  analysis_results?: AnalysisResult[];
}

export interface AnalysisFlag {
  category: string;
  description: string;
  severity: RiskLevel;
  evidence: string;
}

export type MediaAuthenticityStatus =
  | 'authentic'
  | 'ai_generated'
  | 'ai_assisted'
  | 'manipulated'
  | 'likely_human'
  | 'inconclusive'
  | 'unsupported'
  | 'unavailable';

export type MediaAuthenticityEvidenceKind =
  | 'heatmap'
  | 'timestamp'
  | 'spectrogram'
  | 'metadata'
  | 'text_region'
  | 'model_signal';

export interface MediaAuthenticityEvidence {
  kind: MediaAuthenticityEvidenceKind;
  label: string;
  description: string;
  value?: string;
  evidence_supports?: 'AI' | 'Authentic' | 'Neutral';
  evidence_strength?: 'Weak' | 'Moderate' | 'Strong';
  start_time_seconds?: number;
  end_time_seconds?: number;
  region?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  asset_url?: string;
}

export interface MediaAuthenticityModelResult {
  detector_id: string;
  detector_name: string;
  model_name?: string;
  modality: 'image' | 'audio' | 'video' | 'document' | 'text' | 'generic';
  authenticity_score: number;
  ai_generation_probability: number;
  manipulation_probability: number;
  confidence_score: number;
  summary: string;
  technical_details: string[];
  evidence: MediaAuthenticityEvidence[];
  possible_models?: string[];
  risk_level?: 'Low' | 'Medium' | 'High';
  limitations?: string[];
  final_reasoning?: string;
}

export interface MediaAuthenticityItem {
  file_name: string;
  media_type: 'image' | 'audio' | 'video' | 'document' | 'text' | 'other';
  provider: string;
  status: MediaAuthenticityStatus;
  label: string;
  summary: string;
  authenticity_score?: number;
  ai_generation_probability?: number;
  manipulation_probability?: number;
  confidence_score?: number;
  ai_probability?: number;
  confidence?: number;
  human_explanation?: string;
  technical_explanation?: string;
  metadata?: Record<string, unknown>;
  evidence?: MediaAuthenticityEvidence[];
  model_results?: MediaAuthenticityModelResult[];
  possible_models?: string[];
  risk_level?: 'Low' | 'Medium' | 'High';
  limitations?: string[];
  final_reasoning?: string;
  dual_pass_agreement?: boolean;
}

export interface MediaAuthenticityResult {
  provider: string;
  status: MediaAuthenticityStatus;
  label: string;
  summary: string;
  human_explanation?: string;
  technical_explanation?: string;
  authenticity_score?: number;
  ai_generation_probability?: number;
  manipulation_probability?: number;
  confidence_score?: number;
  confidence?: number;
  ai_probability?: number;
  analyzed_count: number;
  supported_count: number;
  detectors_used?: string[];
  items: MediaAuthenticityItem[];
  possible_models?: string[];
  risk_level?: 'Low' | 'Medium' | 'High';
}

export interface AnalysisResult {
  id: string;
  upload_id: string;
  risk_level: RiskLevel;           // Kept plaintext for filtering
  // Encrypted fields (base64 encoded)
  encrypted_summary: string | null;
  encrypted_flags: string | null;
  encrypted_details: string | null;
  encryption_iv: string | null;
  // Legacy plaintext fields (for backward compat with old data)
  summary: string;
  flags: AnalysisFlag[];
  details: {
    tone_analysis?: string;
    manipulation_indicators?: string[];
    threat_indicators?: string[];
    recommendations?: string[];
    confidence_score?: number;
    media_authenticity?: MediaAuthenticityResult;
    legal_analysis?: {
      summary: string;
      potential_violations: string[];
      disclaimer: string;
      powered_by_kanoon?: boolean;
      kanoon_search_keywords?: string;
    };
    rpa_filing_data?: {
      platform?: string;
      platform_url_or_id?: string | null;
      incident_category?: string;
      approximate_date?: string | null;
      suspect_info?: {
        name?: string;
        identifier_type?: string;
        identifier_value?: string | null;
        description?: string;
      };
    };
  };
  created_at: string;
}

export interface Report {
  id: string;
  user_id: string;
  upload_id: string;
  analysis_id: string;
  file_name: string;
  file_url: string;
  risk_level: RiskLevel;
  created_at: string;
}
