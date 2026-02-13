export type VaultRole = "owner" | "member" | "viewer";
export type RecordingStatus = "uploading" | "processing" | "ready" | "failed" | "rejected_paywall";
export type PromptDepth = "light" | "medium" | "deep";
export type PromptAction = "started" | "skipped" | "ignored";
export type PromptCadence = "off" | "daily" | "every_3_days" | "weekly";

export interface User {
  id: string;
  name: string;
  email: string;
  prompt_cadence: PromptCadence;
  prompt_time: string; // HH:MM
  created_at: string;
}

export interface Vault {
  id: string;
  name: string;
  owner_user_id: string;
  is_pro: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  invite_code: string;
  created_at: string;
}

export interface VaultMember {
  vault_id: string;
  user_id: string;
  role: VaultRole;
  joined_at: string;
}

export interface Recording {
  id: string;
  vault_id: string;
  created_by_user_id: string;
  title: string | null;
  prompt_id: string | null;
  audio_url: string;
  duration_seconds: number;
  status: RecordingStatus;
  summary: string | null;
  tags: string[];
  created_at: string;
}

export interface RecordingSegment {
  id: string;
  recording_id: string;
  start_ms: number;
  end_ms: number;
  text: string;
}

export interface Prompt {
  id: string;
  text: string;
  theme: string;
  depth_level: PromptDepth;
}

export interface PromptLog {
  id: string;
  user_id: string;
  prompt_id: string;
  sent_at: string;
  action: PromptAction;
}

export interface UsageLog {
  id: string;
  user_id: string;
  date_yyyy_mm_dd: string;
  seconds_recorded_total: number;
}

export interface VaultWithRole extends Vault {
  role: VaultRole;
}

export interface RecordingWithCreator extends Recording {
  creator_name?: string;
}
