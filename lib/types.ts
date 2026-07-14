export type ClinicRole = "owner" | "manager" | "attendant";
export type MemberStatus = "active" | "inactive";
export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";
export type PriceVisibility = "never" | "after_context" | "always";
export type RuleSeverity = "guidance" | "warning" | "block";
export type SpinInteractionStatus = "processing" | "completed" | "failed";
export type SalesInteractionStage = "opening" | "investigation" | "capability" | "commitment";
export type SpinStage = "situation" | "problem" | "implication" | "need_payoff" | "capability" | "commitment" | "none";
export type SpinRiskLevel = "low" | "medium" | "high";

export interface Clinic {
  id: string;
  name: string;
  slug: string;
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  display_name: string | null;
  email: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  id: string;
  clinic_id: string;
  user_id: string;
  role: ClinicRole;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
  clinic: Clinic;
}

export interface MemberWithProfile {
  id: string;
  clinic_id: string;
  user_id: string;
  role: ClinicRole;
  status: MemberStatus;
  created_at: string;
  updated_at: string;
  profile: Profile | null;
}

export interface ClinicInvitation {
  id: string;
  clinic_id: string;
  email: string;
  role: ClinicRole;
  token: string;
  status: InvitationStatus;
  invited_by: string;
  expires_at: string;
  created_at: string;
  accepted_at: string | null;
}

export interface InvitationPreview {
  clinic_name: string;
  email: string;
  role: ClinicRole;
  status: InvitationStatus;
  expires_at: string;
}

export interface ClinicCommercialProfile {
  clinic_id: string;
  description: string;
  city: string;
  state: string;
  address: string;
  whatsapp: string;
  website: string;
  business_hours: string;
  payment_information: string;
  scheduling_rules: string;
  tone_of_voice: string;
  tone_notes: string;
  primary_goal: string;
  pricing_policy: string;
  prohibited_claims: string[];
  forbidden_words: string[];
  custom_instructions: string;
  created_at: string;
  updated_at: string;
}

export interface Procedure {
  id: string;
  clinic_id: string;
  name: string;
  category: string;
  description: string;
  target_patient: string;
  benefits: string;
  price_guidance: string;
  price_visibility: PriceVisibility;
  consultation_required: boolean;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Professional {
  id: string;
  clinic_id: string;
  name: string;
  specialty: string;
  registration: string;
  bio: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClinicRule {
  id: string;
  clinic_id: string;
  title: string;
  category: string;
  instruction: string;
  severity: RuleSeverity;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClinicFaq {
  id: string;
  clinic_id: string;
  procedure_id: string | null;
  question: string;
  answer: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ApprovedAnswer {
  id: string;
  clinic_id: string;
  procedure_id: string | null;
  label: string;
  patient_intent: string;
  content: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SpinAnalysis {
  interaction_stage: SalesInteractionStage;
  spin_stage: SpinStage;
  intent: string;
  summary: string;
  explicit_need: string;
  implicit_need: string;
  objections: string[];
  emotional_state: string;
  missing_information: string[];
  risk_level: SpinRiskLevel;
  confidence: number;
}

export interface SpinPlan {
  next_objective: string;
  recommended_strategy: string;
  rationale: string;
  should_present_offer: boolean;
  should_request_commitment: boolean;
  avoid_actions: string[];
}

export interface SpinGeneratedResponse {
  primary_response: string;
  alternative_response: string;
  explanation: string;
  expected_next_step: string;
  warnings: string[];
}

export interface SpinValidation {
  safe_to_use: boolean;
  checks: string[];
  issues: string[];
}

export interface SpinEngineResult {
  analysis: SpinAnalysis;
  plan: SpinPlan;
  response: SpinGeneratedResponse;
  validation: SpinValidation;
}

export interface SpinHistoryItem {
  id: string;
  patient_message: string;
  procedure_name: string | null;
  status: SpinInteractionStatus;
  created_at: string;
  spin_stage: SpinStage | null;
  intent: string | null;
  primary_response: string | null;
  safe_to_use: boolean | null;
}
